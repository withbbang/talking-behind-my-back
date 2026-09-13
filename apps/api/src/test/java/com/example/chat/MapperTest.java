package com.example.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.ChatRoomMapper;
import com.example.chat.message.Message;
import com.example.chat.message.MessageMapper;
import com.example.chat.persona.Persona;
import com.example.chat.persona.PersonaMapper;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * T-003 매퍼 왕복 테스트. 실제 MySQL(V1 스키마) 위에서 돌고 @Transactional 로 롤백된다.
 * 슬라이스(@MybatisTest) 대신 @SpringBootTest 를 쓴 이유: Boot 4 에서 테스트 DB 치환 애노테이션 패키지가
 * 바뀌어 import 위험이 있고, 컨텍스트 기동은 contextLoads 로 이미 검증됐다. 느려지면 T-006 이후 슬라이스로 전환.
 */
@SpringBootTest
@Transactional
class MapperTest {

	@Autowired UserMapper userMapper;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired MessageMapper messageMapper;
	@Autowired PersonaMapper personaMapper;

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	private ChatRoom newRoom(Long userId, String title) {
		ChatRoom r = ChatRoom.builder().userId(userId).title(title).build();
		roomMapper.insert(r);
		return r;
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
		void 소유자만_조회되고_타인은_empty() {
			User me = newUser("me");
			User other = newUser("other");
			ChatRoom r = newRoom(me.getId(), "내 방");

			assertThat(roomMapper.findByIdAndUserId(r.getId(), me.getId())).isPresent();
			assertThat(roomMapper.findByIdAndUserId(r.getId(), other.getId())).isEmpty();
		}

		@Test
		void touchOnNewMessage_는_count_와_last_message_at_을_갱신() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");

			roomMapper.touchOnNewMessage(r.getId());
			roomMapper.touchOnNewMessage(r.getId());

			ChatRoom found = roomMapper.findByIdAndUserId(r.getId(), me.getId()).orElseThrow();
			assertThat(found.getMessageCount()).isEqualTo(2);
			assertThat(found.getLastMessageAt()).isNotNull();
		}

		@Test
		void softDelete_후_조회_안됨_및_목록_제외() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");

			assertThat(roomMapper.softDelete(r.getId(), me.getId())).isEqualTo(1);
			assertThat(roomMapper.findByIdAndUserId(r.getId(), me.getId())).isEmpty();
			assertThat(roomMapper.findByUserId(me.getId(), null, 10)).isEmpty();
			// 이미 삭제된 방은 두 번 삭제되지 않는다
			assertThat(roomMapper.softDelete(r.getId(), me.getId())).isZero();
		}

		@Test
		void 목록은_최근_대화순_그리고_커서() {
			User me = newUser("me");
			ChatRoom r1 = newRoom(me.getId(), "1");
			ChatRoom r2 = newRoom(me.getId(), "2");
			ChatRoom r3 = newRoom(me.getId(), "3");
			roomMapper.touchOnNewMessage(r1.getId()); // r1 이 가장 최근 대화

			List<ChatRoom> page = roomMapper.findByUserId(me.getId(), null, 10);
			assertThat(page).extracting(ChatRoom::getId).containsExactly(r1.getId(), r3.getId(), r2.getId());

			// cursorId = id < cursor 필터 (정렬 키셋이 아님 — ChatRoomMapper javadoc). r3 이전 id 인 r1, r2 가 정렬 순서로.
			List<ChatRoom> after = roomMapper.findByUserId(me.getId(), r3.getId(), 10);
			assertThat(after).extracting(ChatRoom::getId).containsExactly(r1.getId(), r2.getId());
		}

		@Test
		void updateTitle_과_autoTitle() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), ChatRoom.autoTitle("  오늘   뭐 먹지\n고민이야 " + "x".repeat(50)));
			assertThat(r.getTitle()).hasSize(ChatRoom.AUTO_TITLE_LENGTH).startsWith("오늘 뭐 먹지 고민이야");

			assertThat(roomMapper.updateTitle(r.getId(), me.getId(), "새 제목")).isEqualTo(1);
			assertThat(roomMapper.findByIdAndUserId(r.getId(), me.getId()).orElseThrow().getTitle()).isEqualTo("새 제목");
			assertThat(ChatRoom.autoTitle("   ")).isEqualTo("새 대화");
		}
	}

	@Nested
	@DisplayName("MessageMapper")
	class Messages {

		@Test
		void insert_와_페이지_커서_컨텍스트() {
			User me = newUser("me");
			ChatRoom r = newRoom(me.getId(), "방");
			Message m1 = Message.user(r.getId(), "안녕", Message.InputType.VOICE);
			Message m2 = Message.assistant(r.getId(), "안녕하세요!", "chat-default", 12, 5);
			Message m3 = Message.user(r.getId(), "뭐해", Message.InputType.TEXT);
			messageMapper.insert(m1);
			messageMapper.insert(m2);
			messageMapper.insert(m3);

			assertThat(messageMapper.countByRoomId(r.getId())).isEqualTo(3);

			// 최신부터 2개
			List<Message> first = messageMapper.findByRoomId(r.getId(), null, 2);
			assertThat(first).extracting(Message::getId).containsExactly(m3.getId(), m2.getId());
			assertThat(first.get(1).getRole()).isEqualTo(Message.Role.ASSISTANT);
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
