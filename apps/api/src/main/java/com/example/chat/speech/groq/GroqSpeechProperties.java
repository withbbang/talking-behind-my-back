package com.example.chat.speech.groq;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** app.speech.groq.* — Groq Whisper 직접 호출(OpenAI 호환, D-044). 키가 비어도 기동은 막지 않는다 — 호출 시 401 → SpeechException. */
@ConfigurationProperties(prefix = "app.speech.groq")
public record GroqSpeechProperties(String baseUrl, String apiKey) {

	public boolean hasApiKey() {
		return apiKey != null && !apiKey.isBlank();
	}
}
