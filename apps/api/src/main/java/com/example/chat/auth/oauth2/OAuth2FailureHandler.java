package com.example.chat.auth.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

/**
 * OAuth2 실패 → APP_BASE_URL/login?error=<code> (API.md#auth, T-005 가 ?error= 로 알림).
 * code 는 공급자 OAuth2 error code(access_denied 등)를 그대로 쓰되 [a-z0-9_] 만 허용 — 그 외는 oauth_failed.
 */
public class OAuth2FailureHandler implements AuthenticationFailureHandler {

	static final String GENERIC_ERROR = "oauth_failed";
	private static final Logger log = LoggerFactory.getLogger(OAuth2FailureHandler.class);
	private static final Pattern SAFE_CODE = Pattern.compile("[a-z0-9_]{1,40}");

	private final String baseUrl;

	public OAuth2FailureHandler(String baseUrl) {
		this.baseUrl = stripTrailingSlash(baseUrl);
	}

	@Override
	public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
		AuthenticationException exception) throws IOException {
		String code = GENERIC_ERROR;
		if (exception instanceof OAuth2AuthenticationException oe && oe.getError() != null) {
			String raw = oe.getError().getErrorCode();
			if (raw != null && SAFE_CODE.matcher(raw).matches()) {
				code = raw;
			}
		}
		log.warn("소셜 로그인 실패: {} ({})", code, exception.getMessage());
		response.sendRedirect(baseUrl + "/login?error=" + code);
	}

	static String stripTrailingSlash(String url) {
		return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
	}
}
