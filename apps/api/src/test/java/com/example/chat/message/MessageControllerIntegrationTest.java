package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.JwtProvider;
import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.ChatRoomMapper;
import com.example.chat.chatroom.InviteCodes;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMemberMapper;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * /rooms/{id}/messages · /rooms/{id}/events HTTP 계약 (API.md#messages). 실제 SecurityConfig 위에서.
 * 규칙 상세는 MessageServiceTest. AI 잡은 SyncAiTestConfig(동기 + FakeLlm).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(SyncAiTestConfig.class)
@Transactional
class MessageControllerIntegrationTest {

	private static final String ISO_UTC = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z";

	@Autowired MockMvc mvc;
	@Autowired JwtProvider jwtProvider;
	@Autowired UserMapper userMapper;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired MessageMapper messageMapper;
	@Autowired SyncAiTestConfig.FakeLlm llm;

	private User owner;
	private User other;
	private ChatRoom room;

	@BeforeEach
	void setUp() {
		llm.reset();
		owner = newUser("주인");
		other = newUser("남");
		room = ChatRoom.create(owner.getId(), null, InviteCodes.generate());
		roomMapper.insert(room);
		memberMapper.insert(RoomMember.owner(room.getId(), owner.getId()));
	}

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	private Cookie access(User u) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(u.getId(), u.getRole()));
	}

	private String messagesPath() {
		return "/rooms/" + room.getId() + "/messages";
	}

	@Test
	void 미인증은_401() throws Exception {
		mvc.perform(get(messagesPath())).andExpect(status().isUnauthorized());
		mvc.perform(post(messagesPath()).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/rooms/" + room.getId() + "/events")).andExpect(status().isUnauthorized());
	}

	@Nested
	@DisplayName("GET /rooms/{id}/messages")
	class History {

		@Test
		void 상대의_AI_모드_질문과_답은_안_내려온다() throws Exception {
			memberMapper.insert(RoomMember.participant(room.getId(), other.getId()));
			messageMapper.insert(Message.user(room.getId(), other.getId(), "상대의 비밀 질문", Message.InputType.TEXT, RoomMode.AI));
			messageMapper.insert(Message.assistant(room.getId(), other.getId(), "상대에게 준 답", "m", 1, 1));
			messageMapper.insert(Message.user(room.getId(), owner.getId(), "내 질문", Message.InputType.TEXT, RoomMode.AI));

			mvc.perform(get(messagesPath()).cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].content").value("내 질문"));
		}

		@Test
		void 최신_먼저_커서_페이지_시간은_UTC_Z() throws Exception {
			for (int i = 0; i < 3; i++) {
				messageMapper.insert(Message.user(room.getId(), owner.getId(), "m" + i, Message.InputType.TEXT, RoomMode.AI));
			}
			MvcResult first = mvc.perform(get(messagesPath()).param("size", "2").cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].content").value("m2"))
				.andExpect(jsonPath("$.items[0].role").value("USER"))
				.andExpect(jsonPath("$.items[0].senderUserId").value(owner.getId()))
				.andExpect(jsonPath("$.items[0].inputType").value("TEXT"))
				.andExpect(jsonPath("$.items[0].mode").value("AI"))
				.andExpect(jsonPath("$.items[0].createdAt").value(org.hamcrest.Matchers.matchesPattern(ISO_UTC)))
				.andExpect(jsonPath("$.nextCursor").isString())
				.andReturn();
			String cursor = tools.jackson.databind.json.JsonMapper.shared()
				.readTree(first.getResponse().getContentAsString()).get("nextCursor").asString();

			mvc.perform(get(messagesPath()).param("size", "2").param("cursor", cursor).cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].content").value("m0"))
				.andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()));
		}

		@Test
		void 나간_멤버의_메시지도_senderNickname_유지_ASSISTANT_는_null() throws Exception {
			memberMapper.insert(RoomMember.participant(room.getId(), other.getId()));
			// HUMAN 모드 = 방 전원 공개, AI 답은 개설자 것 — 둘 다 개설자에게 보인다(D-037)
			messageMapper.insert(Message.user(room.getId(), other.getId(), "남이 한 말", Message.InputType.TEXT, RoomMode.HUMAN));
			messageMapper.insert(Message.assistant(room.getId(), owner.getId(), "AI 답", "m", 1, 1));
			memberMapper.leave(room.getId(), other.getId());

			mvc.perform(get(messagesPath()).cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].role").value("ASSISTANT"))
				.andExpect(jsonPath("$.items[0].senderNickname").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.items[1].senderUserId").value(other.getId()))
				.andExpect(jsonPath("$.items[1].senderNickname").value("남"));
		}

		@Test
		void 비멤버_404_잘못된_커서_400() throws Exception {
			mvc.perform(get(messagesPath()).cookie(access(other)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
			mvc.perform(get(messagesPath()).param("cursor", "!!bad").cookie(access(owner)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
		}
	}

	@Nested
	@DisplayName("POST /rooms/{id}/messages")
	class Send {

		private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder send(User u, String body) {
			return post(messagesPath()).cookie(access(u)).contentType(MediaType.APPLICATION_JSON).content(body);
		}

		@Test
		void AI_모드_202_messageId_잡이_돌아_ASSISTANT_저장() throws Exception {
			llm.reply("안녕", "!");
			mvc.perform(send(owner, "{\"content\":\"안녕\",\"inputType\":\"TEXT\"}"))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.messageId").isNumber());
			assertThat(messageMapper.countByRoomId(room.getId())).isEqualTo(2);
			assertThat(llm.calls).hasSize(1);
		}

		@Test
		void inputType_생략은_TEXT() throws Exception {
			llm.reply("ok");
			mvc.perform(send(owner, "{\"content\":\"안녕\"}")).andExpect(status().isAccepted());
			Message saved = messageMapper.findRecentByRoomId(room.getId(), 2).get(1);
			assertThat(saved.getInputType()).isEqualTo(Message.InputType.TEXT);
		}

		@Test
		void 검증_빈_content_4001자_잘못된_inputType_은_400() throws Exception {
			mvc.perform(send(owner, "{\"content\":\"   \"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.content").exists());
			mvc.perform(send(owner, "{\"content\":\"" + "가".repeat(4001) + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.details.content").exists());
			mvc.perform(send(owner, "{\"content\":\"hi\",\"inputType\":\"AUDIO\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
			assertThat(messageMapper.countByRoomId(room.getId())).isZero();
		}

		@Test
		void 비멤버_404() throws Exception {
			mvc.perform(send(other, "{\"content\":\"hi\"}"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
		}
	}

	@Nested
	@DisplayName("GET /rooms/{id}/events")
	class Events {

		@Test
		void 멤버는_event_stream_으로_비동기_시작() throws Exception {
			MvcResult r = mvc.perform(get("/rooms/" + room.getId() + "/events").cookie(access(owner)))
				.andExpect(request().asyncStarted())
				.andReturn();
			assertThat(r.getResponse().getContentType()).startsWith("text/event-stream");
		}

		@Test
		void 비멤버_404() throws Exception {
			mvc.perform(get("/rooms/" + room.getId() + "/events").cookie(access(other)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
		}

		/**
		 * SSE 클라이언트가 끊기면 톰캣이 ASYNC/ERROR 디스패치로 필터 체인을 다시 태운다. JwtAuthFilter 는 async 디스패치를
		 * 건너뛰므로 익명 → 시큐리티가 401 을 쓰려다 "response already committed" ERROR 를 남겼다(T-007 QA 실서버).
		 * 시큐리티는 REQUEST 디스패치에서만 판정해야 한다 — ERROR 디스패치는 401 이 아니라 원래 처리(여기선 404)로 간다.
		 */
		@Test
		void ASYNC_ERROR_디스패치는_시큐리티가_막지_않는다() throws Exception {
			mvc.perform(get("/nope").with(req -> { req.setDispatcherType(jakarta.servlet.DispatcherType.ERROR); return req; }))
				.andExpect(status().isNotFound());
			mvc.perform(get("/nope").with(req -> { req.setDispatcherType(jakarta.servlet.DispatcherType.ASYNC); return req; }))
				.andExpect(status().isNotFound());
			mvc.perform(get("/nope")).andExpect(status().isUnauthorized());   // 일반 REQUEST 는 여전히 401
		}
	}
}
