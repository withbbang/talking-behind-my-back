package com.example.chat.auth;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** social_accounts (SCHEMA.md #2). v1 은 사용자당 소셜 1개, 같은 이메일 다른 공급자는 별도 계정(D-003 보완 대기). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialAccount {

	public enum Provider {
		GOOGLE, NAVER, KAKAO;

		/** Spring Security registrationId(소문자) → Provider */
		public static Provider fromRegistrationId(String registrationId) {
			return valueOf(registrationId.toUpperCase());
		}
	}

	private Long id;
	private Long userId;
	private Provider provider;
	private String providerUserId;
	private String email;
	private LocalDateTime createdAt;
}
