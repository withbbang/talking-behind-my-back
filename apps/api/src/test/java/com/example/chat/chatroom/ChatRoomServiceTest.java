package com.example.chat.chatroom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** T-006 방 CRUD + 멤버십 규칙 + T-017 나가기 분기·mode·aiPersonality. AuthServiceTest 와 같이 실제 매퍼 위에서 @Transactional 롤백. */
@SpringBootTest
@Transactional
class ChatRoomServiceTest {

	@Autowired ChatRoomService service;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired UserMapper userMapper;

	private User owner;
	private User guest;
	private User other;

	@BeforeEach
	void users() {
		owner = newUser("주인");
		guest = newUser("손님");
		other = newUser("남");
	}

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	/** 입장 API 를 거치지 않고 참여자 행만 필요한 케이스 — 매퍼로 직접 넣는다. */
	private void join(Long roomId, Long userId) {
		memberMapper.insert(RoomMember.participant(roomId, userId));
	}

	private static void assertError(ThrowingCallable call, ErrorCode code) {
		assertThatThrownBy(call).isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(code);
	}

	@Nested
	@DisplayName("create")
	class Create {

		@Test
		void 기본_제목_코드_발급_OWNER_멤버십_last_message_at_은_created_at() {
			RoomResponse r = service.create(owner.getId(), null);

			assertThat(r.title()).isEqualTo("새 대화");
			assertThat(r.role()).isEqualTo(RoomMember.Role.OWNER);
			assertThat(r.status()).isEqualTo(RoomStatus.ACTIVE);
			assertThat(r.mode()).isEqualTo(RoomMode.AI);
			assertThat(r.aiPersonality()).isEqualTo(AiPersonality.RATIONAL);
			assertThat(r.inviteCode()).matches("[A-HJ-NP-Z2-9]{8}");
			assertThat(r.inviteUrl()).isEqualTo("http://localhost:3000/join/" + r.inviteCode());
			assertThat(r.members()).hasSize(1);
			assertThat(r.members().get(0).userId()).isEqualTo(owner.getId());
			assertThat(r.members().get(0).nickname()).isEqualTo("주인");
			assertThat(r.members().get(0).role()).isEqualTo(RoomMember.Role.OWNER);
			assertThat(r.memberCount()).isEqualTo(1);
			assertThat(r.messageCount()).isZero();
			assertThat(r.lastMessageAt()).isEqualTo(r.createdAt());
			assertThat(memberMapper.findActive(r.id(), owner.getId())).isPresent();
		}

		@Test
		void 제목_지정_및_공백은_trim() {
			assertThat(service.create(owner.getId(), "  점심  ").title()).isEqualTo("점심");
			assertThat(service.create(owner.getId(), "   ").title()).isEqualTo("새 대화");
		}

		@Test
		void 활성_방_50개면_ROOM_LIMIT_EXCEEDED() {
			for (int i = 0; i < ChatRoomService.MAX_ACTIVE_ROOMS; i++) service.create(owner.getId(), "r" + i);

			assertError(
				() -> service.create(owner.getId(), "51"), ErrorCode.ROOM_LIMIT_EXCEEDED);
		}

		@Test
		void 나간_방은_상한에_안_센다() {
			for (int i = 0; i < ChatRoomService.MAX_ACTIVE_ROOMS; i++) {
				RoomResponse r = service.create(owner.getId(), "r" + i);
				if (i == 0) service.leave(owner.getId(), r.id());
			}
			assertThat(service.create(owner.getId(), "ok").id()).isNotNull();
		}

		@Test
		void 응답_시간은_UTC_Instant_로_변환된다() {
			RoomResponse r = service.create(owner.getId(), null);
			LocalDateTime stored = roomMapper.findById(r.id()).orElseThrow().getCreatedAt();

			Instant expected = stored.atZone(ZoneId.of("Asia/Seoul")).toInstant();
			assertThat(r.createdAt()).isEqualTo(expected);
		}
	}

	@Nested
	@DisplayName("get")
	class Get {

		@Test
		void 멤버가_아니면_ROOM_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);

