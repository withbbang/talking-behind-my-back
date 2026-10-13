package com.example.chat.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.llm.LlmClient.ChatMessage;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * T-036 Claude Messages API 스트림 (D-040). MockWebServer 가 Anthropic SSE 를 흉내낸다(외부 호출 없음).
 * 실제 SDK 파싱 경로를 타도록 baseUrl 만 바꾼다. 재시도는 0 — 오류 케이스가 백오프로 느려지지 않게.
 */
class ClaudeClientTest {

	private MockWebServer server;
	private final ObjectMapper json = new ObjectMapper();

	@BeforeEach
	void setUp() throws IOException {
		server = new MockWebServer();
		server.start();
	}

	@AfterEach
	void tearDown() throws IOException {
		server.shutdown();
	}

	private ClaudeClient newClient(int timeoutSeconds) {
		ClaudeProperties props = new ClaudeProperties("test-key", server.url("/").toString(), "claude-haiku-5-5", "low", 16000, 0);
		LlmProperties llm = new LlmProperties("", "", "unused", 30, timeoutSeconds, "");
		return new ClaudeClient(props, llm);
	}

	private static String event(String type, String data) {
		return "event: " + type + "\ndata: " + data + "\n\n";
	}

	private static MockResponse sse(String... events) {
		return new MockResponse()
			.setHeader("Content-Type", "text/event-stream")
			.setBody(String.join("", events));
	}

	private static String messageStart(int inputTokens, int cacheRead) {
		return event("message_start", "{\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\","
			+ "\"model\":\"claude-haiku-5-5\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,"
			+ "\"usage\":{\"input_tokens\":" + inputTokens + ",\"cache_read_input_tokens\":" + cacheRead + ",\"output_tokens\":1}}}");
	}

	/** thinking 은 display omitted 라 서명만 온다 — 델타로 흘리면 안 된다. */
	private static String thinkingBlock(int index) {
		return event("content_block_start", "{\"type\":\"content_block_start\",\"index\":" + index + ",\"content_block\":{\"type\":\"thinking\",\"thinking\":\"\",\"signature\":\"\"}}")
			+ event("content_block_delta", "{\"type\":\"content_block_delta\",\"index\":" + index + ",\"delta\":{\"type\":\"signature_delta\",\"signature\":\"sig\"}}")
			+ event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":" + index + "}");
	}

	private static String textBlock(int index, String... deltas) {
		StringBuilder sb = new StringBuilder(event("content_block_start",
			"{\"type\":\"content_block_start\",\"index\":" + index + ",\"content_block\":{\"type\":\"text\",\"text\":\"\"}}"));
		for (String d : deltas) {
			sb.append(event("content_block_delta",
				"{\"type\":\"content_block_delta\",\"index\":" + index + ",\"delta\":{\"type\":\"text_delta\",\"text\":\"" + d + "\"}}"));
		}
		return sb.append(event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":" + index + "}")).toString();
	}

	private static String messageEnd(String stopReason, int outputTokens) {
		return event("message_delta", "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"" + stopReason + "\",\"stop_sequence\":null},"
			+ "\"usage\":{\"output_tokens\":" + outputTokens + "}}")
			+ event("message_stop", "{\"type\":\"message_stop\"}");
	}

	@Test
	void streamsTextDeltasInOrderAndReturnsUsage() {
		server.enqueue(sse(messageStart(100, 20), thinkingBlock(0), textBlock(1, "안녕", "! 반가워"), messageEnd("end_turn", 15)));
		List<String> deltas = new ArrayList<>();

		LlmClient.Result result = newClient(30).stream(List.of(new ChatMessage("user", "[개설자 철수] 안녕")), deltas::add);

		assertThat(deltas).containsExactly("안녕", "! 반가워");
		assertThat(result.content()).isEqualTo("안녕! 반가워");
		assertThat(result.promptTokens()).isEqualTo(120);   // input + cache read
		assertThat(result.completionTokens()).isEqualTo(15);
		assertThat(result.model()).isEqualTo("claude-haiku-5-5");
	}

	@Test
	void requestCarriesModelEffortSystemAndMergedTurns() throws Exception {
		server.enqueue(sse(messageStart(10, 0), textBlock(0, "ok"), messageEnd("end_turn", 1)));

		newClient(30).stream(List.of(
			new ChatMessage("system", "너는 친구다."),
			new ChatMessage("assistant", "창 앞쪽에서 잘린 AI 답"),
			new ChatMessage("user", "[개설자 철수] 안녕"),
			new ChatMessage("assistant", "안녕!"),
			new ChatMessage("user", "[참여자 영희] 나도 왔어"),
			new ChatMessage("user", "[개설자 철수] 뭐해?")
		), d -> {});

		RecordedRequest req = server.takeRequest(5, TimeUnit.SECONDS);
		assertThat(req).isNotNull();
		assertThat(req.getPath()).isEqualTo("/v1/messages");
		assertThat(req.getHeader("x-api-key")).isEqualTo("test-key");
		JsonNode body = json.readTree(req.getBody().readUtf8());
		assertThat(body.path("model").asString()).isEqualTo("claude-haiku-5-5");
		assertThat(body.path("stream").asBoolean()).isTrue();
		assertThat(body.path("max_tokens").asInt()).isEqualTo(16000);
		assertThat(body.path("output_config").path("effort").asString()).isEqualTo("low");
		assertThat(body.path("system").asString()).isEqualTo("너는 친구다.");
		JsonNode msgs = body.path("messages");
		assertThat(msgs.size()).isEqualTo(3);
		assertThat(msgs.get(0).path("role").asString()).isEqualTo("user");
		assertThat(msgs.get(0).path("content").asString()).isEqualTo("[개설자 철수] 안녕");
		assertThat(msgs.get(1).path("role").asString()).isEqualTo("assistant");
		assertThat(msgs.get(2).path("role").asString()).isEqualTo("user");
		assertThat(msgs.get(2).path("content").asString()).isEqualTo("[참여자 영희] 나도 왔어\n\n[개설자 철수] 뭐해?");
	}

	@Test
	void refusalIsAnError() {
		server.enqueue(sse(messageStart(10, 0), textBlock(0, "그건"), messageEnd("refusal", 2)));

		assertThatThrownBy(() -> newClient(30).stream(List.of(new ChatMessage("user", "hi")), d -> {}))
			.isInstanceOf(LlmException.class)
			.hasMessageContaining("refusal");
	}

	@Test
	void httpErrorBecomesLlmException() {
		server.enqueue(new MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
			.setBody("{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"bad\"}}"));

		assertThatThrownBy(() -> newClient(30).stream(List.of(new ChatMessage("user", "hi")), d -> {}))
			.isInstanceOf(LlmException.class)
			.hasMessageContaining("400");
	}

	@Test
	void timeoutBecomesLlmException() {
		server.enqueue(sse(messageStart(10, 0), textBlock(0, "늦"), messageEnd("end_turn", 1)).setHeadersDelay(3, TimeUnit.SECONDS));

		assertThatThrownBy(() -> newClient(1).stream(List.of(new ChatMessage("user", "hi")), d -> {}))
			.isInstanceOf(LlmException.class);
	}
}
