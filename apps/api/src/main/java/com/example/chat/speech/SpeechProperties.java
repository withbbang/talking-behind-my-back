package com.example.chat.speech;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.* (application.yml ↔ infra/.env.example 1:1). STT/TTS 는 서버 API 방식, 공급자는 환경변수로 선택 (D-007).
 * 기본 공급자 `omniroute` 는 LLM 과 같은 OmniRoute(`app.llm.base-url`·api-key)의 OpenAI 호환 `/v1/audio/*` 를 쓴다 (D-027).
 * 모델은 OmniRoute 규칙대로 `provider/model`(예: `openai/whisper-1`) 또는 대시보드 alias.
 */
@ConfigurationProperties(prefix = "app.speech")
public record SpeechProperties(
	String sttProvider,
	String ttsProvider,
	String tmpDir,
	int maxAudioSeconds,
	int maxTtsChars,
	String sttModel,
	String ttsModel,
	String clovaSpeechInvokeUrl,
	String clovaSpeechSecret,
	String clovaVoiceClientId,
	String clovaVoiceClientSecret,
	String ttsVoice,
	int timeoutSeconds
) {
	/** D-028: tts-voice 를 비우면 OmniRoute 가 alloy 를 넣어 Edge 사이드카가 500 — 기동 시점에 막는다. */
	public SpeechProperties {
		if (ttsVoice == null || ttsVoice.isBlank()) {
			throw new IllegalArgumentException("app.speech.tts-voice (TTS_VOICE) must not be blank — e.g. ko-KR-SunHiNeural (D-028)");
		}
	}

	public long maxAudioMs() {
		return maxAudioSeconds * 1000L;
	}

	public Duration timeout() {
		return Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 30);
	}
}
