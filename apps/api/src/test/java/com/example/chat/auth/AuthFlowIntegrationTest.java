package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.chat.auth.oauth2.OAuth2UserInfo;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * 실제 SecurityConfig + 필터 체인으로 /auth/* 흐름 검증 (T-004 acceptance).
 * 소셜 콜백 자체는 공급자 왕복이 필요해 여기서 안 다룬다 — 핸들러 단위 테스트(OAuth2HandlersTest) 로 대체.
 * 로그인 상태는 AuthService.loginBySocial 로 만든 사용자 + JwtProvider/RefreshTokenService 가 만든 토큰을 쿠키로 넣는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowIntegrationTest {

	@Autowired MockMvc mvc;
	@Autowired AuthService authService;
	@Autowired RefreshTokenService refreshTokenService;
	@Autowired JwtProvider jwtProvider;
	@Autowired JwtProperties jwtProperties;
	@Autowired UserMapper userMapper;

	private User user;

	@BeforeEach
	void login() {
		user = authService.loginBySocial(
			new OAuth2UserInfo(SocialAccount.Provider.NAVER, "n-1", "n@example.com", "네이버", "https://img/n.png"));
	}

	private Cookie access() {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(user.getId(), user.getRole()));
	}

	private Cookie refresh(String raw) {
		return new Cookie(AuthCookies.REFRESH, raw);
	}

	@Nested
	@DisplayName("GET /auth/me")
	class Me {

		@Test
		void 미인증이면_401_JSON() throws Exception {
			mvc.perform(get("/auth/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		}

		@Test
		void 만료_access_는_401_TOKEN_EXPIRED() throws Exception {
			JwtProvider expired = new JwtProvider(
				new JwtProperties(jwtProperties.secret(), Duration.ofSeconds(-1), jwtProperties.refreshTtl()));
			mvc.perform(get("/auth/me")
					.cookie(new Cookie(AuthCookies.ACCESS, expired.createAccessToken(user.getId(), user.getRole()))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("TOKEN_EXPIRED"));
		}

		@Test
		void 인증되면_사용자_정보_와_provider() throws Exception {
			mvc.perform(get("/auth/me").cookie(access()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(user.getId()))
				.andExpect(jsonPath("$.nickname").value("네이버"))
				.andExpect(jsonPath("$.profileImageUrl").value("https://img/n.png"))
				.andExpect(jsonPath("$.role").value("USER"))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.provider").value("NAVER"));
		}

		@Test
		void 정지_회원은_me_는_200_다른_경로는_403_USER_SUSPENDED() throws Exception {
			userMapper.updateStatus(user.getId(), User.Status.SUSPENDED);

			mvc.perform(get("/auth/me").cookie(access()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("SUSPENDED"));

			mvc.perform(get("/rooms").cookie(access()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("USER_SUSPENDED"));
		}

		@Test
		void 일반_회원은_admin_경로_403() throws Exception {
			mvc.perform(get("/admin/stats").cookie(access()))
				.andExpect(status().isForbidden());
		}
	}

	@Nested
	@DisplayName("POST /auth/refresh")
	class Refresh {

		@Test
		void 쿠키_없으면_401_UNAUTHENTICATED() throws Exception {
			mvc.perform(post("/auth/refresh"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		}

		@Test
		void 유효한_refresh_면_새_access_새_refresh_쿠키_204() throws Exception {
			String raw = refreshTokenService.issue(user.getId());

			MvcResult result = mvc.perform(post("/auth/refresh").cookie(refresh(raw)))
				.andExpect(status().isNoContent())
				.andExpect(cookie().exists(AuthCookies.ACCESS))
				.andExpect(cookie().exists(AuthCookies.REFRESH))
				.andExpect(cookie().httpOnly(AuthCookies.ACCESS, true))
				.andExpect(cookie().path(AuthCookies.REFRESH, "/api/auth"))
				.andReturn();

			String newRaw = result.getResponse().getCookie(AuthCookies.REFRESH).getValue();
			assertThat(newRaw).isNotEqualTo(raw);
			String newAccess = result.getResponse().getCookie(AuthCookies.ACCESS).getValue();
			assertThat(jwtProvider.parseAccessToken(newAccess).userId()).isEqualTo(user.getId());

			// 새 access 로 me 가 된다
			mvc.perform(get("/auth/me").cookie(new Cookie(AuthCookies.ACCESS, newAccess)))
				.andExpect(status().isOk());
		}

		@Test
		void 구_refresh_재사용은_401_TOKEN_REUSED_쿠키_삭제_그리고_최신_토큰도_무효() throws Exception {
			String first = refreshTokenService.issue(user.getId());
			String second = mvc.perform(post("/auth/refresh").cookie(refresh(first)))
				.andReturn().getResponse().getCookie(AuthCookies.REFRESH).getValue();

			mvc.perform(post("/auth/refresh").cookie(refresh(first)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("TOKEN_REUSED"))
				.andExpect(cookie().maxAge(AuthCookies.ACCESS, 0))
				.andExpect(cookie().maxAge(AuthCookies.REFRESH, 0));

			mvc.perform(post("/auth/refresh").cookie(refresh(second)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("TOKEN_REUSED"));
		}

		@Test
		void 모르는_refresh_는_401_UNAUTHENTICATED() throws Exception {
			mvc.perform(post("/auth/refresh").cookie(refresh("garbage")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		}
	}

	@Nested
	@DisplayName("POST /auth/logout")
	class Logout {

		@Test
		void 쿠키_삭제_refresh_revoke_204_이후_refresh_불가() throws Exception {
			String raw = refreshTokenService.issue(user.getId());

			MvcResult result = mvc.perform(post("/auth/logout").cookie(access(), refresh(raw)))
				.andExpect(status().isNoContent())
				.andExpect(cookie().maxAge(AuthCookies.ACCESS, 0))
				.andExpect(cookie().maxAge(AuthCookies.REFRESH, 0))
				.andReturn();
			assertThat(result.getResponse().getHeaders("Set-Cookie")).hasSize(2);

			mvc.perform(post("/auth/refresh").cookie(refresh(raw)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("TOKEN_REUSED"));
		}

		@Test
		void 인증_없이도_204() throws Exception {
			mvc.perform(post("/auth/logout"))
				.andExpect(status().isNoContent());
		}
	}

	@Nested
	@DisplayName("OAuth2 진입")
	class OAuth2Entry {

		@Test
		void 로그인_시작은_공급자로_302_그리고_서명_쿠키_세션_없음() throws Exception {
			MvcResult result = mvc.perform(get("/oauth2/authorization/kakao"))
				.andExpect(status().is3xxRedirection())
				.andExpect(cookie().exists("oauth2_auth_request"))
				.andExpect(cookie().httpOnly("oauth2_auth_request", true))
				.andReturn();

			assertThat(result.getResponse().getRedirectedUrl()).startsWith("https://kauth.kakao.com/oauth/authorize");
			assertThat(result.getResponse().getRedirectedUrl()).contains("redirect_uri=");
			assertThat(result.getRequest().getSession(false)).isNull();
		}

		@Test
		void 모르는_공급자는_실패_핸들러_없이_인증_없음_처리() throws Exception {
			// 등록되지 않은 registrationId 는 redirect 필터가 건너뛰고 보호 경로 규칙(permitAll /oauth2/**)로 404
			mvc.perform(get("/oauth2/authorization/github"))
				.andExpect(status().isNotFound());
		}

		@Test
		void 콜백에_저장된_요청이_없으면_login_error_로_302() throws Exception {
			mvc.perform(get("/login/oauth2/code/kakao").param("code", "x").param("state", "s"))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", "http://localhost:3000/login?error=authorization_request_not_found"));
		}
	}
}
