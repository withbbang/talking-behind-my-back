package com.example.chat.user;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** users (SCHEMA.md #1). 이메일은 social_accounts 에 있다. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

	public enum Role { USER, ADMIN }

	public enum Status { ACTIVE, SUSPENDED }

	private Long id;
	private String nickname;
	private String profileImageUrl;
	@Builder.Default
	private Role role = Role.USER;
	@Builder.Default
	private Status status = Status.ACTIVE;
	private LocalDateTime lastLoginAt;
	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;
	private LocalDateTime deletedAt;

	public boolean isSuspended() {
		return status == Status.SUSPENDED;
	}
}
