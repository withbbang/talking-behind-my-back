package com.example.chat.auth.oauth2;

import com.example.chat.auth.SocialAccount;
import java.util.Map;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

/**
 * 공급자별 userinfo 응답을 공통 형태로. attributes 는 Spring 이 userinfo 엔드포인트에서 받은 Map 그대로.
 *
 * - google: {sub, email, name, picture} — openid scope 없이 profile/email 만 요청해 OIDC 경로를 타지 않는다(SecurityConfig).
 * - naver : {resultcode, message, response:{id, email, nickname, profile_image}}
 * - kakao : {id(Long), kakao_account:{email, profile:{nickname, profile_image_url}}}
 * 이메일·프로필은 동의 항목이라 없을 수 있다. 닉네임은 users.nickname(VARCHAR 50) 에 맞춰 자르고, 없으면 "{provider}_{id}".
 */
public record OAuth2UserInfo(
	SocialAccount.Provider provider,
	String providerUserId,
	String email,
	String nickname,
	String profileImageUrl
) {

	static final int NICKNAME_MAX = 50;

	public static OAuth2UserInfo from(String registrationId, Map<String, Object> attributes) {
		SocialAccount.Provider provider;
		try {
			provider = SocialAccount.Provider.fromRegistrationId(registrationId);
		} catch (IllegalArgumentException e) {
			throw error("unsupported_provider", "지원하지 않는 공급자: " + registrationId);
		}
		return switch (provider) {
			case GOOGLE -> build(provider,
				str(attributes, "sub"), str(attributes, "email"), str(attributes, "name"), str(attributes, "picture"));
			case NAVER -> {
				Map<String, Object> res = map(attributes, "response");
				yield build(provider,
					str(res, "id"), str(res, "email"), str(res, "nickname"), str(res, "profile_image"));
			}
			case KAKAO -> {
				Map<String, Object> account = map(attributes, "kakao_account");
				Map<String, Object> profile = map(account, "profile");
				yield build(provider,
					str(attributes, "id"), str(account, "email"), str(profile, "nickname"), str(profile, "profile_image_url"));
			}
		};
	}

	private static OAuth2UserInfo build(SocialAccount.Provider provider, String id, String email, String nickname,
		String image) {
		if (id == null || id.isBlank()) {
			throw error("missing_user_id", provider + " 응답에 사용자 ID 가 없습니다.");
		}
		String name = (nickname == null || nickname.isBlank())
			? provider.name().toLowerCase() + "_" + id
			: nickname;
		if (name.length() > NICKNAME_MAX) {
			name = name.substring(0, NICKNAME_MAX);
		}
		return new OAuth2UserInfo(provider, id, blankToNull(email), name, blankToNull(image));
	}

	private static String str(Map<String, Object> map, String key) {
		Object v = map.get(key);
		return v == null ? null : String.valueOf(v);
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> map(Map<String, Object> map, String key) {
		Object v = map.get(key);
		return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
	}

	private static String blankToNull(String s) {
		return (s == null || s.isBlank()) ? null : s;
	}

	private static OAuth2AuthenticationException error(String code, String message) {
		return new OAuth2AuthenticationException(new OAuth2Error(code, message, null));
	}
}
