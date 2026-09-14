package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.annotation.Transactional;

/**
 * T-004 social_accounts / refresh_tokens 매퍼 왕복. MapperTest 와 같은 방식(@SpringBootTest + @Transactional 롤백).
 */
@SpringBootTest
@Transactional
class AuthMapperTest {

	@Autowired UserMapper userMapper;
	@Autowired SocialAccountMapper socialAccountMapper;
	@Autowired RefreshTokenMapper refreshTokenMapper;

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	private RefreshToken newToken(Long userId, String hash, String family) {
		RefreshToken t = RefreshToken.builder()
			.userId(userId)
			.tokenHash(hash)
			.familyId(family)
			.expiresAt(LocalDateTime.now().plusDays(30))
			.build();
		refreshTokenMapper.insert(t);
		return t;
	}

	@Nested
	@DisplayName("SocialAccountMapper")
	class SocialAccounts {

		@Test
		void insert_후_provider와_providerUserId_로_조회() {
			User u = newUser("영선");
			SocialAccount sa = SocialAccount.builder()
				.userId(u.getId())
				.provider(SocialAccount.Provider.KAKAO)
				.providerUserId("12345")
				.email("a@b.c")
				.build();
			socialAccountMapper.insert(sa);

			assertThat(sa.getId()).isNotNull();
			SocialAccount found = socialAccountMapper
				.findByProviderAndProviderUserId(SocialAccount.Provider.KAKAO, "12345")
				.orElseThrow();
			assertThat(found.getUserId()).isEqualTo(u.getId());
			assertThat(found.getProvider()).isEqualTo(SocialAccount.Provider.KAKAO);
			assertThat(found.getEmail()).isEqualTo("a@b.c");
			assertThat(found.getCreatedAt()).isNotNull();
		}

		@Test
		void 없는_계정은_empty_그리고_userId_로_조회() {
			User u = newUser("영선");
			socialAccountMapper.insert(SocialAccount.builder()
				.userId(u.getId()).provider(SocialAccount.Provider.GOOGLE).providerUserId("g-1").build());

			assertThat(socialAccountMapper.findByProviderAndProviderUserId(SocialAccount.Provider.NAVER, "g-1")).isEmpty();
			assertThat(socialAccountMapper.findByUserId(u.getId()).orElseThrow().getProvider())
				.isEqualTo(SocialAccount.Provider.GOOGLE);
		}

		@Test
		void 같은_provider_uid_중복은_DuplicateKeyException() {
			User u1 = newUser("a");
			User u2 = newUser("b");
			socialAccountMapper.insert(SocialAccount.builder()
				.userId(u1.getId()).provider(SocialAccount.Provider.NAVER).providerUserId("n-1").build());

			assertThatThrownBy(() -> socialAccountMapper.insert(SocialAccount.builder()
				.userId(u2.getId()).provider(SocialAccount.Provider.NAVER).providerUserId("n-1").build()))
				.isInstanceOf(DuplicateKeyException.class);
		}
	}

	@Nested
	@DisplayName("RefreshTokenMapper")
	class RefreshTokens {

		@Test
		void insert_후_hash_로_조회() {
			User u = newUser("영선");
			RefreshToken t = newToken(u.getId(), "h".repeat(64), "fam-1");

			RefreshToken found = refreshTokenMapper.findByTokenHash("h".repeat(64)).orElseThrow();
			assertThat(found.getId()).isEqualTo(t.getId());
			assertThat(found.getUserId()).isEqualTo(u.getId());
			assertThat(found.getFamilyId()).isEqualTo("fam-1");
			assertThat(found.getRevokedAt()).isNull();
			assertThat(found.isRevoked()).isFalse();
			assertThat(found.getCreatedAt()).isNotNull();
		}

		@Test
		void revokeById_는_해당_행만() {
			User u = newUser("영선");
			RefreshToken a = newToken(u.getId(), "a".repeat(64), "fam-1");
			RefreshToken b = newToken(u.getId(), "b".repeat(64), "fam-1");

			assertThat(refreshTokenMapper.revokeById(a.getId())).isEqualTo(1);
			assertThat(refreshTokenMapper.findByTokenHash("a".repeat(64)).orElseThrow().isRevoked()).isTrue();
			assertThat(refreshTokenMapper.findByTokenHash("b".repeat(64)).orElseThrow().isRevoked()).isFalse();
			// 이미 revoke 된 행은 다시 revoke 되지 않는다(0)
			assertThat(refreshTokenMapper.revokeById(a.getId())).isEqualTo(0);
			assertThat(b.getId()).isNotNull();
		}

		@Test
		void revokeFamily_는_family_전체_revoke_다른_family_는_유지() {
			User u = newUser("영선");
			newToken(u.getId(), "a".repeat(64), "fam-1");
			newToken(u.getId(), "b".repeat(64), "fam-1");
			newToken(u.getId(), "c".repeat(64), "fam-2");

			assertThat(refreshTokenMapper.revokeFamily("fam-1")).isEqualTo(2);
			assertThat(refreshTokenMapper.findByTokenHash("a".repeat(64)).orElseThrow().isRevoked()).isTrue();
			assertThat(refreshTokenMapper.findByTokenHash("b".repeat(64)).orElseThrow().isRevoked()).isTrue();
			assertThat(refreshTokenMapper.findByTokenHash("c".repeat(64)).orElseThrow().isRevoked()).isFalse();
		}

		@Test
		void revokeAllByUserId_는_그_사용자_전체() {
			User u1 = newUser("a");
			User u2 = newUser("b");
			newToken(u1.getId(), "a".repeat(64), "fam-1");
			newToken(u1.getId(), "b".repeat(64), "fam-2");
			newToken(u2.getId(), "c".repeat(64), "fam-3");

			assertThat(refreshTokenMapper.revokeAllByUserId(u1.getId())).isEqualTo(2);
			assertThat(refreshTokenMapper.findByTokenHash("c".repeat(64)).orElseThrow().isRevoked()).isFalse();
		}
	}
}
