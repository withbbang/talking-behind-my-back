package com.example.chat.auth;

import com.example.chat.user.User;

/**
 * SecurityContext 의 principal. 컨트롤러에서 `@AuthenticationPrincipal AuthPrincipal` 로 받는다.
 * role/status 는 토큰이 아니라 요청 시점 DB 값(JwtAuthFilter) — 정지/권한 변경이 즉시 반영된다.
 */
public record AuthPrincipal(Long userId, User.Role role, User.Status status) {

	public static AuthPrincipal of(User user) {
		return new AuthPrincipal(user.getId(), user.getRole(), user.getStatus());
	}

	public boolean isSuspended() {
		return status == User.Status.SUSPENDED;
	}
}