			assertError(
				() -> service.get(other.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
			assertError(
				() -> service.get(owner.getId(), -1L), ErrorCode.ROOM_NOT_FOUND);
		}

		@Test
		void 참여자는_역할_PARTICIPANT_이고_초대코드는_null() {
			RoomResponse created = service.create(owner.getId(), null);
			join(created.id(), guest.getId());

			RoomResponse asGuest = service.get(guest.getId(), created.id());
			assertThat(asGuest.role()).isEqualTo(RoomMember.Role.PARTICIPANT);
			assertThat(asGuest.inviteCode()).isNull();
			assertThat(asGuest.inviteUrl()).isNull();
			assertThat(asGuest.members()).extracting(RoomResponse.Member::nickname).containsExactly("주인", "손님");
			assertThat(asGuest.memberCount()).isEqualTo(2);

			RoomResponse asOwner = service.get(owner.getId(), created.id());
			assertThat(asOwner.inviteCode()).isEqualTo(created.inviteCode());
		}

		@Test
		void ORPHANED_방도_남은_참여자에게는_200() {
			RoomResponse created = service.create(owner.getId(), null);
			join(created.id(), guest.getId());
			service.leave(owner.getId(), created.id());

			RoomResponse r = service.get(guest.getId(), created.id());
			assertThat(r.status()).isEqualTo(RoomStatus.ORPHANED);
			assertThat(r.members()).extracting(RoomResponse.Member::userId).containsExactly(guest.getId());
		}
	}

	@Nested
	@DisplayName("list")
	class ListRooms {

		@Test
		void 페이지_경계에서_중복_누락_없이_전부_순회한다() {
			List<Long> created = new ArrayList<>();
			for (int i = 0; i < 7; i++) created.add(service.create(owner.getId(), "r" + i).id());
			// 같은 last_message_at 여러 개 (키셋이 필요한 상황)
			LocalDateTime same = roomMapper.findById(created.get(0)).orElseThrow().getLastMessageAt();
			for (Long id : created) roomMapper.setLastMessageAt(id, same);
			// 참여 방 + 남의 방
			RoomResponse joined = service.create(other.getId(), "joined");
			join(joined.id(), owner.getId());
			service.create(other.getId(), "not mine");

			List<Long> seen = new ArrayList<>();
			String cursor = null;
			int pages = 0;
			do {
				CursorPage<RoomResponse> page = service.list(owner.getId(), cursor, 3);
				page.items().forEach(r -> seen.add(r.id()));
				cursor = page.nextCursor();
				pages++;
			} while (cursor != null);

			assertThat(pages).isEqualTo(3);
			assertThat(seen).doesNotHaveDuplicates().hasSize(8).contains(joined.id()).containsAll(created);
			assertThat(seen.get(0)).isEqualTo(joined.id()); // 가장 최근 생성
		}

		@Test
		void 목록_항목은_members_없이_memberCount_만() {
			service.create(owner.getId(), null);
			RoomResponse item = service.list(owner.getId(), null, null).items().get(0);
			assertThat(item.members()).isNull();
			assertThat(item.memberCount()).isEqualTo(1);
			assertThat(item.inviteCode()).isNotNull(); // 개설자
		}

		@Test
		void 마지막_페이지면_nextCursor_null_그리고_잘못된_커서는_400() {
			service.create(owner.getId(), null);
			assertThat(service.list(owner.getId(), null, 10).nextCursor()).isNull();
			assertError(
				() -> service.list(owner.getId(), "***", 10), ErrorCode.VALIDATION_FAILED);
		}
	}

	@Nested
	@DisplayName("update (PATCH /rooms/{id})")
	class Update {

		private static RoomUpdate title(String t) { return new RoomUpdate(t, null, null, null); }
		private static RoomUpdate mode(RoomMode m) { return new RoomUpdate(null, m, null, null); }
		private static RoomUpdate personality(AiPersonality p) { return new RoomUpdate(null, null, p, null); }
		private static RoomUpdate prompt(String p) { return new RoomUpdate(null, null, null, p); }

