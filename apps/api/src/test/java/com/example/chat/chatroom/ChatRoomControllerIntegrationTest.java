package com.example.chat.chatroom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.JwtProvider;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.Cookie;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * /rooms HTTP 계약 (API.md#rooms) — 실제 SecurityConfig + JwtAuthFilter 위에서. 상태 코드·에러 코드·JSON 형식·페이지 경계.
 * 비즈니스 규칙 상세는 ChatRoomServiceTest.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ChatRoomControllerIntegrationTest {

	private static final String ISO_UTC = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z";

	@Autowired MockMvc mvc;
	@Autowired JwtProvider jwtProvider;
	@Autowired UserMapper userMapper;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired ObjectMapper objectMapper;

	private User owner;
	private User guest;

	@BeforeEach
	void users() {
		owner = newUser("주인");
		guest = newUser("손님");
	}

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	private Cookie access(User u) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(u.getId(), u.getRole()));
	}

	private JsonNode createRoom(User u, String body) throws Exception {
		var req = post("/rooms").cookie(access(u)).contentType(MediaType.APPLICATION_JSON);
		if (body != null) req.content(body);
		String json = mvc.perform(req).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		return objectMapper.readTree(json);
	}

	@Test
	void 미인증은_401_UNAUTHENTICATED() throws Exception {
		mvc.perform(get("/rooms"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		mvc.perform(post("/rooms"))
			.andExpect(status().isUnauthorized());
	}

	@Nested
	@DisplayName("POST /rooms")
	class Create {

		@Test
		void body_없이_201_Room_시간은_UTC_Z() throws Exception {
			mvc.perform(post("/rooms").cookie(access(owner)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.title").value("새 대화"))
				.andExpect(jsonPath("$.role").value("OWNER"))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.mode").value("AI"))
				.andExpect(jsonPath("$.aiPersonality").value("RATIONAL"))
				.andExpect(jsonPath("$.inviteCode", matchesPattern("[A-HJ-NP-Z2-9]{8}")))
				.andExpect(jsonPath("$.inviteUrl", matchesPattern("http://localhost:3000/join/[A-HJ-NP-Z2-9]{8}")))
				.andExpect(jsonPath("$.members.length()").value(1))
				.andExpect(jsonPath("$.members[0].nickname").value("주인"))
				.andExpect(jsonPath("$.members[0].role").value("OWNER"))
				.andExpect(jsonPath("$.memberCount").value(1))
				.andExpect(jsonPath("$.messageCount").value(0))
				.andExpect(jsonPath("$.lastMessageAt", matchesPattern(ISO_UTC)))
				.andExpect(jsonPath("$.createdAt", matchesPattern(ISO_UTC)));
		}

		@Test
		void title_지정() throws Exception {
			mvc.perform(post("/rooms").cookie(access(owner))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"점심\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.title").value("점심"));
		}

		@Test
		void title_101자는_400() throws Exception {
			mvc.perform(post("/rooms").cookie(access(owner))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"" + "x".repeat(101) + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.title").isString());
		}

		@Test
		void 활성_방_50개_초과는_409_ROOM_LIMIT_EXCEEDED() throws Exception {
			for (int i = 0; i < ChatRoomService.MAX_ACTIVE_ROOMS; i++) createRoom(owner, null);

			mvc.perform(post("/rooms").cookie(access(owner)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ROOM_LIMIT_EXCEEDED"));
		}
	}

	@Nested
	@DisplayName("GET /rooms")
	class ListRooms {

		@Test
		void 같은_last_message_at_경계에서_중복_누락_없음_그리고_항목은_memberCount_만() throws Exception {
			List<Long> ids = new ArrayList<>();
			for (int i = 0; i < 5; i++) ids.add(createRoom(owner, null).get("id").asLong());
			LocalDateTime same = roomMapper.findById(ids.get(0)).orElseThrow().getLastMessageAt();
			for (Long id : ids) roomMapper.setLastMessageAt(id, same);

			List<Long> seen = new ArrayList<>();
			String cursor = null;
			do {
				var req = get("/rooms").cookie(access(owner)).param("size", "2");
				if (cursor != null) req.param("cursor", cursor);
				JsonNode page = objectMapper.readTree(
					mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
				page.get("items").forEach(item -> {
					seen.add(item.get("id").asLong());
					assertThat(item.get("members").isNull()).isTrue();
					assertThat(item.get("memberCount").asInt()).isEqualTo(1);
				});
				cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
			} while (cursor != null);

			assertThat(seen).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(ids);
		}

		@Test
		void 잘못된_커서는_400_size_범위_밖은_clamp() throws Exception {
			mvc.perform(get("/rooms").cookie(access(owner)).param("cursor", "%%%"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
			mvc.perform(get("/rooms").cookie(access(owner)).param("size", "9999"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isArray())
				.andExpect(jsonPath("$.nextCursor").value((Object) null));
		}
	}

	@Nested
	@DisplayName("GET /rooms/{id}")
	class Detail {

		@Test
		void 개설자_200_참여자는_inviteCode_null_비멤버_404() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();
			memberMapper.insert(RoomMember.participant(id, guest.getId()));

			mvc.perform(get("/rooms/" + id).cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.role").value("OWNER"))
				.andExpect(jsonPath("$.inviteCode").isString())
				.andExpect(jsonPath("$.members.length()").value(2));
			mvc.perform(get("/rooms/" + id).cookie(access(guest)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.role").value("PARTICIPANT"))
				.andExpect(jsonPath("$.inviteCode").value((Object) null))
				.andExpect(jsonPath("$.inviteUrl").value((Object) null));
			mvc.perform(get("/rooms/" + id).cookie(access(newUser("남"))))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
			mvc.perform(get("/rooms/999999999").cookie(access(owner)))
				.andExpect(status().isNotFound());
		}
	}

	@Nested
	@DisplayName("PATCH /rooms/{id}")
	class Patch {

		@Test
		void 개설자_title_수정_200() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();

			mvc.perform(patch("/rooms/" + id).cookie(access(owner))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"바꿈\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("바꿈"));
		}

		@Test
		void 공백_또는_101자_title_은_400_VALIDATION_FAILED() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();

			mvc.perform(patch("/rooms/" + id).cookie(access(owner))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"   \"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.title").isString());
			mvc.perform(patch("/rooms/" + id).cookie(access(owner))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"" + "x".repeat(101) + "\"}"))
				.andExpect(status().isBadRequest());
		}

		@Test
		void 참여자는_403_FORBIDDEN_비멤버는_404() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();
			memberMapper.insert(RoomMember.participant(id, guest.getId()));

			mvc.perform(patch("/rooms/" + id).cookie(access(guest))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"x\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));
			mvc.perform(patch("/rooms/" + id).cookie(access(newUser("남")))
					.contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"x\"}"))
				.andExpect(status().isNotFound());
		}
	}

	@Nested
	@DisplayName("DELETE /rooms/{id}")
	class Leave {

		@Test
		void 개설자_나가기_204_이후_404_방은_ORPHANED_참여자는_여전히_200() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();
			memberMapper.insert(RoomMember.participant(id, guest.getId()));

			mvc.perform(delete("/rooms/" + id).cookie(access(owner))).andExpect(status().isNoContent());
			mvc.perform(get("/rooms/" + id).cookie(access(owner))).andExpect(status().isNotFound());
			mvc.perform(delete("/rooms/" + id).cookie(access(owner))).andExpect(status().isNotFound());
			mvc.perform(get("/rooms/" + id).cookie(access(guest)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ORPHANED"))
				.andExpect(jsonPath("$.memberCount").value(1));
		}

		@Test
		void 참여자_나가기는_멤버십만_종료() throws Exception {
			long id = createRoom(owner, null).get("id").asLong();
			memberMapper.insert(RoomMember.participant(id, guest.getId()));

			mvc.perform(delete("/rooms/" + id).cookie(access(guest))).andExpect(status().isNoContent());
			mvc.perform(get("/rooms/" + id).cookie(access(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.memberCount").value(1));
		}
	}
}
