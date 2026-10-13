package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/** D-028: tts-voice 는 비면 안 된다 — 판정 불가 시 기본 voice(D-042). 기동 시점에 막는다. */
class SpeechPropertiesTest {

	private static SpeechProperties props(String voice, int timeout) {
		return new SpeechProperties("groq", "azure", "/tmp/audio", 60, 1000,
			"whisper-large-v3", "", "", "", "", voice, timeout);
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
