package com.example.chat.speech;

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
		if (!props.auto()) return defaultVoice;
		String lang = TtsLanguage.detect(text);
		String voice = lang == null ? null : props.voices().get(lang);
		return voice == null || voice.isBlank() ? defaultVoice : voice;
	}
}
