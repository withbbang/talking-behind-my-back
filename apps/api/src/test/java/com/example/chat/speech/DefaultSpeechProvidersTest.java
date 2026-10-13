package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.speech.azure.AzureTtsProvider;
import com.example.chat.speech.groq.GroqSttProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** T-040·T-041 기본 공급자: STT = Groq 직접, TTS = Azure (D-044). 실제 호출은 하지 않는다. */
@SpringBootTest(properties = {"app.speech.azure.key=test", "app.speech.groq.api-key=test"})
class DefaultSpeechProvidersTest {

	@Autowired SttProvider stt;
	@Autowired TtsProvider tts;

	@Test
	void 기본은_STT_groq_TTS_azure() {
		assertThat(stt).isInstanceOf(GroqSttProvider.class);
		assertThat(stt.name()).isEqualTo("groq");
		assertThat(tts).isInstanceOf(AzureTtsProvider.class);
		assertThat(tts.name()).isEqualTo("azure");
	}
}
