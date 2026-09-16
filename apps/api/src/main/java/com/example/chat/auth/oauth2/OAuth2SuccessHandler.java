package com.example.chat.auth.oauth2;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.AuthService;
import com.example.chat.auth.JwtProvider;
import com.example.chat.auth.RefreshTokenService;
import com.example.chat.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

/**
 * OAuth2 콜백 성공 → social_accounts/users upsert → access/refresh 쿠키 → APP_BASE_URL{next} 로 302 (API.md#auth, T-022).
 * next 는 시작 단계에서 authorization request attribute 로 저장된 값(NextPathAuthorizationRequestResolver).
 * 필터가 removeAuthorizationRequest 로 쿠키 삭제 헤더를 이미 썼지만 요청 쿠키는 그대로라 여기서 다시 읽을 수 있다.
 * 여기서 터지는 예외(DB 등)는 500 대신 /login?error=oauth_failed 로 보낸다 — 브라우저 리다이렉트 흐름이라 JSON 은 못 본다.
 */
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

	private static final Logger log = LoggerFactory.getLogger(OAuth2SuccessHandler.class);

	private final AuthService authService;
	private final RefreshTokenService refreshTokenService;
	private final JwtProvider jwtProvider;
	private final AuthCookies cookies;
	private final String baseUrl;
	private final AuthorizationRequestRepository<OAuth2AuthorizationRequest> authorizationRequests;

	public OAuth2SuccessHandler(AuthService authService, RefreshTokenService refreshTokenService,
		JwtProvider jwtProvider, AuthCookies cookies, String baseUrl,
		AuthorizationRequestRepository<OAuth2AuthorizationRequest> authorizationRequests) {
		this.authService = authService;
		this.refreshTokenService = refreshTokenService;
		this.jwtProvider = jwtProvider;
		this.cookies = cookies;
		this.baseUrl = OAuth2FailureHandler.stripTrailingSlash(baseUrl);
		this.authorizationRequests = authorizationRequests;
	}

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
		Authentication authentication) throws IOException {
		try {
			SocialOAuth2User principal = (SocialOAuth2User) authentication.getPrincipal();
			User user = authService.loginBySocial(principal.info());
			String access = jwtProvider.createAccessToken(user.getId(), user.getRole());
			String refresh = refreshTokenService.issue(user.getId());

			response.addHeader(HttpHeaders.SET_COOKIE, cookies.access(access).toString());
			response.addHeader(HttpHeaders.SET_COOKIE, cookies.refresh(refresh).toString());
			response.sendRedirect(baseUrl + nextPath(request));
		} catch (RuntimeException e) {
			log.error("소셜 로그인 후처리 실패", e);
			response.sendRedirect(baseUrl + "/login?error=" + OAuth2FailureHandler.GENERIC_ERROR);
		}
	}

	private String nextPath(HttpServletRequest request) {
		OAuth2AuthorizationRequest saved = authorizationRequests.loadAuthorizationRequest(request);
		String next = saved == null ? null : saved.getAttribute(NextPath.ATTRIBUTE);
		return NextPath.sanitize(next).orElse("/");
	}
}
