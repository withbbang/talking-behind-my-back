package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.speech.clova.ClovaSttProvider;
import com.example.chat.speech.clova.ClovaTtsProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** D-007: STT_PROVIDER/TTS_PROVIDER 환경변수로 공급자 빈이 바뀐다. 기본(openai)은 다른 컨텍스트 테스트가 이미 덮는다. */
@SpringBootTest(properties = {"app.speech.stt-provider=clova", "app.speech.tts-provider=clova"})
class SpeechProviderSelectionTest {

	@Autowired SttProvider stt;
	@Autowired TtsProvider tts;

	@Test
	void clova_로_설정하면_clova_스텁이_뜬다() {
		assertThat(stt).isInstanceOf(ClovaSttProvider.class);
		assertThat(tts).isInstanceOf(ClovaTtsProvider.class);
	}
}