		@Test
		void title_은_개설자만_참여자는_FORBIDDEN_비멤버는_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertThat(service.update(owner.getId(), r.id(), title(" 바꿈 ")).title()).isEqualTo("바꿈");
			assertError(() -> service.update(guest.getId(), r.id(), title("x")), ErrorCode.FORBIDDEN);
			assertError(() -> service.update(other.getId(), r.id(), title("x")), ErrorCode.ROOM_NOT_FOUND);
		}

		@Test
		void 빈_갱신과_공백_title_은_VALIDATION_FAILED() {
			RoomResponse r = service.create(owner.getId(), null);

			assertError(() -> service.update(owner.getId(), r.id(), new RoomUpdate(null, null, null, null)), ErrorCode.VALIDATION_FAILED);
			assertThatThrownBy(() -> service.update(owner.getId(), r.id(), title("   ")))
				.isInstanceOf(BusinessException.class)
				.extracting("details").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsKey("title");
		}

		@Test
		void mode_는_참여자도_변경_2명이면_HUMAN_가능() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertThat(service.update(guest.getId(), r.id(), mode(RoomMode.HUMAN)).mode()).isEqualTo(RoomMode.HUMAN);
			assertThat(service.update(owner.getId(), r.id(), mode(RoomMode.AI)).mode()).isEqualTo(RoomMode.AI);
		}

		@Test
		void 혼자인_방에서_HUMAN_은_MODE_NOT_ALLOWED_AI_는_항상_가능() {
			RoomResponse r = service.create(owner.getId(), null);

			assertError(() -> service.update(owner.getId(), r.id(), mode(RoomMode.HUMAN)), ErrorCode.MODE_NOT_ALLOWED);
			assertThat(service.update(owner.getId(), r.id(), mode(RoomMode.AI)).mode()).isEqualTo(RoomMode.AI);
			assertThat(roomMapper.findById(r.id()).orElseThrow().getMode()).isEqualTo(RoomMode.AI);
		}

		@Test
		void aiPersonality_는_개설자만_참여자는_FORBIDDEN() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertThat(service.update(owner.getId(), r.id(), personality(AiPersonality.EMOTIONAL)).aiPersonality())
				.isEqualTo(AiPersonality.EMOTIONAL);
			assertError(
				() -> service.update(guest.getId(), r.id(), personality(AiPersonality.RATIONAL)), ErrorCode.FORBIDDEN);
			assertThat(roomMapper.findById(r.id()).orElseThrow().getAiPersonality()).isEqualTo(AiPersonality.EMOTIONAL);
		}

		@Test
		void ORPHANED_방은_어떤_PATCH_도_ROOM_ORPHANED() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());
			service.leave(owner.getId(), r.id());

			assertError(() -> service.update(guest.getId(), r.id(), mode(RoomMode.AI)), ErrorCode.ROOM_ORPHANED);
			assertError(() -> service.update(guest.getId(), r.id(), title("x")), ErrorCode.ROOM_ORPHANED);
			assertError(
				() -> service.update(guest.getId(), r.id(), personality(AiPersonality.EMOTIONAL)), ErrorCode.ROOM_ORPHANED);
		}

		@Test
		void 복합_요청은_전부_아니면_전무_참여자_title_포함이면_mode_도_미변경() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertError(
				() -> service.update(guest.getId(), r.id(), new RoomUpdate("x", RoomMode.HUMAN, null, null)), ErrorCode.FORBIDDEN);
			ChatRoom room = roomMapper.findById(r.id()).orElseThrow();
			assertThat(room.getMode()).isEqualTo(RoomMode.AI);
			assertThat(room.getTitle()).isEqualTo("새 대화");

			RoomResponse updated = service.update(owner.getId(), r.id(), new RoomUpdate("둘", RoomMode.HUMAN, AiPersonality.EMOTIONAL, null));
			assertThat(updated.title()).isEqualTo("둘");
			assertThat(updated.mode()).isEqualTo(RoomMode.HUMAN);
			assertThat(updated.aiPersonality()).isEqualTo(AiPersonality.EMOTIONAL);
		}

		@Test
		void aiPrompt_없으면_effectiveAiPrompt_는_프리셋_문구() {
			RoomResponse r = service.create(owner.getId(), null);

			assertThat(r.aiPrompt()).isNull();
			assertThat(r.effectiveAiPrompt()).isEqualTo(AiPersonality.RATIONAL.systemPrompt());
		}

		@Test
		void aiPrompt_는_개설자만_trim_저장_참여자는_FORBIDDEN() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			RoomResponse updated = service.update(owner.getId(), r.id(), prompt("  짧게 답해.  "));
			assertThat(updated.aiPrompt()).isEqualTo("짧게 답해.");
			assertThat(updated.effectiveAiPrompt()).isEqualTo("짧게 답해.");
			assertThat(updated.aiPersonality()).isEqualTo(AiPersonality.RATIONAL);
			assertError(() -> service.update(guest.getId(), r.id(), prompt("x")), ErrorCode.FORBIDDEN);
			assertThat(roomMapper.findById(r.id()).orElseThrow().getAiPrompt()).isEqualTo("짧게 답해.");
			// 참여자도 조회는 된다
			assertThat(service.get(guest.getId(), r.id()).effectiveAiPrompt()).isEqualTo("짧게 답해.");
		}

		@Test
		void aiPrompt_빈_문자열_또는_공백은_초기화_프리셋으로_복귀() {
			RoomResponse r = service.create(owner.getId(), null);
			service.update(owner.getId(), r.id(), prompt("커스텀"));

			RoomResponse cleared = service.update(owner.getId(), r.id(), prompt("   "));
			assertThat(cleared.aiPrompt()).isNull();
			assertThat(cleared.effectiveAiPrompt()).isEqualTo(AiPersonality.RATIONAL.systemPrompt());
			assertThat(roomMapper.findById(r.id()).orElseThrow().getAiPrompt()).isNull();
		}

		@Test
		void aiPersonality_재선택하면_aiPrompt_초기화() {
			RoomResponse r = service.create(owner.getId(), null);
			service.update(owner.getId(), r.id(), prompt("커스텀"));

			RoomResponse updated = service.update(owner.getId(), r.id(), personality(AiPersonality.EMOTIONAL));
			assertThat(updated.aiPersonality()).isEqualTo(AiPersonality.EMOTIONAL);
			assertThat(updated.aiPrompt()).isNull();
			assertThat(updated.effectiveAiPrompt()).isEqualTo(AiPersonality.EMOTIONAL.systemPrompt());
		}

		@Test
		void aiPersonality_와_aiPrompt_를_함께_보내면_커스텀이_남는다() {
			RoomResponse r = service.create(owner.getId(), null);

			RoomResponse updated = service.update(owner.getId(), r.id(), new RoomUpdate(null, null, AiPersonality.EMOTIONAL, "둘 다"));
			assertThat(updated.aiPersonality()).isEqualTo(AiPersonality.EMOTIONAL);
			assertThat(updated.aiPrompt()).isEqualTo("둘 다");
			assertThat(updated.effectiveAiPrompt()).isEqualTo("둘 다");
		}

		@Test
		void ORPHANED_방은_aiPrompt_도_ROOM_ORPHANED() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());
			service.leave(owner.getId(), r.id());

			assertError(() -> service.update(guest.getId(), r.id(), prompt("x")), ErrorCode.ROOM_ORPHANED);
		}
	}

	@Nested
	@DisplayName("leave")
	class Leave {

		@Test
		void 개설자_나가기는_ORPHANED_참여자_멤버십은_유지() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			service.leave(owner.getId(), r.id());

			ChatRoom room = roomMapper.findById(r.id()).orElseThrow();
			assertThat(room.getStatus()).isEqualTo(RoomStatus.ORPHANED);
			assertThat(memberMapper.findActive(r.id(), owner.getId())).isEmpty();
			assertThat(memberMapper.findActive(r.id(), guest.getId())).isPresent();
			assertError(
				() -> service.get(owner.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
		}

		@Test
		void 참여자_나가기는_멤버십만_종료_방은_ACTIVE() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			service.leave(guest.getId(), r.id());

			assertThat(roomMapper.findById(r.id()).orElseThrow().getStatus()).isEqualTo(RoomStatus.ACTIVE);
			assertThat(memberMapper.findActive(r.id(), guest.getId())).isEmpty();
			assertThat(service.get(owner.getId(), r.id()).memberCount()).isEqualTo(1);
		}

		@Test
		void 참여자_나가기시_HUMAN_이던_방은_AI_로_복귀() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());
			service.update(owner.getId(), r.id(), new RoomUpdate(null, RoomMode.HUMAN, null, null));

			service.leave(guest.getId(), r.id());

			assertThat(roomMapper.findById(r.id()).orElseThrow().getMode()).isEqualTo(RoomMode.AI);
		}

		@Test
		void ORPHANED_방에서_참여자_나가기는_확인_처리_멤버십만_종료_방_행_유지() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());
			service.leave(owner.getId(), r.id());

			service.leave(guest.getId(), r.id());

			ChatRoom room = roomMapper.findById(r.id()).orElseThrow();
			assertThat(room.getStatus()).isEqualTo(RoomStatus.ORPHANED);
			assertThat(memberMapper.findActive(r.id(), guest.getId())).isEmpty();
			assertThat(memberMapper.countActiveByRoomId(r.id())).isZero();
			assertError(() -> service.get(guest.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
		}

		@Test
		void 비멤버_또는_이미_나간_멤버는_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			service.leave(owner.getId(), r.id());

			assertError(
				() -> service.leave(owner.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
			assertError(
				() -> service.leave(other.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
		}
	}
	@Nested
	@DisplayName("preview (GET /rooms/join/{code})")
	class Preview {

		@Test
		void 미리보기_필드_roomId_title_ownerNickname_memberCount() {
			RoomResponse r = service.create(owner.getId(), "점심");

			JoinPreviewResponse p = service.preview(guest.getId(), r.inviteCode());
			assertThat(p.roomId()).isEqualTo(r.id());
			assertThat(p.title()).isEqualTo("점심");
			assertThat(p.ownerNickname()).isEqualTo("주인");
			assertThat(p.memberCount()).isEqualTo(1);
		}

		@Test
		void 이미_멤버면_그대로_200() {
			RoomResponse r = service.create(owner.getId(), null);
			service.join(guest.getId(), r.inviteCode());
			service.create(other.getId(), null); // 손님의 방과 무관한 방

			assertThat(service.preview(guest.getId(), r.inviteCode()).memberCount()).isEqualTo(2);
		}

		@Test
		void 입장과_같은_검증_404_410_400_409() {
			assertError(() -> service.preview(guest.getId(), "ZZZZZZZZ"), ErrorCode.INVITE_NOT_FOUND);

			RoomResponse self = service.create(owner.getId(), null);
			assertError(() -> service.preview(owner.getId(), self.inviteCode()), ErrorCode.SELF_INVITE);

			RoomResponse full = service.create(owner.getId(), null);
			join(full.id(), guest.getId());
			assertError(() -> service.preview(other.getId(), full.inviteCode()), ErrorCode.ROOM_FULL);

			RoomResponse orphaned = service.create(owner.getId(), null);
			service.leave(owner.getId(), orphaned.id());
			assertError(() -> service.preview(guest.getId(), orphaned.inviteCode()), ErrorCode.ROOM_ORPHANED);
		}
	}

	@Nested
	@DisplayName("join (POST /rooms/join/{code})")
	class Join {

		@Test
		void 입장하면_PARTICIPANT_Room_초대코드는_null() {
			RoomResponse r = service.create(owner.getId(), null);

			RoomResponse joined = service.join(guest.getId(), r.inviteCode());
			assertThat(joined.id()).isEqualTo(r.id());
			assertThat(joined.role()).isEqualTo(RoomMember.Role.PARTICIPANT);
			assertThat(joined.inviteCode()).isNull();
			assertThat(joined.memberCount()).isEqualTo(2);
			assertThat(joined.members()).extracting(RoomResponse.Member::nickname).containsExactly("주인", "손님");
			RoomMember m = memberMapper.findActive(r.id(), guest.getId()).orElseThrow();
			assertThat(m.getRole()).isEqualTo(RoomMember.Role.PARTICIPANT);
			assertThat(m.getJoinedAt()).isNotNull();
		}

		@Test
		void 재입장은_left_at_NULL_joined_at_갱신_행은_하나() {
			RoomResponse r = service.create(owner.getId(), null);
			service.join(guest.getId(), r.inviteCode());
			LocalDateTime first = memberMapper.findActive(r.id(), guest.getId()).orElseThrow().getJoinedAt();
			service.leave(guest.getId(), r.id());
			memberMapper.setJoinedAt(r.id(), guest.getId(), first.minusMinutes(1)); // 재입장 시각 차이 강제

			RoomResponse again = service.join(guest.getId(), r.inviteCode());

			assertThat(again.role()).isEqualTo(RoomMember.Role.PARTICIPANT);
			RoomMember m = memberMapper.findActive(r.id(), guest.getId()).orElseThrow();
			assertThat(m.getLeftAt()).isNull();
			assertThat(m.getJoinedAt()).isAfter(first.minusMinutes(1));
			assertThat(memberMapper.findActiveByRoomId(r.id())).hasSize(2);
		}

		@Test
		void 이미_멤버면_그대로_200_중복_없음() {
			RoomResponse r = service.create(owner.getId(), null);
			service.join(guest.getId(), r.inviteCode());

			RoomResponse again = service.join(guest.getId(), r.inviteCode());
			assertThat(again.memberCount()).isEqualTo(2);
			assertThat(memberMapper.findActiveByRoomId(r.id())).hasSize(2);
		}

		@Test
		void 코드_없음_INVITE_NOT_FOUND() {
			assertError(() -> service.join(guest.getId(), "ZZZZZZZZ"), ErrorCode.INVITE_NOT_FOUND);
			assertError(() -> service.join(guest.getId(), "zzz"), ErrorCode.INVITE_NOT_FOUND);
		}

		@Test
		void 본인_방은_SELF_INVITE_이미_멤버보다_우선() {
			RoomResponse r = service.create(owner.getId(), null);
			assertError(() -> service.join(owner.getId(), r.inviteCode()), ErrorCode.SELF_INVITE);
		}

		@Test
		void 정원_2명이면_ROOM_FULL() {
			RoomResponse r = service.create(owner.getId(), null);
			service.join(guest.getId(), r.inviteCode());

			assertError(() -> service.join(other.getId(), r.inviteCode()), ErrorCode.ROOM_FULL);
		}

		@Test
		void 개설자_이탈_방은_ROOM_ORPHANED_SELF_보다_우선() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());
			service.leave(owner.getId(), r.id());

			assertError(() -> service.join(other.getId(), r.inviteCode()), ErrorCode.ROOM_ORPHANED);
			assertError(() -> service.join(owner.getId(), r.inviteCode()), ErrorCode.ROOM_ORPHANED);
		}

		@Test
		void 입장자_활성_방_50개면_ROOM_LIMIT_EXCEEDED() {
			for (int i = 0; i < ChatRoomService.MAX_ACTIVE_ROOMS; i++) service.create(guest.getId(), "r" + i);
			RoomResponse r = service.create(owner.getId(), null);

			assertError(() -> service.join(guest.getId(), r.inviteCode()), ErrorCode.ROOM_LIMIT_EXCEEDED);
		}
	}

	@Nested
	@DisplayName("regenerateInvite")
	class Regenerate {

		@Test
		void 개설자_재발급_새_코드_구_코드는_INVITE_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			String old = r.inviteCode();

			InviteResponse res = service.regenerateInvite(owner.getId(), r.id());

			assertThat(res.inviteCode()).matches("[A-HJ-NP-Z2-9]{8}").isNotEqualTo(old);
			assertThat(res.inviteUrl()).isEqualTo("http://localhost:3000/join/" + res.inviteCode());
			assertThat(service.get(owner.getId(), r.id()).inviteCode()).isEqualTo(res.inviteCode());
			assertError(() -> service.join(guest.getId(), old), ErrorCode.INVITE_NOT_FOUND);
			assertThat(service.join(guest.getId(), res.inviteCode()).id()).isEqualTo(r.id());
		}

		@Test
		void 참여자는_FORBIDDEN_비멤버는_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertError(() -> service.regenerateInvite(guest.getId(), r.id()), ErrorCode.FORBIDDEN);
			assertError(() -> service.regenerateInvite(other.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
		}
	}
}
