package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/** D-028: tts-voice 를 비우면 OmniRoute 가 alloy 를 넣어 Edge 사이드카가 500 — 기동 시점에 막는다. */
class SpeechPropertiesTest {

	private static SpeechProperties props(String voice, int timeout) {
		return new SpeechProperties("omniroute", "omniroute", "/tmp/audio", 60, 1000,
			"groq/whisper-large-v3", "edge/tts-1", "", "", "", "", voice, timeout);
	}

	@Test
	void tts_voice_가_비면_기동_실패() {
		assertThatThrownBy(() -> props("", 30)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("tts-voice");
		assertThatThrownBy(() -> props(null, 30)).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> props("   ", 30)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void timeout_은_0_이하면_30초_기본() {
		assertThat(props("ko-KR-SunHiNeural", 0).timeout()).isEqualTo(Duration.ofSeconds(30));
		assertThat(props("ko-KR-SunHiNeural", 5).timeout()).isEqualTo(Duration.ofSeconds(5));
	}
}
