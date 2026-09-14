package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.auth.oauth2.OAuth2UserInfo;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** 소셜 로그인 upsert + /auth/me 조립. 실제 매퍼 위에서 @Transactional 롤백. */
@SpringBootTest
@Transactional
class AuthServiceTest {

	@Autowired AuthService service;
	@Autowired UserMapper userMapper;
	@Autowired SocialAccountMapper socialAccountMapper;

	private static OAuth2UserInfo kakao(String id, String email, String nick) {
		return new OAuth2UserInfo(SocialAccount.Provider.KAKAO, id, email, nick, "https://img/k.png");
	}

	@Test
	void 처음_로그인이면_users_와_social_accounts_생성_last_login_세팅() {
		User u = service.loginBySocial(kakao("k-1", "k@example.com", "카카오"));

		assertThat(u.getId()).isNotNull();
		User stored = userMapper.findById(u.getId()).orElseThrow();
		assertThat(stored.getNickname()).isEqualTo("카카오");
		assertThat(stored.getProfileImageUrl()).isEqualTo("https://img/k.png");
		assertThat(stored.getRole()).isEqualTo(User.Role.USER);
		assertThat(stored.getLastLoginAt()).isNotNull();

		SocialAccount sa = socialAccountMapper.findByUserId(u.getId()).orElseThrow();
		assertThat(sa.getProvider()).isEqualTo(SocialAccount.Provider.KAKAO);
		assertThat(sa.getProviderUserId()).isEqualTo("k-1");
		assertThat(sa.getEmail()).isEqualTo("k@example.com");
	}

	@Test
	void 두_번째_로그인은_기존_사용자_반환_닉네임은_덮어쓰지_않음() {
		User first = service.loginBySocial(kakao("k-1", "k@example.com", "카카오"));
		userMapper.updateNickname(first.getId(), "내가바꾼이름");

		User again = service.loginBySocial(kakao("k-1", "k@example.com", "공급자새이름"));

		assertThat(again.getId()).isEqualTo(first.getId());
		assertThat(again.getNickname()).isEqualTo("내가바꾼이름");
	}

	@Test
	void 같은_이메일_다른_공급자는_별도_계정() {
		// D-003 보완 결정 전 정책 (b). 결정되면 여기부터 바꾼다.
		User k = service.loginBySocial(kakao("k-1", "same@example.com", "a"));
		User g = service.loginBySocial(
			new OAuth2UserInfo(SocialAccount.Provider.GOOGLE, "g-1", "same@example.com", "b", null));

		assertThat(g.getId()).isNotEqualTo(k.getId());
	}

	@Test
	void me_는_provider_포함() {
		User u = service.loginBySocial(kakao("k-1", null, "카카오"));

		AuthService.Me me = service.me(u.getId());

		assertThat(me.id()).isEqualTo(u.getId());
		assertThat(me.nickname()).isEqualTo("카카오");
		assertThat(me.profileImageUrl()).isEqualTo("https://img/k.png");
		assertThat(me.role()).isEqualTo(User.Role.USER);
		assertThat(me.status()).isEqualTo(User.Status.ACTIVE);
		assertThat(me.provider()).isEqualTo(SocialAccount.Provider.KAKAO);
	}

	@Test
	void me_는_없는_사용자면_USER_NOT_FOUND() {
		assertThatThrownBy(() -> service.me(999_999L))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.USER_NOT_FOUND);
	}
}
