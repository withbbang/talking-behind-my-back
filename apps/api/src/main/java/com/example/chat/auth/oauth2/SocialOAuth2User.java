package com.example.chat.auth.oauth2;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * OAuth2 콜백 시점의 principal. 공급자 attributes 와 파싱 결과(OAuth2UserInfo)를 함께 들고 성공 핸들러로 전달된다.
 * 앱 세션의 principal 은 AuthPrincipal(JWT) — 이 객체는 콜백 요청 안에서만 산다.
 */
public class SocialOAuth2User implements OAuth2User {

	private final OAuth2UserInfo info;
	private final Map<String, Object> attributes;

	public SocialOAuth2User(OAuth2UserInfo info, Map<String, Object> attributes) {
		this.info = info;
		this.attributes = attributes;
	}

	public OAuth2UserInfo info() {
		return info;
	}

	@Override
	public Map<String, Object> getAttributes() {
		return attributes;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER"));
	}

	@Override
	public String getName() {
		return info.providerUserId();
	}
}
