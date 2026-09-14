package com.example.chat.auth;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * refresh 토큰 발급·회전·재사용 감지 (D-003, SCHEMA.md #3).
 *
 * - raw = 32바이트 난수 base64url. DB 에는 SHA-256 hex 만 → DB 유출로 세션 탈취 불가.
 * - 회전: 유효 토큰 제시 → 구 토큰 revoke + 같은 family 로 새 토큰. 클라이언트는 항상 최신 1개만 유효.
 * - 재사용: 이미 revoke 된 토큰 제시 = 탈취 가능성 → family 전체 revoke + TOKEN_REUSED (정상 사용자도 재로그인).
 * - revokeById 가 0 을 돌려주면(동시 회전 경합) 재사용과 같이 취급한다.
 */
@Service
public class RefreshTokenService {

	public record Rotated(Long userId, String rawToken) {
	}

	private static final SecureRandom RANDOM = new SecureRandom();

	private final RefreshTokenMapper mapper;
	private final JwtProvider jwtProvider;

	public RefreshTokenService(RefreshTokenMapper mapper, JwtProvider jwtProvider) {
		this.mapper = mapper;
		this.jwtProvider = jwtProvider;
	}

	/** 새 family 로 발급 (로그인). raw 토큰 반환 — 쿠키에만 담고 저장하지 않는다. */
	@Transactional
	public String issue(Long userId) {
		return insert(userId, UUID.randomUUID().toString());
	}

	@Transactional
	public Rotated rotate(String rawToken) {
		RefreshToken current = mapper.findByTokenHash(hash(rawToken))
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));

		if (current.isRevoked()) {
			mapper.revokeFamily(current.getFamilyId());
			throw new BusinessException(ErrorCode.TOKEN_REUSED);
		}
		if (current.isExpired(LocalDateTime.now())) {
			mapper.revokeById(current.getId());
			throw new BusinessException(ErrorCode.TOKEN_EXPIRED);
		}
		if (mapper.revokeById(current.getId()) == 0) {
			mapper.revokeFamily(current.getFamilyId());
			throw new BusinessException(ErrorCode.TOKEN_REUSED);
		}
		String fresh = insert(current.getUserId(), current.getFamilyId());
		return new Rotated(current.getUserId(), fresh);
	}

	/** 로그아웃: 해당 family 전체 revoke. 모르는/이미 revoke 된 토큰은 조용히 무시. */
	@Transactional
	public void revoke(String rawToken) {
		Optional<RefreshToken> t = mapper.findByTokenHash(hash(rawToken));
		t.ifPresent(token -> mapper.revokeFamily(token.getFamilyId()));
	}

	private String insert(Long userId, String familyId) {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		mapper.insert(RefreshToken.builder()
			.userId(userId)
			.tokenHash(hash(raw))
			.familyId(familyId)
			.expiresAt(LocalDateTime.now().plus(jwtProvider.refreshTtl()))
			.build());
		return raw;
	}

	static String hash(String raw) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 not available", e);
		}
	}
}
