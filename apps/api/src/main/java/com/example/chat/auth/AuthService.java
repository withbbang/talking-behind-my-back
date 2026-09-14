package com.example.chat.auth;

import com.example.chat.auth.oauth2.OAuth2UserInfo;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 upsert + /auth/me. 토큰 발급은 RefreshTokenService/JwtProvider, 쿠키는 AuthCookies.
 *
 * 같은 이메일 다른 공급자 = 별도 계정 (inbox/to-ceo.md 결정 전 정책 (b)). 연결 정책이 확정되면 loginBySocial 만 바꾼다.
 */
@Service
public class AuthService {

	/** GET /auth/me 응답 (API.md#auth). status 는 프론트가 정지 안내를 띄우기 위해 추가. */
	public record Me(Long id, String nickname, String profileImageUrl, User.Role role, User.Status status,
		SocialAccount.Provider provider) {
	}

	private final UserMapper userMapper;
	private final SocialAccountMapper socialAccountMapper;

	public AuthService(UserMapper userMapper, SocialAccountMapper socialAccountMapper) {
		this.userMapper = userMapper;
		this.socialAccountMapper = socialAccountMapper;
	}

	/** 기존 소셜 계정이면 last_login 만 갱신, 처음이면 users + social_accounts 생성. 닉네임/프로필은 최초 1회만 반영. */
	@Transactional
	public User loginBySocial(OAuth2UserInfo info) {
		Optional<SocialAccount> existing = socialAccountMapper
			.findByProviderAndProviderUserId(info.provider(), info.providerUserId());

		Long userId;
		if (existing.isPresent()) {
			userId = existing.get().getUserId();
		} else {
			User user = User.builder()
				.nickname(info.nickname())
				.profileImageUrl(info.profileImageUrl())
				.build();
			userMapper.insert(user);
			socialAccountMapper.insert(SocialAccount.builder()
				.userId(user.getId())
				.provider(info.provider())
				.providerUserId(info.providerUserId())
				.email(info.email())
				.build());
			userId = user.getId();
		}
		userMapper.updateLastLoginAt(userId);
		return userMapper.findById(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public Me me(Long userId) {
		User user = userMapper.findById(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
		SocialAccount.Provider provider = socialAccountMapper.findByUserId(userId)
			.map(SocialAccount::getProvider)
			.orElse(null);
		return new Me(user.getId(), user.getNickname(), user.getProfileImageUrl(), user.getRole(), user.getStatus(),
			provider);
	}
}
