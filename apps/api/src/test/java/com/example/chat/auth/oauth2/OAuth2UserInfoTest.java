package com.example.chat.auth.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.auth.SocialAccount;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

/** 공급자별 userinfo 응답(attributes Map) → OAuth2UserInfo 파싱. 실제 HTTP 없이 Map 직접 주입. */
class OAuth2UserInfoTest {

	@Test
	void google_은_sub_email_name_picture() {
		Map<String, Object> attrs = Map.of(
			"sub", "108000",
			"email", "g@example.com",
			"name", "구글유저",
			"picture", "https://img/g.png");

		OAuth2UserInfo info = OAuth2UserInfo.from("google", attrs);

		assertThat(info.provider()).isEqualTo(SocialAccount.Provider.GOOGLE);
		assertThat(info.providerUserId()).isEqualTo("108000");
		assertThat(info.email()).isEqualTo("g@example.com");
		assertThat(info.nickname()).isEqualTo("구글유저");
		assertThat(info.profileImageUrl()).isEqualTo("https://img/g.png");
	}

	@Test
	void naver_는_response_안의_id_email_nickname_profile_image() {
		Map<String, Object> attrs = Map.of("resultcode", "00", "response", Map.of(
			"id", "naver-abc",
			"email", "n@example.com",
			"nickname", "네이버유저",
			"profile_image", "https://img/n.png"));

		OAuth2UserInfo info = OAuth2UserInfo.from("naver", attrs);

		assertThat(info.provider()).isEqualTo(SocialAccount.Provider.NAVER);
		assertThat(info.providerUserId()).isEqualTo("naver-abc");
		assertThat(info.email()).isEqualTo("n@example.com");
		assertThat(info.nickname()).isEqualTo("네이버유저");
		assertThat(info.profileImageUrl()).isEqualTo("https://img/n.png");
	}

	@Test
	void kakao_는_id_숫자_와_kakao_account_profile() {
		Map<String, Object> attrs = Map.of(
			"id", 123456789L,
			"kakao_account", Map.of(
				"email", "k@example.com",
				"profile", Map.of("nickname", "카카오유저", "profile_image_url", "https://img/k.png")));

		OAuth2UserInfo info = OAuth2UserInfo.from("kakao", attrs);

		assertThat(info.provider()).isEqualTo(SocialAccount.Provider.KAKAO);
		assertThat(info.providerUserId()).isEqualTo("123456789");
		assertThat(info.email()).isEqualTo("k@example.com");
		assertThat(info.nickname()).isEqualTo("카카오유저");
		assertThat(info.profileImageUrl()).isEqualTo("https://img/k.png");
	}

	@Test
	void 이메일_프로필이_없어도_파싱되고_닉네임은_fallback() {
		// 카카오는 이메일 동의 안 하면 kakao_account.email 없음, 프로필 미동의면 profile 없음
		Map<String, Object> attrs = Map.of("id", 42L, "kakao_account", Map.of());

		OAuth2UserInfo info = OAuth2UserInfo.from("kakao", attrs);

		assertThat(info.email()).isNull();
		assertThat(info.profileImageUrl()).isNull();
		assertThat(info.nickname()).isEqualTo("kakao_42");
	}

	@Test
	void 닉네임은_50자로_잘린다() {
		Map<String, Object> attrs = Map.of("sub", "1", "name", "가".repeat(80));

		assertThat(OAuth2UserInfo.from("google", attrs).nickname()).hasSize(50);
	}

	@Test
	void providerUserId_없으면_OAuth2AuthenticationException() {
		Map<String, Object> noSub = new HashMap<>();
		noSub.put("email", "x@y.z");

		assertThatThrownBy(() -> OAuth2UserInfo.from("google", noSub))
			.isInstanceOf(OAuth2AuthenticationException.class);
		assertThatThrownBy(() -> OAuth2UserInfo.from("naver", Map.of("response", Map.of())))
			.isInstanceOf(OAuth2AuthenticationException.class);
	}

	@Test
	void 모르는_registrationId_는_OAuth2AuthenticationException() {
		assertThatThrownBy(() -> OAuth2UserInfo.from("github", Map.of("id", "1")))
			.isInstanceOf(OAuth2AuthenticationException.class);
	}
}
