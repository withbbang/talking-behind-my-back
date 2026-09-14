package com.example.chat.auth;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * refresh_tokens (SCHEMA.md #3). raw 토큰은 저장하지 않고 SHA-256 hex(token_hash)만.
 * family_id 는 회전 체인 — 재사용 감지 시 family 전체 revoke.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

	private Long id;
	private Long userId;
	private String tokenHash;
	private String familyId;
	private LocalDateTime expiresAt;
	private LocalDateTime revokedAt;
	private LocalDateTime createdAt;

	public boolean isRevoked() {
		return revokedAt != null;
	}

	public boolean isExpired(LocalDateTime now) {
		return !expiresAt.isAfter(now);
	}
}
