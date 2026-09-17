package com.example.chat.speech;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.speech.* (application.yml ↔ infra/.env.example 1:1). STT/TTS 는 서버 API 방식, 공급자는 환경변수로 선택 (D-007).
 * OpenAI 는 OmniRoute 를 거치지 않고 직접 부른다 (D-026) — base-url 은 테스트에서 MockWebServer 로 바꾼다.
 */
@ConfigurationProperties(prefix = "app.speech")
public record SpeechProperties(
	String sttProvider,
	String ttsProvider,
	String tmpDir,
	int maxAudioSeconds,
	int maxTtsChars,
	String openaiApiKey,
	String openaiBaseUrl,
	String openaiSttModel,
	String openaiTtsModel,
	String clovaSpeechInvokeUrl,
	String clovaSpeechSecret,
	String clovaVoiceClientId,
	String clovaVoiceClientSecret,
	String ttsVoice,
	int timeoutSeconds
) {
	public long maxAudioMs() {
		return maxAudioSeconds * 1000L;
	}

	public Duration timeout() {
		return Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 30);
	}

	public boolean hasOpenaiApiKey() {
		return openaiApiKey != null && !openaiApiKey.isBlank();
	}
}
