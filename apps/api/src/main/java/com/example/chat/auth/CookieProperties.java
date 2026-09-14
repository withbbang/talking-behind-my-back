package com.example.chat.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** app.cookie.* — secure 는 로컬(http) false, 운영 true. */
@ConfigurationProperties(prefix = "app.cookie")
public record CookieProperties(
	boolean secure,
	String sameSite
) {
}
