package com.example.chat.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** app.jwt.* (application.yml). ttl 은 "15m"/"30d" 같은 Boot Duration 표기. */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
	String secret,
	Duration accessTtl,
	Duration refreshTtl
) {
}
