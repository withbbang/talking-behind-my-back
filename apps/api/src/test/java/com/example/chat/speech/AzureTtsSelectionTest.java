package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.speech.azure.AzureTtsProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** T-040 TTS_PROVIDER=azure 면 Azure 공급자 빈이 뜬다 (D-044). 실제 호출은 하지 않는다. */
@SpringBootTest(properties = {"app.speech.tts-provider=azure", "app.speech.azure.key=test", "app.speech.azure.region=koreacentral"})
class AzureTtsSelectionTest {

	@Autowired TtsProvider tts;

	@Test
	void azure_로_설정하면_azure_공급자가_뜬다() {
		assertThat(tts).isInstanceOf(AzureTtsProvider.class);
		assertThat(tts.name()).isEqualTo("azure");
	}
}
