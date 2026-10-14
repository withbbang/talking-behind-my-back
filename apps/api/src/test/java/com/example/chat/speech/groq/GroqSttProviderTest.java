package com.example.chat.speech.groq;

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

/** T-041 Groq `/openai/v1/audio/transcriptions`(OpenAI 호환, verbose_json) 직접 호출·파싱 (D-044). MockWebServer 로 격리. */
class GroqSttProviderTest {

	@TempDir Path tmp;
	private MockWebServer server;
	private GroqSttProvider provider;

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

	private GroqSttProvider newProvider(int timeoutSeconds) {
		SpeechProperties props = new SpeechProperties("groq", "azure", tmp.toString(), 60, 1000,
			"whisper-large-v3", "", "", "", "", "alloy", timeoutSeconds);
		GroqSpeechProperties groq = new GroqSpeechProperties(server.url("/openai/v1").toString(), "groq-test");
		return new GroqSttProvider(WebClient.builder(), groq, props);
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
		assertThat(provider.name()).isEqualTo("groq");

		RecordedRequest req = server.takeRequest(1, TimeUnit.SECONDS);
		assertThat(req.getPath()).isEqualTo("/openai/v1/audio/transcriptions");
		assertThat(req.getHeader("Authorization")).isEqualTo("Bearer groq-test");
		assertThat(req.getHeader("Content-Type")).startsWith("multipart/form-data");
		String body = req.getBody().readUtf8();
		assertThat(body).contains("name=\"file\"; filename=\"a.webm\"");
		assertThat(body).contains("opus-bytes");
		assertThat(body).contains("name=\"model\"").contains("whisper-large-v3");
		assertThat(body).contains("name=\"response_format\"").contains("verbose_json");
	}

	@Test
	void duration_이_없으면_0() throws Exception {
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody("{\"text\":\"안녕\"}"));

		SttProvider.Transcript t = provider.transcribe(audioFile("a.mp4", "x"), "audio/mp4");

		assertThat(t.text()).isEqualTo("안녕");
		assertThat(t.durationMs()).isZero();
	}

	private SttProvider.Transcript transcribeJson(String json) throws IOException {
		server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody(json));
		return provider.transcribe(audioFile("a.webm", "x"), "audio/webm");
	}

	private static String seg(String text, double noSpeechProb, double avgLogprob) {
		return "{\"text\":\"" + text + "\",\"no_speech_prob\":" + noSpeechProb + ",\"avg_logprob\":" + avgLogprob + "}";
	}

	// T-044 (D-045) — 아래 수치는 2026-10-14 Groq whisper-large-v3 실측 응답 그대로.
	@Test
	void 완전_무음의_환각_you_는_빈_텍스트() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\" you\",\"duration\":5.0,\"segments\":[" + seg(" you", 0.701, -0.708) + "]}");

		assertThat(t.text()).isEmpty();
		assertThat(t.durationMs()).isEqualTo(5_000);
	}

	@Test
	void 큰_잡음의_엉뚱한_전사는_avg_logprob_가_낮아_빈_텍스트() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\" Kjell Kronström\",\"segments\":[" + seg(" Kjell Kronström", 0.098, -1.345) + "]}");

		assertThat(t.text()).isEmpty();
	}

	@Test
	void 약한_잡음의_구두점만_남은_전사는_빈_텍스트() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\" .\",\"segments\":[" + seg(" .", 0.249, -0.215) + "]}");

		assertThat(t.text()).isEmpty();
	}

	@Test
	void 실제_발화는_그대로_작은_목소리도() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\" 오늘 회사에서 부장이 또 늦게 왔어.\",\"segments\":["
			+ seg(" 오늘 회사에서 부장이 또 늦게 왔어.", 0.0, -0.028) + "]}");

		assertThat(t.text()).isEqualTo(" 오늘 회사에서 부장이 또 늦게 왔어.");
	}

	@Test
	void 발화_뒤_무음_세그먼트의_환각만_떼어낸다() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\" 안녕 you\",\"segments\":["
			+ seg(" 안녕", 0.001, -0.2) + "," + seg(" you", 0.701, -0.708) + "]}");

		assertThat(t.text()).isEqualTo(" 안녕");
	}

	@Test
	void segments_가_없으면_text_그대로() throws Exception {
		SttProvider.Transcript t = transcribeJson("{\"text\":\"Thank you.\"}");

		assertThat(t.text()).isEqualTo("Thank you.");
	}

	@Test
	void 비_2xx_는_SpeechException() throws Exception {
		server.enqueue(new MockResponse().setResponseCode(500).setBody("{\"error\":\"boom\"}"));

		assertThatThrownBy(() -> provider.transcribe(audioFile("a.webm", "x"), "audio/webm"))
			.isInstanceOf(SpeechException.class)
			.hasMessageContaining("500");
	}

	@Test
	void 상류_400_은_오류_메시지를_예외에_담는다_원인_추적용() throws Exception {
		server.enqueue(new MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
			.setBody("{\"error\":{\"message\":\"could not process file - is it a valid media file?\",\"type\":\"invalid_request_error\"}}"));

		assertThatThrownBy(() -> provider.transcribe(audioFile("a.mp4", "x"), "audio/mp4"))
			.isInstanceOf(SpeechException.class)
			.hasMessageContaining("400")
			.hasMessageContaining("could not process file");
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
