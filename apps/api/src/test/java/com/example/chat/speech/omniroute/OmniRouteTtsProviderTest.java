package com.example.chat.speech.omniroute;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okio.Buffer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** T-009 OmniRoute `/v1/audio/speech`(OpenAI 호환) 호출 (D-027). MockWebServer 로 격리. */
class OmniRouteTtsProviderTest {

	private MockWebServer server;
	private OmniRouteTtsProvider provider;

	@BeforeEach
	void setUp() throws IOException {
		server = new MockWebServer();
		server.start();
		SpeechProperties props = new SpeechProperties("omniroute", "omniroute", "/tmp/x", 60, 1000,
			"openai/whisper-1", "openai/tts-1", "", "", "", "", "alloy", 30);
		WebClient webClient = WebClient.builder().baseUrl(server.url("/v1").toString())
			.defaultHeader("Authorization", "Bearer omni-test").build();
		provider = new OmniRouteTtsProvider(webClient, props);
	}

	@AfterEach
	void tearDown() throws IOException {
		server.shutdown();
	}

	@Test
	void json_으로_모델_입력_음성_mp3_를_보내고_바이트를_그대로_돌려준다() throws Exception {
		byte[] mp3 = new byte[]{(byte) 0xFF, (byte) 0xFB, 0x10, 0x00, 7};
		server.enqueue(new MockResponse().setHeader("Content-Type", "audio/mpeg").setBody(new Buffer().write(mp3)));

		byte[] out = provider.synthesize("안녕, 반가워", "nova");

		assertThat(out).isEqualTo(mp3);
		assertThat(provider.name()).isEqualTo("omniroute");

		RecordedRequest req = server.takeRequest(1, TimeUnit.SECONDS);
		assertThat(req.getPath()).isEqualTo("/v1/audio/speech");
		assertThat(req.getHeader("Authorization")).isEqualTo("Bearer omni-test");
		assertThat(req.getHeader("Content-Type")).startsWith("application/json");
		JsonNode body = new ObjectMapper().readTree(req.getBody().readUtf8());
		assertThat(body.path("model").asString()).isEqualTo("openai/tts-1");
		assertThat(body.path("input").asString()).isEqualTo("안녕, 반가워");
		assertThat(body.path("voice").asString()).isEqualTo("nova");
		assertThat(body.path("response_format").asString()).isEqualTo("mp3");
	}

	@Test
	void 비_2xx_는_SpeechException() {
		server.enqueue(new MockResponse().setResponseCode(429).setBody("{\"error\":\"rate\"}"));

		assertThatThrownBy(() -> provider.synthesize("안녕", "alloy"))
			.isInstanceOf(SpeechException.class)
			.hasMessageContaining("429");
	}

	@Test
	void 빈_본문은_SpeechException() {
		server.enqueue(new MockResponse().setHeader("Content-Type", "audio/mpeg").setBody(new Buffer()));

		assertThatThrownBy(() -> provider.synthesize("안녕", "alloy"))
			.isInstanceOf(SpeechException.class);
	}
}
