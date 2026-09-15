package com.example.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.chatroom.AiPersonality;
import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.ChatRoomMapper;
import com.example.chat.chatroom.InviteCodes;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMemberMapper;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.chatroom.RoomStatus;
import com.example.chat.message.Message;
import com.example.chat.message.MessageMapper;
import com.example.chat.persona.Persona;
import com.example.chat.persona.PersonaMapper;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * T-003/T-006 매퍼 왕복 테스트. 실제 MySQL(V2 스키마) 위에서 돌고 @Transactional 로 롤백된다.
 * 슬라이스(@MybatisTest) 대신 @SpringBootTest 를 쓴 이유: Boot 4 에서 테스트 DB 치환 애노테이션 패키지가
 * 바뀌어 import 위험이 있고, 컨텍스트 기동은 contextLoads 로 이미 검증됐다. 느려지면 T-006 이후 슬라이스로 전환.
 */
@SpringBootTest
@Transactional
class MapperTest {

	@Autowired UserMapper userMapper;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired MessageMapper messageMapper;
	@Autowired PersonaMapper personaMapper;

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	/** 방 + OWNER 멤버십. 서비스(ChatRoomService.create)가 하는 일을 매퍼 단위로 재현. */
	private ChatRoom newRoom(Long ownerId, String title) {
		ChatRoom r = ChatRoom.create(ownerId, title, InviteCodes.generate());
		roomMapper.insert(r);
		memberMapper.insert(RoomMember.owner(r.getId(), ownerId));
		return r;
	}

	private void join(Long roomId, Long userId) {
		memberMapper.insert(RoomMember.participant(roomId, userId));
	}

	@Nested
	@DisplayName("UserMapper")
	class Users {

		@Test
		void insert_후_findById_와_기본값() {
			User u = newUser("영선");

			assertThat(u.getId()).isNotNull();
			User found = userMapper.findById(u.getId()).orElseThrow();
			assertThat(found.getNickname()).isEqualTo("영선");
			assertThat(found.getRole()).isEqualTo(User.Role.USER);
			assertThat(found.getStatus()).isEqualTo(User.Status.ACTIVE);
			assertThat(found.getCreatedAt()).isNotNull();
			assertThat(found.getLastLoginAt()).isNull();
		}

		@Test
		void updateStatus_와_updateLastLoginAt() {
			User u = newUser("a");

			assertThat(userMapper.updateStatus(u.getId(), User.Status.SUSPENDED)).isEqualTo(1);
			assertThat(userMapper.updateLastLoginAt(u.getId())).isEqualTo(1);

			User found = userMapper.findById(u.getId()).orElseThrow();
			assertThat(found.isSuspended()).isTrue();
			assertThat(found.getLastLoginAt()).isNotNull();
		}

		@Test
		void 없는_id_는_empty() {
			assertThat(userMapper.findById(-1L)).isEmpty();
		}
	}


	@Nested
	@DisplayName("ChatRoomMapper")
	class Rooms {

		@Test
		void insert_는_기본값을_채우고_last_message_at_은_created_at_과_같다() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");

			ChatRoom found = roomMapper.findById(r.getId()).orElseThrow();
			assertThat(found.getOwnerId()).isEqualTo(me.getId());
			assertThat(found.getInviteCode()).isEqualTo(r.getInviteCode());
			assertThat(found.getAiPersonality()).isEqualTo(AiPersonality.RATIONAL);
			assertThat(found.getMode()).isEqualTo(RoomMode.AI);
			assertThat(found.getStatus()).isEqualTo(RoomStatus.ACTIVE);
			assertThat(found.getMessageCount()).isZero();
			assertThat(found.getLastMessageAt()).isEqualTo(found.getCreatedAt());
			assertThat(found.getMemberCount()).isEqualTo(1);
		}

		@Test
		void 활성_멤버만_조회되고_비멤버_및_나간_멤버는_empty() {
			User owner = newUser("owner");
			User guest = newUser("guest");
			User other = newUser("other");
			ChatRoom r = newRoom(owner.getId(), "방");
			join(r.getId(), guest.getId());

			assertThat(roomMapper.findByIdForMember(r.getId(), owner.getId())).isPresent();
			assertThat(roomMapper.findByIdForMember(r.getId(), guest.getId())).isPresent();
			assertThat(roomMapper.findByIdForMember(r.getId(), other.getId())).isEmpty();

			memberMapper.leave(r.getId(), guest.getId());
			assertThat(roomMapper.findByIdForMember(r.getId(), guest.getId())).isEmpty();
			assertThat(roomMapper.findByIdForMember(r.getId(), owner.getId()).orElseThrow().getMemberCount()).isEqualTo(1);
		}

		@Test
		void touchOnNewMessage_는_count_와_last_message_at_을_갱신() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");
			LocalDateTime before = roomMapper.findById(r.getId()).orElseThrow().getLastMessageAt();

