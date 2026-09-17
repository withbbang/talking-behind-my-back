package com.example.chat.speech.clova;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.TtsProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Clova Voice 스텁 (D-007). TTS_PROVIDER=clova 로 켜면 뜨지만 호출은 502 로 떨어진다 — 구현은 별도 T. */
@Component
@ConditionalOnProperty(name = "app.speech.tts-provider", havingValue = "clova")
public class ClovaTtsProvider implements TtsProvider {

	@Override
	public byte[] synthesize(String text, String voice) {
		throw new SpeechException("clova tts not implemented", null);
	}

	@Override
	public String name() {
		return "clova";
	}
}
