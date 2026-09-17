package com.example.chat.speech.clova;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SttProvider;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Clova Speech 스텁 (D-007). STT_PROVIDER=clova 로 켜면 뜨지만 호출은 502 로 떨어진다 — 구현은 별도 T. */
@Component
@ConditionalOnProperty(name = "app.speech.stt-provider", havingValue = "clova")
public class ClovaSttProvider implements SttProvider {

	@Override
	public Transcript transcribe(Path audio, String contentType) {
		throw new SpeechException("clova stt not implemented", null);
	}

	@Override
	public String name() {
		return "clova";
	}
}
