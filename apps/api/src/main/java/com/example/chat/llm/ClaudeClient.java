package com.example.chat.llm;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.helpers.MessageAccumulator;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.Usage;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Claude Messages API 스트림 소비 (D-040, T-036). `app.llm.provider=claude` 일 때만 빈으로 뜬다.
 * 호출 스레드를 블록한다 — RoomAiExecutor 의 워커에서만 부른다. 텍스트 델타만 콜백으로 흘리고(thinking 은 비노출),
 * 전체 본문·usage·모델은 Result 로. `refusal` 은 오류로 취급해 부분 응답을 버린다(D-018).
 */
@Component
@ConditionalOnProperty(name = "app.llm.provider", havingValue = "claude", matchIfMissing = true)
public class ClaudeClient implements LlmClient {

	private final AnthropicClient client;
	private final ClaudeProperties props;

	public ClaudeClient(ClaudeProperties props, LlmProperties llmProps) {
		this.props = props;
		AnthropicOkHttpClient.Builder b = AnthropicOkHttpClient.builder()
			.timeout(llmProps.timeout())
			.maxRetries(props.maxRetries());
		if (props.hasApiKey()) b.apiKey(props.apiKey());
		if (props.hasBaseUrl()) b.baseUrl(props.baseUrl());
		this.client = b.build();
	}

	@Override
	public Result stream(List<ChatMessage> messages, Consumer<String> onDelta) {
		MessageCreateParams params = toParams(messages);
		MessageAccumulator acc = MessageAccumulator.create();
		StringBuilder content = new StringBuilder();
		try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
			stream.stream().forEach(event -> {
				acc.accumulate(event);
				event.contentBlockDelta()
					.flatMap(d -> d.delta().text())
					.ifPresent(t -> {
						content.append(t.text());
						onDelta.accept(t.text());
					});
			});
		} catch (AnthropicServiceException e) {
			throw new LlmException("Claude responded " + e.statusCode(), e);
		} catch (AnthropicException e) {
			throw new LlmException("Claude call failed: " + e.getClass().getSimpleName(), e);
		}
		Message message = acc.message();
		if (message.stopReason().filter(StopReason.REFUSAL::equals).isPresent()) {
			throw new LlmException("Claude stopped with refusal", null);
		}
		Usage usage = message.usage();
		long prompt = usage.inputTokens()
			+ usage.cacheCreationInputTokens().orElse(0L)
			+ usage.cacheReadInputTokens().orElse(0L);
		return new Result(content.toString(), (int) prompt, (int) usage.outputTokens(), message.model().asString());
	}

	/**
	 * AiContextBuilder 결과(OpenAI 형식) → Messages API. system 은 파라미터로, 연속 같은 역할은 한 턴으로 합치고
	 * (2인 방 USER 연속), 맨 앞 assistant 턴은 버린다(user 로 시작해야 한다).
	 */
	private MessageCreateParams toParams(List<ChatMessage> messages) {
		List<String> system = new ArrayList<>();
		List<String> roles = new ArrayList<>();
		List<StringBuilder> turns = new ArrayList<>();
		for (ChatMessage m : messages) {
			if ("system".equals(m.role())) {
				system.add(m.content());
				continue;
			}
			if (turns.isEmpty() && "assistant".equals(m.role())) continue;
			int last = roles.size() - 1;
			if (last >= 0 && roles.get(last).equals(m.role())) {
				turns.get(last).append("\n\n").append(m.content());
			} else {
				roles.add(m.role());
				turns.add(new StringBuilder(m.content()));
			}
		}
		MessageCreateParams.Builder b = MessageCreateParams.builder()
			.model(props.model())
			.maxTokens(props.maxTokens());
		if (!system.isEmpty()) b.system(String.join("\n\n", system));
		if (props.hasEffort()) b.outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.of(props.effort())).build());
		for (int i = 0; i < turns.size(); i++) {
			if ("assistant".equals(roles.get(i))) b.addAssistantMessage(turns.get(i).toString());
			else b.addUserMessage(turns.get(i).toString());
		}
		return b.build();
	}
}
