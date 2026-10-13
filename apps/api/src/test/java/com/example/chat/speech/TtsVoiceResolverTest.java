package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** T-038 판정 언어 → voice 표, 없거나 판정 불가면 기본 voice (D-042 (3)). */
class TtsVoiceResolverTest {

	private static final Map<String, String> VOICES = Map.of("ko", "ko", "en", "en", "ja", "ja", "zh", "zh-CN");

	private static TtsVoiceResolver resolver(boolean auto, Map<String, String> voices) {
		return new TtsVoiceResolver(new TtsLanguageProperties(auto, voices), "default-voice");
	}

	@Test
	void 판정한_언어의_voice() {
		TtsVoiceResolver r = resolver(true, VOICES);

		assertThat(r.resolve("Hello there")).isEqualTo("en");
		assertThat(r.resolve("안녕")).isEqualTo("ko");
		assertThat(r.resolve("今天很好")).isEqualTo("zh-CN");
	}

	@Test
	void 판정_불가면_기본() {
		assertThat(resolver(true, VOICES).resolve("123 😀")).isEqualTo("default-voice");
	}

	@Test
	void 표에_없는_언어면_기본() {
		assertThat(resolver(true, Map.of("ko", "ko")).resolve("Hello")).isEqualTo("default-voice");
	}

	@Test
	void 자동_판정을_끄면_항상_기본() {
		assertThat(resolver(false, VOICES).resolve("Hello")).isEqualTo("default-voice");
	}

	@Test
	void 표가_비어도_기본() {
		assertThat(resolver(true, null).resolve("Hello")).isEqualTo("default-voice");
	}
}
