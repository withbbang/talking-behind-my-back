package com.example.chat.speech.azure;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.azure.* — Azure AI Speech TTS (D-044). endpoint 가 비면 region 으로 기본 주소를 만든다.
 * 키가 비어 있어도 기동은 막지 않는다 — 호출 시 401 → SpeechException(음성만 실패).
 */
@ConfigurationProperties(prefix = "app.speech.azure")
public record AzureSpeechProperties(String key, String region, String endpoint, String outputFormat) {

	public String baseUrl() {
		if (endpoint != null && !endpoint.isBlank()) return endpoint.replaceAll("/+$", "");
		return "https://" + region + ".tts.speech.microsoft.com";
	}
}
