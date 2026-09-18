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
	int timeoutSeconds,
	String reasoningEffort
) {
	public Duration timeout() {
		return Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 120);
	}

	public boolean hasApiKey() {
		return apiKey != null && !apiKey.isBlank();
	}

	/** 설정 시에만 요청 본문에 실린다. thinking 모델(Gemini 2.5 등)에서 추론을 끄는 용도 — none. 비면 안 보냄(공급자 중립). */
	public boolean hasReasoningEffort() {
		return reasoningEffort != null && !reasoningEffort.isBlank();
	}
}
