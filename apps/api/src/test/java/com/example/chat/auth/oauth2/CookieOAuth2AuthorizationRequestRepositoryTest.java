package com.example.chat.auth.oauth2;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.auth.CookieProperties;
import com.example.chat.auth.JwtProperties;
import com.example.chat.auth.JwtProvider;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

class CookieOAuth2AuthorizationRequestRepositoryTest {

	private final JwtProvider jwt = new JwtProvider(new JwtProperties(
		"test-only-secret-key-that-is-at-least-32-bytes-long!!", Duration.ofMinutes(15), Duration.ofDays(30)));
	private final CookieOAuth2AuthorizationRequestRepository repo =
		new CookieOAuth2AuthorizationRequestRepository(jwt, new CookieProperties(false, "Lax"));

	private OAuth2AuthorizationRequest sample() {
		return OAuth2AuthorizationRequest.authorizationCode()
			.authorizationUri("https://kauth.kakao.com/oauth/authorize")
			.clientId("client-1")
			.redirectUri("http://localhost:3000/api/login/oauth2/code/kakao")
			.scopes(Set.of("profile_nickname", "account_email"))
			.state("state-xyz")
			.attributes(Map.of(OAuth2ParameterNames.REGISTRATION_ID, "kakao"))
			.additionalParameters(Map.of("prompt", "login"))
			.build();
	}

	private static Cookie savedCookie(MockHttpServletResponse res) {
		Cookie c = res.getCookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME);
		assertThat(c).isNotNull();
		return c;
	}

	@Test
	void save_는_서명된_쿠키를_내려주고_load_로_복원된다() {
		MockHttpServletRequest saveReq = new MockHttpServletRequest();
		MockHttpServletResponse saveRes = new MockHttpServletResponse();
		repo.saveAuthorizationRequest(sample(), saveReq, saveRes);

		Cookie c = savedCookie(saveRes);
		assertThat(c.isHttpOnly()).isTrue();
		assertThat(c.getPath()).isEqualTo("/api");
		assertThat(c.getMaxAge()).isPositive();
		String setCookie = saveRes.getHeader("Set-Cookie");
		assertThat(setCookie).contains("SameSite=Lax");

		MockHttpServletRequest loadReq = new MockHttpServletRequest();
		loadReq.setCookies(new Cookie(c.getName(), c.getValue()));
		loadReq.setParameter(OAuth2ParameterNames.STATE, "state-xyz");
		OAuth2AuthorizationRequest loaded = repo.loadAuthorizationRequest(loadReq);

		assertThat(loaded).isNotNull();
		assertThat(loaded.getState()).isEqualTo("state-xyz");
		assertThat(loaded.getAuthorizationUri()).isEqualTo("https://kauth.kakao.com/oauth/authorize");
		assertThat(loaded.getClientId()).isEqualTo("client-1");
		assertThat(loaded.getRedirectUri()).isEqualTo("http://localhost:3000/api/login/oauth2/code/kakao");
		assertThat(loaded.getScopes()).containsExactlyInAnyOrder("profile_nickname", "account_email");
		assertThat(loaded.<String>getAttribute(OAuth2ParameterNames.REGISTRATION_ID)).isEqualTo("kakao");
		assertThat(loaded.getAdditionalParameters()).containsEntry("prompt", "login");
	}

	@Test
	void state_파라미터가_다르면_null() {
		MockHttpServletResponse saveRes = new MockHttpServletResponse();
		repo.saveAuthorizationRequest(sample(), new MockHttpServletRequest(), saveRes);

		MockHttpServletRequest req = new MockHttpServletRequest();
		req.setCookies(new Cookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME, savedCookie(saveRes).getValue()));
		req.setParameter(OAuth2ParameterNames.STATE, "other");

		assertThat(repo.loadAuthorizationRequest(req)).isNull();
	}

	@Test
	void 쿠키_없거나_변조되면_null() {
		assertThat(repo.loadAuthorizationRequest(new MockHttpServletRequest())).isNull();

		MockHttpServletRequest req = new MockHttpServletRequest();
		req.setCookies(new Cookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME, "garbage.token.value"));
		assertThat(repo.loadAuthorizationRequest(req)).isNull();
	}

	@Test
	void remove_는_복원값을_돌려주고_쿠키를_삭제한다() {
		MockHttpServletResponse saveRes = new MockHttpServletResponse();
		repo.saveAuthorizationRequest(sample(), new MockHttpServletRequest(), saveRes);

		MockHttpServletRequest req = new MockHttpServletRequest();
		req.setCookies(new Cookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME, savedCookie(saveRes).getValue()));
		req.setParameter(OAuth2ParameterNames.STATE, "state-xyz");
		MockHttpServletResponse res = new MockHttpServletResponse();

		OAuth2AuthorizationRequest removed = repo.removeAuthorizationRequest(req, res);

		assertThat(removed).isNotNull();
		assertThat(removed.getState()).isEqualTo("state-xyz");
		Cookie deleted = savedCookie(res);
		assertThat(deleted.getMaxAge()).isZero();
		assertThat(deleted.getValue()).isEmpty();
	}

	@Test
	void save_에_null_이면_쿠키_삭제() {
		MockHttpServletResponse res = new MockHttpServletResponse();
		repo.saveAuthorizationRequest(null, new MockHttpServletRequest(), res);

		assertThat(savedCookie(res).getMaxAge()).isZero();
	}
}
