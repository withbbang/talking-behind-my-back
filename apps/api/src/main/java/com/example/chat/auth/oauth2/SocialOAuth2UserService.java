package com.example.chat.auth.oauth2;

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * userinfo 호출(부모) 후 공급자별 파싱. 파싱 실패는 OAuth2AuthenticationException 이라 실패 핸들러(/login?error=)로 간다.
 * DB 는 여기서 건드리지 않는다 — upsert 는 성공 핸들러(AuthService.loginBySocial) 에서.
 */
public class SocialOAuth2UserService extends DefaultOAuth2UserService {

	@Override
	public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
		OAuth2User raw = super.loadUser(userRequest);
		String registrationId = userRequest.getClientRegistration().getRegistrationId();
		return new SocialOAuth2User(OAuth2UserInfo.from(registrationId, raw.getAttributes()), raw.getAttributes());
	}
}
