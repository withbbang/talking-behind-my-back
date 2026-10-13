package com.example.chat.speech;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.tts-language.* — voice 없는 TTS 요청의 언어 자동 선택 (D-042 (3)).
 * voices 는 판정 언어(ko/en/ja/zh) → 공급자 voice. gTTS 는 voice 를 언어코드로 쓴다(D-041).
 */
@ConfigurationProperties(prefix = "app.speech.tts-language")
public record TtsLanguageProperties(boolean auto, Map<String, String> voices) {

	public TtsLanguageProperties {
		voices = voices == null ? Map.of() : Map.copyOf(voices);
	}
}
