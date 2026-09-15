package com.example.chat.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * T-007 OmniRoute(OpenAI 호환) 스트림 파싱. MockWebServer 로 격리(외부 호출 없음).
 * 스프링 컨텍스트 없이 WebClient 를 직접 만든다 — WebClientConfig 는 baseUrl/헤더만 얹으므로 여기서 검증할 게 없다.
 */
class OmniRouteClientTest {

	private MockWebServer server;
	private OmniRouteClient client;

	@BeforeEach
	void setUp() throws IOException {
		server = new MockWebServer();
		server.start();
		client = newClient(30);
	}

	@AfterEach
	void tearDown() throws IOException {
		server.shutdown();
	}

	private OmniRouteClient newClient(int timeoutSeconds) {
		LlmProperties props = new LlmProperties(server.url("/v1").toString(), "", "test-model", 30, timeoutSeconds);
		WebClient webClient = WebClient.builder().baseUrl(props.baseUrl()).build();
		return new OmniRouteClient(webClient, props);
	}

	private static MockResponse sse(String... events) {
		StringBuilder body = new StringBuilder();
		for (String e : events) body.append("data: ").append(e).append("\n\n");
		return new MockResponse()
			.setHeader("Content-Type", "text/event-stream")
			.setBody(body.toString());
	}

	private static String chunk(String content) {
		return "{\"id\":\"c1\",\"model\":\"gpt-x\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"" + content + "\"},\"finish_reason\":null}]}";
	}

	private static OmniRouteClient.ChatMessage user(String content) {
		return new OmniRouteClient.ChatMessage("user", content);
	}

	@Test
	void 델타를_순서대로_전달하고_usage_와_모델을_돌려준다() throws Exception {
		server.enqueue(sse(
			"{\"id\":\"c1\",\"model\":\"gpt-x\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"},\"finish_reason\":null}]}",
			chunk("안녕"), chunk("하세요"), chunk("!"),
			"{\"id\":\"c1\",\"model\":\"gpt-x\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}",
			"{\"id\":\"c1\",\"model\":\"gpt-x\",\"choices\":[],\"usage\":{\"prompt_tokens\":320,\"completion_tokens\":18,\"total_tokens\":338}}",
			"[DONE]"));
		List<String> deltas = new ArrayList<>();

		OmniRouteClient.Result result = client.stream(List.of(
			new OmniRouteClient.ChatMessage("system", "너는 친구다"),
			user("[개설자 철수] 안녕")), deltas::add);

		assertThat(deltas).containsExactly("안녕", "하세요", "!");
		assertThat(result.content()).isEqualTo("안녕하세요!");
		assertThat(result.promptTokens()).isEqualTo(320);
		assertThat(result.completionTokens()).isEqualTo(18);
		assertThat(result.model()).isEqualTo("gpt-x");

		RecordedRequest req = server.takeRequest(1, TimeUnit.SECONDS);
		assertThat(req).isNotNull();
		assertThat(req.getPath()).isEqualTo("/v1/chat/completions");
		String body = req.getBody().readUtf8();
		assertThat(body).contains("\"model\":\"test-model\"");
		assertThat(body).contains("\"stream\":true");
		assertThat(body).contains("\"include_usage\":true");
		assertThat(body).contains("\"role\":\"system\"").contains("너는 친구다");
		assertThat(body).contains("[개설자 철수] 안녕");
	}

	@Test
	void usage_없이_끝나면_토큰은_null_이고_모델은_응답값() {
		server.enqueue(sse(chunk("a"), chunk("b"), "[DONE]"));
		List<String> deltas = new ArrayList<>();

		OmniRouteClient.Result result = client.stream(List.of(user("hi")), deltas::add);

		assertThat(result.content()).isEqualTo("ab");
		assertThat(result.promptTokens()).isNull();
		assertThat(result.completionTokens()).isNull();
		assertThat(result.model()).isEqualTo("gpt-x");
	}

	@Test
	void 파싱_불가_라인은_건너뛴다() {
		server.enqueue(sse(chunk("a"), "not-json", "{\"choices\":[{\"delta\":{\"content\":null}}]}", chunk("b"), "[DONE]"));
		List<String> deltas = new ArrayList<>();

		OmniRouteClient.Result result = client.stream(List.of(user("hi")), deltas::add);

		assertThat(deltas).containsExactly("a", "b");
		assertThat(result.content()).isEqualTo("ab");
	}

	@Test
	void 상류_5xx_는_LlmException() {
		server.enqueue(new MockResponse().setResponseCode(502).setBody("{\"error\":\"bad\"}"));

		assertThatThrownBy(() -> client.stream(List.of(user("hi")), d -> {}))
			.isInstanceOf(LlmException.class)
			.hasMessageContaining("502");
	}

	@Test
	void 타임아웃은_LlmException() {
		server.enqueue(sse(chunk("partial")).setBodyDelay(3, TimeUnit.SECONDS));
		client = newClient(1);

		assertThatThrownBy(() -> client.stream(List.of(user("hi")), d -> {}))
			.isInstanceOf(LlmException.class);
	}

	@Test
	void 연결_거부는_LlmException() throws IOException {
		server.shutdown();

		assertThatThrownBy(() -> client.stream(List.of(user("hi")), d -> {}))
			.isInstanceOf(LlmException.class);
	}
}
