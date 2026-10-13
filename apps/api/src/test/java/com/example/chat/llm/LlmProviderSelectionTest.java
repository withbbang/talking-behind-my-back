package com.example.chat.llm;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.reactive.function.client.WebClient;

/** T-036 `app.llm.provider` 로 LlmClient 구현체가 하나만 뜬다 (D-040 (3)). */
class LlmProviderSelectionTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
		.withBean(LlmProperties.class, () -> new LlmProperties("http://localhost:1", "", "m", 30, 30, ""))
		.withBean(ClaudeProperties.class, () -> new ClaudeProperties("k", "http://localhost:1", "claude-haiku-5-5", "low", 16000, 0))
		.withBean("llmWebClient", WebClient.class, WebClient::create)
		.withUserConfiguration(OpenAiCompatLlmClient.class, ClaudeClient.class);

	@Test
	void defaultsToClaude() {
		runner.run(ctx -> assertThat(ctx).getBean(LlmClient.class).isInstanceOf(ClaudeClient.class));
	}

	@Test
	void claudeWhenSelected() {
		runner.withPropertyValues("app.llm.provider=claude")
			.run(ctx -> assertThat(ctx).getBean(LlmClient.class).isInstanceOf(ClaudeClient.class));
	}

	@Test
	void geminiWhenSelected() {
		runner.withPropertyValues("app.llm.provider=gemini")
			.run(ctx -> assertThat(ctx).getBean(LlmClient.class).isInstanceOf(OpenAiCompatLlmClient.class));
	}
}
