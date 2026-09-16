package com.example.chat.auth.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * `/oauth2/authorization/{provider}?next=` 의 next 를 authorization request attribute 에 싣는다 (T-022).
 * CookieOAuth2AuthorizationRequestRepository 가 attributes 를 서명 쿠키로 왕복시키므로
 * 콜백에서 OAuth2SuccessHandler 가 같은 값을 읽는다. 불량 next 는 조용히 버린다(NextPath).
 */
public class NextPathAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

	private final OAuth2AuthorizationRequestResolver delegate;

	public NextPathAuthorizationRequestResolver(OAuth2AuthorizationRequestResolver delegate) {
		this.delegate = delegate;
	}

	@Override
	public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
		return attach(request, delegate.resolve(request));
	}

	@Override
	public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
		return attach(request, delegate.resolve(request, clientRegistrationId));
	}

	private static OAuth2AuthorizationRequest attach(HttpServletRequest request, OAuth2AuthorizationRequest resolved) {
		if (resolved == null) {
			return null;
		}
		return NextPath.sanitize(request.getParameter(NextPath.PARAM))
			.map(next -> OAuth2AuthorizationRequest.from(resolved)
				.attributes(attrs -> attrs.put(NextPath.ATTRIBUTE, next))
				.build())
			.orElse(resolved);
	}
}
