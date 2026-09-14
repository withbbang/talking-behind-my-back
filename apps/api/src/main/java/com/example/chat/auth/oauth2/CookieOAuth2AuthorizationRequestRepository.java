package com.example.chat.auth.oauth2;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.CookieProperties;
import com.example.chat.auth.JwtProvider;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

/**
 * OAuth2 authorization request 를 HttpSession 대신 서명된 쿠키에 보관 (SecurityConfig stateless 와 정합).
 *
 * - 기본 HttpSessionOAuth2AuthorizationRequestRepository 는 세션을 만들어 STATELESS 정책과 충돌한다.
 * - Java 직렬화 대신 필요한 필드만 JWT(HS256, audience=oauth2-request, 10분) 로 담는다 — 쿠키는 신뢰 못 할 입력이라
 *   역직렬화 취약점을 피하고, 변조 시 서명 검증에서 걸린다.
 * - Path=/api: 시작(/api/oauth2/authorization/*)과 콜백(/api/login/oauth2/code/*) 둘 다 포함. SameSite=Lax 라
 *   공급자에서 돌아오는 최상위 GET 내비게이션에도 쿠키가 실린다.
 * - 콜백의 state 파라미터가 저장된 state 와 다르면 null (CSRF 방지 — 필터도 다시 비교한다).
 */
public class CookieOAuth2AuthorizationRequestRepository
	implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

	public static final String COOKIE_NAME = "oauth2_auth_request";
	static final String AUDIENCE = "oauth2-request";
	static final String COOKIE_PATH = "/api";
	static final Duration TTL = Duration.ofMinutes(10);   // 2단계 인증·계정 선택 감안. 5분은 실왕복에서 초과 사례 있음(2026-09-14)

	private static final String C_STATE = "state";
	private static final String C_AUTH_URI = "authorizationUri";
	private static final String C_CLIENT_ID = "clientId";
	private static final String C_REDIRECT_URI = "redirectUri";
	private static final String C_SCOPES = "scopes";
	private static final String C_ATTRIBUTES = "attributes";
	private static final String C_ADDITIONAL = "additionalParameters";

	private final JwtProvider jwtProvider;
	private final CookieProperties cookie;

	public CookieOAuth2AuthorizationRequestRepository(JwtProvider jwtProvider, CookieProperties cookie) {
		this.jwtProvider = jwtProvider;
		this.cookie = cookie;
	}

	@Override
	public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
		Optional<String> token = AuthCookies.read(request, COOKIE_NAME);
		if (token.isEmpty()) {
			return null;
		}
		Map<String, Object> claims;
		try {
			claims = jwtProvider.parseSignedToken(AUDIENCE, token.get());
		} catch (JwtException | IllegalArgumentException e) {
			return null;
		}
		OAuth2AuthorizationRequest saved = fromClaims(claims);
		String stateParam = request.getParameter(OAuth2ParameterNames.STATE);
		if (stateParam != null && !stateParam.equals(saved.getState())) {
			return null;
		}
		return saved;
	}

	@Override
	public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request,
		HttpServletResponse response) {
		if (authorizationRequest == null) {
			write(response, "", Duration.ZERO);
			return;
		}
		String token = jwtProvider.createSignedToken(AUDIENCE, toClaims(authorizationRequest), TTL);
		write(response, token, TTL);
	}

	@Override
	public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
		HttpServletResponse response) {
		OAuth2AuthorizationRequest saved = loadAuthorizationRequest(request);
		write(response, "", Duration.ZERO);
		return saved;
	}

	private void write(HttpServletResponse response, String value, Duration maxAge) {
		ResponseCookie c = ResponseCookie.from(COOKIE_NAME, value)
			.httpOnly(true)
			.secure(cookie.secure())
			.sameSite(cookie.sameSite())
			.path(COOKIE_PATH)
			.maxAge(maxAge)
			.build();
		response.addHeader(HttpHeaders.SET_COOKIE, c.toString());
	}

	private static Map<String, Object> toClaims(OAuth2AuthorizationRequest r) {
		Map<String, Object> m = new HashMap<>();
		m.put(C_STATE, r.getState());
		m.put(C_AUTH_URI, r.getAuthorizationUri());
		m.put(C_CLIENT_ID, r.getClientId());
		m.put(C_REDIRECT_URI, r.getRedirectUri());
		m.put(C_SCOPES, List.copyOf(r.getScopes()));
		m.put(C_ATTRIBUTES, new HashMap<>(r.getAttributes()));
		m.put(C_ADDITIONAL, new HashMap<>(r.getAdditionalParameters()));
		return m;
	}

	@SuppressWarnings("unchecked")
	private static OAuth2AuthorizationRequest fromClaims(Map<String, Object> c) {
		Set<String> scopes = new HashSet<>();
		if (c.get(C_SCOPES) instanceof Collection<?> col) {
			col.forEach(s -> scopes.add(String.valueOf(s)));
		}
		Map<String, Object> attributes = c.get(C_ATTRIBUTES) instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
		Map<String, Object> additional = c.get(C_ADDITIONAL) instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
		return OAuth2AuthorizationRequest.authorizationCode()
			.state((String) c.get(C_STATE))
			.authorizationUri((String) c.get(C_AUTH_URI))
			.clientId((String) c.get(C_CLIENT_ID))
			.redirectUri((String) c.get(C_REDIRECT_URI))
			.scopes(scopes)
			.attributes(attributes)
			.additionalParameters(additional)
			.build();
	}
}
