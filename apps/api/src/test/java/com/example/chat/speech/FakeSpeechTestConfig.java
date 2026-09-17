package com.example.chat.speech;

import java.nio.file.Path;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** T-009 컨트롤러 테스트용: OmniRoute 대신 스크립트형 fake 공급자. `@Import(FakeSpeechTestConfig.class)`. */
@TestConfiguration
public class FakeSpeechTestConfig {

	public static class FakeStt implements SttProvider {
		public Transcript reply = new Transcript("오늘 날씨 어때", 2_400);
		public SpeechException failWith;
		public int calls;

		@Override
		public Transcript transcribe(Path audio, String contentType) {
			calls++;
			if (failWith != null) throw failWith;
			return reply;
		}

		@Override
		public String name() {
			return "fake";
		}

		public void reset() {
			reply = new Transcript("오늘 날씨 어때", 2_400);
			failWith = null;
			calls = 0;
		}
	}

	public static class FakeTts implements TtsProvider {
		public byte[] reply = new byte[]{(byte) 0xFF, (byte) 0xFB, 1, 2, 3};
		public SpeechException failWith;
		public String lastText;
		public String lastVoice;

		@Override
		public byte[] synthesize(String text, String voice) {
			lastText = text;
			lastVoice = voice;
			if (failWith != null) throw failWith;
			return reply;
		}

		@Override
		public String name() {
			return "fake";
		}

		public void reset() {
			failWith = null;
			lastText = null;
			lastVoice = null;
		}
	}

	@Bean
	@Primary
	public FakeStt fakeStt() {
		return new FakeStt();
	}

	@Bean
	@Primary
	public FakeTts fakeTts() {
		return new FakeTts();
	}
}
