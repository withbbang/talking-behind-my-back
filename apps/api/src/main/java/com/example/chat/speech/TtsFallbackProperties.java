package com.example.chat.speech;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.tts-fallback.* — 1차 TTS 실패 시 폴백 (D-043). model 이 비면 폴백 없음.
 * voices 는 폴백 공급자용 언어 표(1차 표와 별개 — gTTS 는 voice 를 언어코드로 쓴다, D-041).
 */
@ConfigurationProperties(prefix = "app.speech.tts-fallback")
public record TtsFallbackProperties(String model, String voice, Map<String, String> voices, int cooldownSeconds) {

	public TtsFallbackProperties {
		voices = voices == null ? Map.of() : Map.copyOf(voices);
		if (model != null && !model.isBlank() && (voice == null || voice.isBlank())) {
			throw new IllegalArgumentException("app.speech.tts-fallback.voice (TTS_FALLBACK_VOICE) must not be blank when a fallback model is set (D-043)");
		}
	}

	public boolean enabled() {
		return model != null && !model.isBlank();
	}
}
