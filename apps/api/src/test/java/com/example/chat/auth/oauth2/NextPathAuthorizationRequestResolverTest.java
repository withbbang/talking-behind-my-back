package com.example.chat.auth.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

/** T-022: `/oauth2/authorization/{p}?next=` 의 next 를 authorization request attribute 로 싣는다. */
class NextPathAuthorizationRequestResolverTest {

	private final OAuth2AuthorizationRequestResolver delegate = mock(OAuth2AuthorizationRequestResolver.class);
	private final NextPathAuthorizationRequestResolver resolver = new NextPathAuthorizationRequestResolver(delegate);

	private static OAuth2AuthorizationRequest base() {
		return OAuth2AuthorizationRequest.authorizationCode()
			.authorizationUri("https://kauth.kakao.com/oauth/authorize")
			.clientId("client-1")
			.redirectUri("http://localhost:3000/api/login/oauth2/code/kakao")
			.state("state-xyz")
			.attributes(Map.of(OAuth2ParameterNames.REGISTRATION_ID, "kakao"))
			.build();
	}

	private static MockHttpServletRequest request(String next) {
		MockHttpServletRequest req = new MockHttpServletRequest("GET", "/oauth2/authorization/kakao");
		if (next != null) req.setParameter(NextPath.PARAM, next);
		return req;
	}

	@Test
	void next_가_있으면_attribute_로_싣고_나머지_필드는_유지() {
		when(delegate.resolve(any())).thenReturn(base());

		OAuth2AuthorizationRequest out = resolver.resolve(request("/join/K7Q2M9XW"));

		assertThat(out.<String>getAttribute(NextPath.ATTRIBUTE)).isEqualTo("/join/K7Q2M9XW");
		assertThat(out.<String>getAttribute(OAuth2ParameterNames.REGISTRATION_ID)).isEqualTo("kakao");
		assertThat(out.getState()).isEqualTo("state-xyz");
		assertThat(out.getClientId()).isEqualTo("client-1");
	}

	@Test
	void next_가_없거나_불량이면_attribute_없이_원본_그대로() {
		when(delegate.resolve(any())).thenReturn(base());

		assertThat(resolver.resolve(request(null)).getAttributes()).doesNotContainKey(NextPath.ATTRIBUTE);
		assertThat(resolver.resolve(request("https://evil.example")).getAttributes()).doesNotContainKey(NextPath.ATTRIBUTE);
	}

	@Test
	void delegate_가_null_이면_null_그대로() {
		when(delegate.resolve(any())).thenReturn(null);
		when(delegate.resolve(any(), eq("github"))).thenReturn(null);

		assertThat(resolver.resolve(request("/join/X"))).isNull();
		assertThat(resolver.resolve(request("/join/X"), "github")).isNull();
	}

	@Test
	void registrationId_오버로드도_동일하게_동작() {
		when(delegate.resolve(any(), eq("kakao"))).thenReturn(base());

		OAuth2AuthorizationRequest out = resolver.resolve(request("/rooms/3"), "kakao");

		assertThat(out.<String>getAttribute(NextPath.ATTRIBUTE)).isEqualTo("/rooms/3");
	}
}