			roomMapper.touchOnNewMessage(r.getId());
			roomMapper.touchOnNewMessage(r.getId());

			ChatRoom found = roomMapper.findById(r.getId()).orElseThrow();
			assertThat(found.getMessageCount()).isEqualTo(2);
			assertThat(found.getLastMessageAt()).isAfterOrEqualTo(before);
		}

		@Test
		void 목록은_내_활성_멤버십_방만_최근_대화순_그리고_키셋_커서로_중복_없이() {
			User me = newUser("me");
			User other = newUser("other");
			ChatRoom r1 = newRoom(me.getId(), "1");
			ChatRoom r2 = newRoom(me.getId(), "2");
			ChatRoom r3 = newRoom(me.getId(), "3");
			ChatRoom joined = newRoom(other.getId(), "other 의 방");
			join(joined.getId(), me.getId());
			ChatRoom left = newRoom(other.getId(), "나간 방");
			join(left.getId(), me.getId());
			memberMapper.leave(left.getId(), me.getId());
			newRoom(other.getId(), "남의 방");
			// 같은 last_message_at 을 강제해 (last_message_at, id) 키셋이 필요한 상황을 만든다
			roomMapper.touchOnNewMessage(r1.getId());
			LocalDateTime same = roomMapper.findById(r1.getId()).orElseThrow().getLastMessageAt();
			roomMapper.setLastMessageAt(r2.getId(), same);
			roomMapper.setLastMessageAt(joined.getId(), same);

			List<ChatRoom> page1 = roomMapper.findListByMember(me.getId(), null, null, 2);
			assertThat(page1).extracting(ChatRoom::getId).containsExactly(joined.getId(), r2.getId());
			ChatRoom last = page1.get(page1.size() - 1);

			List<ChatRoom> page2 = roomMapper.findListByMember(me.getId(), last.getLastMessageAt(), last.getId(), 2);
			assertThat(page2).extracting(ChatRoom::getId).containsExactly(r1.getId(), r3.getId());
			assertThat(page2.get(0).getMemberCount()).isEqualTo(1);

			ChatRoom last2 = page2.get(page2.size() - 1);
			assertThat(roomMapper.findListByMember(me.getId(), last2.getLastMessageAt(), last2.getId(), 2)).isEmpty();
		}

		@Test
		void updateTitle_updateStatus_그리고_autoTitle() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), ChatRoom.autoTitle("  오늘   뭐 먹지\n고민이야 " + "x".repeat(50)));
			assertThat(r.getTitle()).hasSize(ChatRoom.AUTO_TITLE_LENGTH).startsWith("오늘 뭐 먹지 고민이야");

			assertThat(roomMapper.updateTitle(r.getId(), "새 제목")).isEqualTo(1);
			assertThat(roomMapper.updateStatus(r.getId(), RoomStatus.ORPHANED)).isEqualTo(1);
			ChatRoom found = roomMapper.findById(r.getId()).orElseThrow();
			assertThat(found.getTitle()).isEqualTo("새 제목");
			assertThat(found.getStatus()).isEqualTo(RoomStatus.ORPHANED);
			assertThat(ChatRoom.autoTitle("   ")).isEqualTo("새 대화");
		}

		@Test
		void invite_code_는_유일하다() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");
			ChatRoom dup = ChatRoom.create(me.getId(), "중복", r.getInviteCode());

			org.assertj.core.api.Assertions.assertThatThrownBy(() -> roomMapper.insert(dup))
				.isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
		}
	}

	@Nested
	@DisplayName("RoomMemberMapper")
	class Members {

		@Test
		void 활성_멤버_목록은_닉네임_포함_가입순() {
			User owner = newUser("주인");
			User guest = newUser("손님");
			ChatRoom r = newRoom(owner.getId(), "방");
			join(r.getId(), guest.getId());

			List<RoomMember> members = memberMapper.findActiveByRoomId(r.getId());
			assertThat(members).extracting(RoomMember::getUserId).containsExactly(owner.getId(), guest.getId());
			assertThat(members).extracting(RoomMember::getNickname).containsExactly("주인", "손님");
			assertThat(members).extracting(RoomMember::getRole)
				.containsExactly(RoomMember.Role.OWNER, RoomMember.Role.PARTICIPANT);
			assertThat(members.get(0).getJoinedAt()).isNotNull();
			assertThat(members.get(0).getLeftAt()).isNull();
		}

		@Test
		void findActive_와_leave_와_countActiveByUserId() {
			User owner = newUser("주인");
			User guest = newUser("손님");
			ChatRoom r = newRoom(owner.getId(), "방");
			newRoom(owner.getId(), "방2");
			join(r.getId(), guest.getId());

			assertThat(memberMapper.countActiveByUserId(owner.getId())).isEqualTo(2);
			assertThat(memberMapper.countActiveByUserId(guest.getId())).isEqualTo(1);
			assertThat(memberMapper.findActive(r.getId(), guest.getId()).orElseThrow().getRole())
				.isEqualTo(RoomMember.Role.PARTICIPANT);

			assertThat(memberMapper.leave(r.getId(), guest.getId())).isEqualTo(1);
			assertThat(memberMapper.leave(r.getId(), guest.getId())).isZero(); // 두 번 나가기는 무효
			assertThat(memberMapper.findActive(r.getId(), guest.getId())).isEmpty();
			assertThat(memberMapper.countActiveByUserId(guest.getId())).isZero();
			assertThat(memberMapper.findActiveByRoomId(r.getId())).hasSize(1);
		}

		@Test
		void 방당_유저_1행_UNIQUE() {
			User owner = newUser("주인");
			ChatRoom r = newRoom(owner.getId(), "방");

			org.assertj.core.api.Assertions.assertThatThrownBy(() -> join(r.getId(), owner.getId()))
				.isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
		}
	}

	@Nested
	@DisplayName("MessageMapper")
	class Messages {

		@Test
		void insert_와_페이지_커서_컨텍스트() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");
			Message m1 = Message.user(r.getId(), me.getId(), "안녕", Message.InputType.VOICE, RoomMode.AI);
			Message m2 = Message.assistant(r.getId(), "안녕하세요!", "chat-default", 12, 5);
			Message m3 = Message.user(r.getId(), me.getId(), "뭐해", Message.InputType.TEXT, RoomMode.HUMAN);
			messageMapper.insert(m1);
			messageMapper.insert(m2);
			messageMapper.insert(m3);

			assertThat(messageMapper.countByRoomId(r.getId())).isEqualTo(3);

			// 최신부터 2개
			List<Message> first = messageMapper.findByRoomId(r.getId(), null, 2);
			assertThat(first).extracting(Message::getId).containsExactly(m3.getId(), m2.getId());
			assertThat(first.get(0).getSenderUserId()).isEqualTo(me.getId());
			assertThat(first.get(0).getMode()).isEqualTo(RoomMode.HUMAN);
			assertThat(first.get(1).getRole()).isEqualTo(Message.Role.ASSISTANT);
			assertThat(first.get(1).getSenderUserId()).isNull();
			assertThat(first.get(1).getMode()).isNull();
			assertThat(first.get(1).getModel()).isEqualTo("chat-default");
			assertThat(first.get(1).getPromptTokens()).isEqualTo(12);
			assertThat(first.get(1).getInputType()).isNull();

			// 커서 이후
			List<Message> next = messageMapper.findByRoomId(r.getId(), m2.getId(), 2);
			assertThat(next).extracting(Message::getId).containsExactly(m1.getId());
			assertThat(next.get(0).getInputType()).isEqualTo(Message.InputType.VOICE);

			// LLM 컨텍스트: 최근 N개 (DESC)
			assertThat(messageMapper.findRecentByRoomId(r.getId(), 2))
				.extracting(Message::getId).containsExactly(m3.getId(), m2.getId());
		}
	}

	@Nested
	@DisplayName("PersonaMapper")
	class Personas {

		@Test
		void 시드_기본_페르소나가_활성이다() {
			Persona active = personaMapper.findActive().orElseThrow();
			assertThat(active.isActive()).isTrue();
			assertThat(active.getSystemPrompt()).isNotBlank();
		}

		@Test
		void 활성화는_항상_하나만() {
			Persona before = personaMapper.findActive().orElseThrow();
			Persona p = Persona.builder().name("차분").systemPrompt("차분하게 답해.").build();
			personaMapper.insert(p);

			personaMapper.deactivateAll();
			personaMapper.activate(p.getId());

			assertThat(personaMapper.findActive().orElseThrow().getId()).isEqualTo(p.getId());
			assertThat(personaMapper.findById(before.getId()).orElseThrow().isActive()).isFalse();
			assertThat(personaMapper.findAll()).extracting(Persona::isActive).containsOnlyOnce(true);
		}

		@Test
		void 활성_페르소나는_삭제되지_않는다() {
			Persona active = personaMapper.findActive().orElseThrow();
			Persona p = Persona.builder().name("임시").systemPrompt("x").build();
			personaMapper.insert(p);

			assertThat(personaMapper.deleteById(active.getId())).isZero();
			assertThat(personaMapper.deleteById(p.getId())).isEqualTo(1);
			assertThat(personaMapper.findById(p.getId())).isEmpty();
		}

		@Test
		void update_는_이름과_프롬프트만_바꾼다() {
			Persona p = Persona.builder().name("a").systemPrompt("a").build();
			personaMapper.insert(p);
			p.setName("b");
			p.setSystemPrompt("b-prompt");
			p.setActive(true); // update 에서 무시되어야 함

			personaMapper.update(p);

			Persona found = personaMapper.findById(p.getId()).orElseThrow();
			assertThat(found.getName()).isEqualTo("b");
			assertThat(found.getSystemPrompt()).isEqualTo("b-prompt");
			assertThat(found.isActive()).isFalse();
		}
	}
}
