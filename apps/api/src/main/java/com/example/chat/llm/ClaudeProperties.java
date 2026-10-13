package com.example.chat.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.llm.claude.* (application.yml). `app.llm.provider=claude` 일 때만 쓰인다 (D-040).
 * baseUrl 이 비면 SDK 기본(api.anthropic.com). 타임아웃은 공통 `app.llm.timeout-seconds`.
 */
@ConfigurationProperties(prefix = "app.llm.claude")
public record ClaudeProperties(
	String apiKey,
	String baseUrl,
	String model,
	String effort,
	long maxTokens,
	int maxRetries
) {
	public boolean hasApiKey() {
		return apiKey != null && !apiKey.isBlank();
	}

	public boolean hasBaseUrl() {
		return baseUrl != null && !baseUrl.isBlank();
	}

	public boolean hasEffort() {
		return effort != null && !effort.isBlank();
	}
}
