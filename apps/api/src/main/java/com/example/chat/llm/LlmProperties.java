package com.example.chat.llm;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.llm.* (application.yml). OmniRoute 는 OpenAI 호환 /v1 (D-006).
 */
@ConfigurationProperties(prefix = "app.llm")
public record LlmProperties(
	String baseUrl,
	String apiKey,
	String model,
	int contextMaxMessages,
	int timeoutSeconds
) {
	public Duration timeout() {
		return Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 120);
	}

	public boolean hasApiKey() {
		return apiKey != null && !apiKey.isBlank();
	}
}
