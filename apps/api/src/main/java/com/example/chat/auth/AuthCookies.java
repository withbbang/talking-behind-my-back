package com.example.chat.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * access/refresh 쿠키 빌더 (API.md#공통, D-003). Admin AdminTokenCookie 패턴.
 *
 * - 둘 다 HttpOnly + SameSite(app.cookie.same-site) + Secure(app.cookie.secure — 로컬 http 는 false).
 * - access: Path=/ — Next middleware(T-005) 가 존재 여부만 검사할 수 있어야 한다.
 * - refresh: Path=/api/auth — /auth/refresh 와 /auth/logout 에만 전송된다(그 외 API 로는 새지 않음).
 *   경로에 context-path(/api) 가 포함되어야 브라우저가 매칭한다.
 * - maxAge 는 각 토큰 ttl 과 동일. 삭제는 같은 Path 에 maxAge=0.
 */
@Component
public class AuthCookies {

	public static final String ACCESS = "access_token";
	public static final String REFRESH = "refresh_token";
	static final String ACCESS_PATH = "/";
	static final String REFRESH_PATH = "/api/auth";

	private final CookieProperties cookie;
	private final Duration accessTtl;
	private final Duration refreshTtl;

	public AuthCookies(CookieProperties cookie, JwtProperties jwt) {
		this.cookie = cookie;
		this.accessTtl = jwt.accessTtl();
		this.refreshTtl = jwt.refreshTtl();
	}

	public ResponseCookie access(String token) {
		return base(ACCESS, token, ACCESS_PATH, accessTtl);
	}

	public ResponseCookie refresh(String rawToken) {
		return base(REFRESH, rawToken, REFRESH_PATH, refreshTtl);
	}

	public ResponseCookie expiredAccess() {
		return base(ACCESS, "", ACCESS_PATH, Duration.ZERO);
	}

	public ResponseCookie expiredRefresh() {
		return base(REFRESH, "", REFRESH_PATH, Duration.ZERO);
	}

	/** 요청 쿠키에서 값 읽기. 없거나 빈 값이면 empty. */
	public static Optional<String> read(HttpServletRequest request, String name) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return Optional.empty();
		}
		return Arrays.stream(cookies)
			.filter(c -> name.equals(c.getName()))
			.map(Cookie::getValue)
			.filter(v -> v != null && !v.isBlank())
			.findFirst();
	}

	private ResponseCookie base(String name, String value, String path, Duration maxAge) {
		return ResponseCookie.from(name, value)
			.httpOnly(true)
			.secure(cookie.secure())
			.sameSite(cookie.sameSite())
			.path(path)
			.maxAge(maxAge)
			.build();
	}
}
