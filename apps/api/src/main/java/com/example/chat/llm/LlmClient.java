package com.example.chat.llm;

import java.util.List;
import java.util.function.Consumer;

/** LLM 게이트웨이 추상화. 운영 구현은 {@link OmniRouteClient}, 테스트는 fake (README "외부 API 는 인터페이스 뒤에"). */
public interface LlmClient {

	record ChatMessage(String role, String content) {}

	record Result(String content, Integer promptTokens, Integer completionTokens, String model) {}

	/** 블로킹. 델타는 도착 순서대로 onDelta, 완료 시 전체 본문·usage. 실패는 {@link LlmException}. */
	Result stream(List<ChatMessage> messages, Consumer<String> onDelta);
}
