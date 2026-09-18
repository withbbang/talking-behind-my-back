package com.example.chat.llm;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * OmniRoute(OpenAI 호환 /v1) `chat/completions` 스트림 소비 (D-006, T-007).
 * 호출 스레드를 블록한다 — RoomAiExecutor 의 워커에서만 부른다. 델타는 콜백으로 흘리고 전체 본문·usage 는 Result 로.
 * `stream_options.include_usage` 로 마지막 청크에 usage 를 요청하며, 상류가 안 주면 토큰은 null.
 */
@Component
public class OmniRouteClient implements LlmClient {

	private final WebClient webClient;
	private final LlmProperties props;
	private final ObjectMapper json = new ObjectMapper();

	public OmniRouteClient(WebClient omniRouteWebClient, LlmProperties props) {
		this.webClient = omniRouteWebClient;
		this.props = props;
	}

	@Override
	public Result stream(List<ChatMessage> messages, Consumer<String> onDelta) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("model", props.model());
		body.put("messages", messages);
		body.put("stream", true);
		body.put("stream_options", Map.of("include_usage", true));
		// thinking 모델 비활성화(Gemini 2.5 등): 빈 응답 방지. 설정된 경우에만 — 공급자 중립(D-006).
		if (props.hasReasoningEffort()) body.put("reasoning_effort", props.reasoningEffort());
		StringBuilder content = new StringBuilder();
		Integer[] tokens = new Integer[2];
		String[] model = new String[1];
		try {
			webClient.post().uri("/chat/completions")
				.contentType(MediaType.APPLICATION_JSON)
				.accept(MediaType.TEXT_EVENT_STREAM)
				.bodyValue(body)
				.retrieve()
				.bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
				.timeout(props.timeout())
				.doOnNext(event -> {
					String data = event.data();
					if (data == null || data.isBlank() || "[DONE]".equals(data.trim())) return;
					JsonNode node = parse(data);
					if (node == null) return;
					String m = node.path("model").asString(null);
					if (m != null && !m.isBlank()) model[0] = m;
					JsonNode delta = node.path("choices").path(0).path("delta").path("content");
					if (delta.isString() && !delta.asString().isEmpty()) {
						content.append(delta.asString());
						onDelta.accept(delta.asString());
					}
					JsonNode usage = node.path("usage");
					if (usage.isObject()) {
						tokens[0] = usage.path("prompt_tokens").isNumber() ? usage.path("prompt_tokens").asInt() : tokens[0];
						tokens[1] = usage.path("completion_tokens").isNumber() ? usage.path("completion_tokens").asInt() : tokens[1];
					}
				})
				.blockLast();
		} catch (WebClientResponseException e) {
			throw new LlmException("OmniRoute responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			Throwable cause = e.getCause() instanceof TimeoutException ? e.getCause() : e;
			throw new LlmException("OmniRoute call failed: " + cause.getClass().getSimpleName(), e);
		}
		return new Result(content.toString(), tokens[0], tokens[1], model[0] != null ? model[0] : props.model());
	}

	/** 잘못된 JSON 라인은 건너뛴다(상류 keep-alive/주석 등). */
	private JsonNode parse(String data) {
		try {
			return json.readTree(data);
		} catch (RuntimeException e) {
			return null;
		}
	}
}
