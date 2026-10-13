package com.example.chat.speech;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.* (application.yml ↔ infra/.env.example 1:1). STT/TTS 는 서버 API 방식, 공급자는 환경변수로 선택 (D-007).
 * 기본 공급자: STT = Groq 직접(`app.speech.groq.*`), TTS = Azure Speech(`app.speech.azure.*`) (D-044). sttModel 은 Groq 모델명.
 */
@ConfigurationProperties(prefix = "app.speech")
public record SpeechProperties(
	String sttProvider,
	String ttsProvider,
	String tmpDir,
	int maxAudioSeconds,
	int maxTtsChars,
	String sttModel,
	String clovaSpeechInvokeUrl,
	String clovaSpeechSecret,
	String clovaVoiceClientId,
	String clovaVoiceClientSecret,
	String ttsVoice,
	int timeoutSeconds
) {
	/** tts-voice 는 언어 판정 불가 시 기본 voice(D-042) — 비면 기동 시점에 막는다. */
	public SpeechProperties {
		if (ttsVoice == null || ttsVoice.isBlank()) {
			throw new IllegalArgumentException("app.speech.tts-voice (TTS_VOICE) must not be blank — e.g. ko-KR-SunHiNeural (D-042)");
		}
	}

	public long maxAudioMs() {
		return maxAudioSeconds * 1000L;
	}

	public Duration timeout() {
		return Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 30);
	}
}
