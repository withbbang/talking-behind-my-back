package com.example.chat.auth.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.AuthService;
import com.example.chat.auth.CookieProperties;
import com.example.chat.auth.JwtProperties;
import com.example.chat.auth.JwtProvider;
import com.example.chat.auth.RefreshTokenService;
import com.example.chat.auth.SocialAccount;
import com.example.chat.user.User;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

/** 성공/실패 핸들러 단위 테스트 — 서비스는 mock, 쿠키·redirect 만 검증. */
class OAuth2HandlersTest {

	private static final String BASE = "http://localhost:3000";

	private final JwtProvider jwt = new JwtProvider(new JwtProperties(
		"test-only-secret-key-that-is-at-least-32-bytes-long!!", Duration.ofMinutes(15), Duration.ofDays(30)));
	private final AuthCookies cookies = new AuthCookies(new CookieProperties(false, "Lax"),
		new JwtProperties("x", Duration.ofMinutes(15), Duration.ofDays(30)));
	private final AuthService authService = mock(AuthService.class);
	private final RefreshTokenService refreshTokens = mock(RefreshTokenService.class);

	@Test
	void 성공하면_upsert_후_access_refresh_쿠키_세팅_그리고_base_url_로_302() throws Exception {
		OAuth2UserInfo info = new OAuth2UserInfo(SocialAccount.Provider.KAKAO, "k-1", null, "카카오", null);
		User user = User.builder().id(5L).nickname("카카오").role(User.Role.USER).status(User.Status.ACTIVE).build();
		when(authService.loginBySocial(info)).thenReturn(user);
		when(refreshTokens.issue(5L)).thenReturn("raw-refresh");
		OAuth2SuccessHandler handler = new OAuth2SuccessHandler(authService, refreshTokens, jwt, cookies, BASE);

		MockHttpServletResponse res = new MockHttpServletResponse();
		handler.onAuthenticationSuccess(new MockHttpServletRequest(), res,
			new OAuth2AuthenticationToken(new SocialOAuth2User(info, Map.of("id", "k-1")), List.of(), "kakao"));

		assertThat(res.getStatus()).isEqualTo(302);
		assertThat(res.getRedirectedUrl()).isEqualTo(BASE + "/");
		List<String> setCookies = res.getHeaders("Set-Cookie");
		assertThat(setCookies).anySatisfy(h -> {
			assertThat(h).startsWith(AuthCookies.ACCESS + "=");
			assertThat(h).contains("Path=/;").contains("HttpOnly");
			String token = h.substring((AuthCookies.ACCESS + "=").length(), h.indexOf(';'));
			assertThat(jwt.parseAccessToken(token).userId()).isEqualTo(5L);
		});
		assertThat(setCookies).anySatisfy(h ->
			assertThat(h).startsWith(AuthCookies.REFRESH + "=raw-refresh").contains("Path=/api/auth"));
	}

	@Test
	void 실패하면_login_error_코드로_302_쿠키_없음() throws Exception {
		OAuth2FailureHandler handler = new OAuth2FailureHandler(BASE);
		MockHttpServletResponse res = new MockHttpServletResponse();

		handler.onAuthenticationFailure(new MockHttpServletRequest(), res,
			new OAuth2AuthenticationException(new OAuth2Error("access_denied")));

		assertThat(res.getRedirectedUrl()).isEqualTo(BASE + "/login?error=access_denied");
		assertThat(res.getHeaders("Set-Cookie")).isEmpty();
	}

	@Test
	void 실패_코드가_없거나_이상하면_oauth_failed() throws Exception {
		OAuth2FailureHandler handler = new OAuth2FailureHandler(BASE);

		MockHttpServletResponse res1 = new MockHttpServletResponse();
		handler.onAuthenticationFailure(new MockHttpServletRequest(), res1, new BadCredentialsException("x"));
		assertThat(res1.getRedirectedUrl()).isEqualTo(BASE + "/login?error=oauth_failed");

		MockHttpServletResponse res2 = new MockHttpServletResponse();
		handler.onAuthenticationFailure(new MockHttpServletRequest(), res2,
			new OAuth2AuthenticationException(new OAuth2Error("<script>alert(1)</script>")));
		assertThat(res2.getRedirectedUrl()).isEqualTo(BASE + "/login?error=oauth_failed");
	}

	@Test
	void 성공_핸들러에서_서비스_예외가_나면_login_error_로_302() throws Exception {
		when(authService.loginBySocial(any())).thenThrow(new RuntimeException("db down"));
		OAuth2SuccessHandler handler = new OAuth2SuccessHandler(authService, refreshTokens, jwt, cookies, BASE);
		OAuth2UserInfo info = new OAuth2UserInfo(SocialAccount.Provider.GOOGLE, "g", null, "n", null);

		MockHttpServletResponse res = new MockHttpServletResponse();
		handler.onAuthenticationSuccess(new MockHttpServletRequest(), res,
			new OAuth2AuthenticationToken(new SocialOAuth2User(info, Map.of()), List.of(), "google"));

		assertThat(res.getRedirectedUrl()).isEqualTo(BASE + "/login?error=oauth_failed");
		assertThat(res.getHeaders("Set-Cookie")).isEmpty();
	}
}
