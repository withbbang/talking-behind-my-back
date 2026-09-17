package com.example.chat.speech.openai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.SttProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.reactive.function.client.WebClient;

/** T-009 OpenAI `/audio/transcriptions`(verbose_json) 호출·파싱. MockWebServer 로 격리. */
class OpenAiSttProviderTest {

	@TempDir Path tmp;
	private MockWebServer server;
	private OpenAiSttProvider provider;

	@BeforeEach
	void setUp() throws IOException {
		server = new MockWebServer();
		server.start();
		provider = newProvider(30);
	}

	@AfterEach
	void tearDown() throws IOException {
		server.shutdown();
	}

	private OpenAiSttProvider newProvider(int timeoutSeconds) {
		SpeechProperties props = new SpeechProperties("openai", "openai", tmp.toString(), 60, 1000,
			"sk-test", server.url("/v1").toString(), "whisper-1", "tts-1", "", "", "", "", "alloy", timeoutSeconds);
		WebClient webClient = WebClient.builder().baseUrl(props.openaiBaseUrl())
			.defaultHeader("Authorization", "Bearer " + props.openaiApiKey()).build();
		return new OpenAiSttProvider(webClient, props);
	}

	private Path audioFile(String name, String content) throws IOException {
		Path f = tmp.resolve(name);
		Files.writeString(f, content);
		return f;
	}

	@Test
	void multipart_로_파일과_모델을_보내고_text_와_duration_초를_ms_로_돌려준다() throws Exception {
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json")
			.setBody("{\"text\":\"오늘 날씨 어때\",\"duration\":2.4,\"language\":\"korean\"}"));

		SttProvider.Transcript t = provider.transcribe(audioFile("a.webm", "opus-bytes"), "audio/webm;codecs=opus");

		assertThat(t.text()).isEqualTo("오늘 날씨 어때");
		assertThat(t.durationMs()).isEqualTo(2_400);
		assertThat(provider.name()).isEqualTo("openai");

		RecordedRequest req = server.takeRequest(1, TimeUnit.SECONDS);
		assertThat(req.getPath()).isEqualTo("/v1/audio/transcriptions");
		assertThat(req.getHeader("Authorization")).isEqualTo("Bearer sk-test");
		assertThat(req.getHeader("Content-Type")).startsWith("multipart/form-data");
		String body = req.getBody().readUtf8();
		assertThat(body).contains("name=\"file\"; filename=\"a.webm\"");
		assertThat(body).contains("opus-bytes");
		assertThat(body).contains("name=\"model\"").contains("whisper-1");
		assertThat(body).contains("name=\"response_format\"").contains("verbose_json");
	}

	@Test
	void duration_이_없으면_0() throws Exception {
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody("{\"text\":\"안녕\"}"));

		SttProvider.Transcript t = provider.transcribe(audioFile("a.mp4", "x"), "audio/mp4");

		assertThat(t.text()).isEqualTo("안녕");
		assertThat(t.durationMs()).isZero();
	}

	@Test
	void 비_2xx_는_SpeechException() throws Exception {
		server.enqueue(new MockResponse().setResponseCode(500).setBody("{\"error\":\"boom\"}"));

		assertThatThrownBy(() -> provider.transcribe(audioFile("a.webm", "x"), "audio/webm"))
			.isInstanceOf(SpeechException.class)
			.hasMessageContaining("500");
	}

	@Test
	void text_가_없는_응답은_SpeechException() throws Exception {
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody("{\"foo\":1}"));

		assertThatThrownBy(() -> provider.transcribe(audioFile("a.webm", "x"), "audio/webm"))
			.isInstanceOf(SpeechException.class);
	}

	@Test
	void 타임아웃은_SpeechException() throws Exception {
		provider = newProvider(1);
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json")
			.setBody("{\"text\":\"늦음\"}").setBodyDelay(3, TimeUnit.SECONDS));

		assertThatThrownBy(() -> provider.transcribe(audioFile("a.webm", "x"), "audio/webm"))
			.isInstanceOf(SpeechException.class);
	}
}
