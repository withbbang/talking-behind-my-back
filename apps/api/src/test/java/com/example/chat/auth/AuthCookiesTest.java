package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthCookiesTest {

	private final AuthCookies cookies = new AuthCookies(
		new CookieProperties(true, "Lax"), new JwtProperties("x", Duration.ofMinutes(15), Duration.ofDays(30)));

	@Test
	void access_쿠키는_루트_경로_HttpOnly_Secure_Lax_ttl() {
		ResponseCookie c = cookies.access("tok");

		assertThat(c.getName()).isEqualTo(AuthCookies.ACCESS);
		assertThat(c.getValue()).isEqualTo("tok");
		assertThat(c.getPath()).isEqualTo("/");
		assertThat(c.isHttpOnly()).isTrue();
		assertThat(c.isSecure()).isTrue();
		assertThat(c.getSameSite()).isEqualTo("Lax");
		assertThat(c.getMaxAge()).isEqualTo(Duration.ofMinutes(15));
	}

	@Test
	void refresh_쿠키는_api_auth_경로로_제한() {
		ResponseCookie c = cookies.refresh("raw");

		assertThat(c.getName()).isEqualTo(AuthCookies.REFRESH);
		assertThat(c.getPath()).isEqualTo("/api/auth");
		assertThat(c.isHttpOnly()).isTrue();
		assertThat(c.getMaxAge()).isEqualTo(Duration.ofDays(30));
	}

	@Test
	void 삭제_쿠키는_같은_경로에_maxAge_0() {
		assertThat(cookies.expiredAccess().getMaxAge()).isEqualTo(Duration.ZERO);
		assertThat(cookies.expiredAccess().getPath()).isEqualTo("/");
		assertThat(cookies.expiredRefresh().getMaxAge()).isEqualTo(Duration.ZERO);
		assertThat(cookies.expiredRefresh().getPath()).isEqualTo("/api/auth");
	}

	@Test
	void 로컬_설정이면_secure_false() {
		AuthCookies local = new AuthCookies(new CookieProperties(false, "Lax"),
			new JwtProperties("x", Duration.ofMinutes(1), Duration.ofDays(1)));
		assertThat(local.access("t").isSecure()).isFalse();
	}

	@Test
	void 요청에서_쿠키값_읽기() {
		MockHttpServletRequest req = new MockHttpServletRequest();
		assertThat(AuthCookies.read(req, AuthCookies.ACCESS)).isEmpty();

		req.setCookies(new Cookie("other", "x"), new Cookie(AuthCookies.ACCESS, "abc"));
		assertThat(AuthCookies.read(req, AuthCookies.ACCESS)).contains("abc");
		assertThat(AuthCookies.read(req, AuthCookies.REFRESH)).isEmpty();
	}
}
