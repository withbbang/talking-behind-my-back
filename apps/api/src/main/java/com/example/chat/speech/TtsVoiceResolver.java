package com.example.chat.speech;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** voice 없는 TTS 요청의 voice 를 고른다 — 텍스트 언어 → 설정 표, 없거나 판정 불가면 `TTS_VOICE` 기본 (D-042). */
@Component
public class TtsVoiceResolver {

	private final TtsLanguageProperties props;
	private final String defaultVoice;

	@Autowired
	public TtsVoiceResolver(TtsLanguageProperties props, SpeechProperties speechProps) {
		this(props, speechProps.ttsVoice());
	}

	TtsVoiceResolver(TtsLanguageProperties props, String defaultVoice) {
		this.props = props;
		this.defaultVoice = defaultVoice;
	}

	public String resolve(String text) {
		return voiceFor(language(text));
	}

	/** 자동 판정이 꺼져 있으면 null — 그러면 어느 표든 기본 voice 로 떨어진다. */
	public String language(String text) {
		return props.auto() ? TtsLanguage.detect(text) : null;
	}

	public String voiceFor(String lang) {
		return pick(lang, props.voices(), defaultVoice);
	}

	/** 폴백 표(D-043)도 같은 규칙: 표에 없거나 비면 기본. */
	public static String pick(String lang, Map<String, String> voices, String defaultVoice) {
		String voice = lang == null ? null : voices.get(lang);
		return voice == null || voice.isBlank() ? defaultVoice : voice;
	}
}
