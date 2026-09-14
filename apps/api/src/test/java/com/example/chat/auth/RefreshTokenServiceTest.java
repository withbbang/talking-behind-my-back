package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** refresh 회전·재사용 감지 (D-003). 실제 매퍼 위에서 @Transactional 롤백. */
@SpringBootTest
@Transactional
class RefreshTokenServiceTest {

	@Autowired RefreshTokenService service;
	@Autowired RefreshTokenMapper mapper;
	@Autowired UserMapper userMapper;

	private Long newUserId() {
		User u = User.builder().nickname("u").build();
		userMapper.insert(u);
		return u.getId();
	}

	@Test
	void issue_는_raw_를_돌려주고_DB_에는_해시만() {
		Long userId = newUserId();

		String raw = service.issue(userId);

		assertThat(raw).isNotBlank();
		assertThat(mapper.findByTokenHash(raw)).isEmpty();                       // raw 그대로는 없음
		RefreshToken stored = mapper.findByTokenHash(RefreshTokenService.hash(raw)).orElseThrow();
		assertThat(stored.getUserId()).isEqualTo(userId);
		assertThat(stored.getFamilyId()).isNotBlank();
		assertThat(stored.getExpiresAt()).isAfter(LocalDateTime.now().plusDays(29));
	}

	@Test
	void rotate_는_구_토큰_revoke_후_같은_family_로_새_토큰() {
		Long userId = newUserId();
		String old = service.issue(userId);
		String oldFamily = mapper.findByTokenHash(RefreshTokenService.hash(old)).orElseThrow().getFamilyId();

		RefreshTokenService.Rotated rotated = service.rotate(old);

		assertThat(rotated.userId()).isEqualTo(userId);
		assertThat(rotated.rawToken()).isNotEqualTo(old);
		assertThat(mapper.findByTokenHash(RefreshTokenService.hash(old)).orElseThrow().isRevoked()).isTrue();
		RefreshToken fresh = mapper.findByTokenHash(RefreshTokenService.hash(rotated.rawToken())).orElseThrow();
		assertThat(fresh.isRevoked()).isFalse();
		assertThat(fresh.getFamilyId()).isEqualTo(oldFamily);
	}

	@Test
	void 회전된_구_토큰_재사용은_TOKEN_REUSED_이고_family_전체_revoke() {
		Long userId = newUserId();
		String first = service.issue(userId);
		String second = service.rotate(first).rawToken();

		assertThatThrownBy(() -> service.rotate(first))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.TOKEN_REUSED);

		// 최신 토큰까지 죽는다 → 재로그인 강제
		assertThat(mapper.findByTokenHash(RefreshTokenService.hash(second)).orElseThrow().isRevoked()).isTrue();
		assertThatThrownBy(() -> service.rotate(second))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.TOKEN_REUSED);
	}

	@Test
	void 모르는_토큰은_UNAUTHENTICATED() {
		assertThatThrownBy(() -> service.rotate("no-such-token"))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
	}

	@Test
	void 만료_토큰은_TOKEN_EXPIRED_이고_revoke() {
		Long userId = newUserId();
		String raw = service.issue(userId);
		RefreshToken t = mapper.findByTokenHash(RefreshTokenService.hash(raw)).orElseThrow();
		// 만료 시각을 과거로 — 매퍼에 별도 update 가 없으니 새 행으로 대체
		mapper.revokeById(t.getId());
		RefreshToken expired = RefreshToken.builder()
			.userId(userId).tokenHash(RefreshTokenService.hash("expired-raw")).familyId("fam-x")
			.expiresAt(LocalDateTime.now().minusMinutes(1)).build();
		mapper.insert(expired);

		assertThatThrownBy(() -> service.rotate("expired-raw"))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.TOKEN_EXPIRED);
		assertThat(mapper.findByTokenHash(RefreshTokenService.hash("expired-raw")).orElseThrow().isRevoked()).isTrue();
	}

	@Test
	void revoke_는_해당_family_전체_그리고_모르는_토큰은_무시() {
		Long userId = newUserId();
		String a = service.issue(userId);
		String b = service.issue(userId);   // 다른 기기 = 다른 family

		service.revoke(a);

		assertThat(mapper.findByTokenHash(RefreshTokenService.hash(a)).orElseThrow().isRevoked()).isTrue();
		assertThat(mapper.findByTokenHash(RefreshTokenService.hash(b)).orElseThrow().isRevoked()).isFalse();
		service.revoke("unknown");   // 예외 없음
	}

	@Test
	void hash_는_SHA256_hex_64자() {
		assertThat(RefreshTokenService.hash("abc"))
			.isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	}
}
