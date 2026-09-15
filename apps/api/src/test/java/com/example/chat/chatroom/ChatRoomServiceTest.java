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

/** T-006 방 CRUD + 멤버십 규칙. AuthServiceTest 와 같이 실제 매퍼 위에서 @Transactional 롤백. */
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

	/** T-016 전이라 입장 API 가 없다 — 참여자는 매퍼로 직접 넣는다. */
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
	@DisplayName("updateTitle")
	class UpdateTitle {

		@Test
		void 개설자는_수정_참여자는_FORBIDDEN_비멤버는_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			join(r.id(), guest.getId());

			assertThat(service.updateTitle(owner.getId(), r.id(), "바꿈").title()).isEqualTo("바꿈");
			assertError(
				() -> service.updateTitle(guest.getId(), r.id(), "x"), ErrorCode.FORBIDDEN);
			assertError(
				() -> service.updateTitle(other.getId(), r.id(), "x"), ErrorCode.ROOM_NOT_FOUND);
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
		void 비멤버_또는_이미_나간_멤버는_NOT_FOUND() {
			RoomResponse r = service.create(owner.getId(), null);
			service.leave(owner.getId(), r.id());

			assertError(
				() -> service.leave(owner.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
			assertError(
				() -> service.leave(other.getId(), r.id()), ErrorCode.ROOM_NOT_FOUND);
		}
	}
}
