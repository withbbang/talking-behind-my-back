package com.example.chat.speech.azure;

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

/** T-040 Azure Speech TTS REST(SSML → mp3) (D-044 (1)). MockWebServer 로 격리. */
class AzureTtsProviderTest {

	private MockWebServer server;

	@BeforeEach
	void setUp() throws IOException {
		server = new MockWebServer();
		server.start();
	}

	@AfterEach
	void tearDown() throws IOException {
		server.shutdown();
	}

	private AzureTtsProvider provider(int timeoutSeconds) {
		SpeechProperties props = new SpeechProperties("groq", "azure", "/tmp/x", 60, 1000,
			"whisper-large-v3", "", "", "", "", "ko-KR-SunHiNeural", timeoutSeconds);
		AzureSpeechProperties azure = new AzureSpeechProperties("azure-test-key", "koreacentral",
			server.url("/").toString(), "audio-24khz-48kbitrate-mono-mp3");
		return new AzureTtsProvider(WebClient.builder(), azure, props);
	}

	@Test
	void SSML_과_키_출력형식_헤더로_보내고_mp3_바이트를_그대로_돌려준다() throws Exception {
		byte[] mp3 = new byte[]{(byte) 0xFF, (byte) 0xF3, 0x44, 0x00, 9};
		server.enqueue(new MockResponse().setHeader("Content-Type", "audio/mpeg").setBody(new Buffer().write(mp3)));

		byte[] out = provider(30).synthesize("안녕, 반가워", "ko-KR-SunHiNeural");

		assertThat(out).isEqualTo(mp3);
		RecordedRequest req = server.takeRequest(5, TimeUnit.SECONDS);
		assertThat(req).isNotNull();
		assertThat(req.getMethod()).isEqualTo("POST");
		assertThat(req.getPath()).isEqualTo("/cognitiveservices/v1");
		assertThat(req.getHeader("Ocp-Apim-Subscription-Key")).isEqualTo("azure-test-key");
		assertThat(req.getHeader("X-Microsoft-OutputFormat")).isEqualTo("audio-24khz-48kbitrate-mono-mp3");
		assertThat(req.getHeader("Content-Type")).startsWith("application/ssml+xml");
		assertThat(req.getBody().readUtf8()).isEqualTo(
			"<speak version='1.0' xml:lang='ko-KR'><voice name='ko-KR-SunHiNeural'>안녕, 반가워</voice></speak>");
	}

	@Test
	void xml_lang_은_voice_접두를_따르고_텍스트는_XML_이스케이프() throws Exception {
		server.enqueue(new MockResponse().setBody(new Buffer().write(new byte[]{1})));

		provider(30).synthesize("Tom & \"Jerry\" <3 it's", "en-US-AriaNeural");

		assertThat(server.takeRequest(5, TimeUnit.SECONDS).getBody().readUtf8()).isEqualTo(
			"<speak version='1.0' xml:lang='en-US'><voice name='en-US-AriaNeural'>"
				+ "Tom &amp; &quot;Jerry&quot; &lt;3 it&apos;s</voice></speak>");
	}

	@Test
	void 상류_오류는_상태코드를_담은_SpeechException() {
		server.enqueue(new MockResponse().setResponseCode(429));

		assertThatThrownBy(() -> provider(30).synthesize("안녕", "ko-KR-SunHiNeural"))
			.isInstanceOf(SpeechException.class)
			.hasMessageContaining("429");
	}

	@Test
	void 빈_본문은_SpeechException() {
		server.enqueue(new MockResponse().setResponseCode(200));

		assertThatThrownBy(() -> provider(30).synthesize("안녕", "ko-KR-SunHiNeural"))
			.isInstanceOf(SpeechException.class);
	}

	@Test
	void 타임아웃은_SpeechException() {
		server.enqueue(new MockResponse().setBody("x").setHeadersDelay(3, TimeUnit.SECONDS));

		assertThatThrownBy(() -> provider(1).synthesize("안녕", "ko-KR-SunHiNeural"))
			.isInstanceOf(SpeechException.class);
	}

	@Test
	void endpoint_가_비면_region_으로_기본_주소() {
		AzureSpeechProperties azure = new AzureSpeechProperties("k", "koreacentral", "", "audio-24khz-48kbitrate-mono-mp3");

		assertThat(azure.baseUrl()).isEqualTo("https://koreacentral.tts.speech.microsoft.com");
	}
}
