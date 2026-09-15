package com.example.chat.message;

import com.example.chat.llm.LlmClient;
import com.example.chat.llm.LlmException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * T-007 서비스/컨트롤러 테스트용: AI 잡을 호출 스레드에서 동기로 돌리고(테스트 트랜잭션 안에서 롤백 가능),
 * OmniRoute 는 스크립트형 fake 로 바꾼다. `@Import(SyncAiTestConfig.class)` 로 쓴다.
 */
@TestConfiguration
public class SyncAiTestConfig {

	/** 응답을 미리 넣어두는 fake. 호출 시 넘어온 컨텍스트를 기록한다. */
	public static class FakeLlm implements LlmClient {

		public final List<List<ChatMessage>> calls = new ArrayList<>();
		private final Deque<Object> scripted = new ArrayDeque<>();

		public FakeLlm reply(String... deltas) {
			scripted.add(List.of(deltas));
			return this;
		}

		public FakeLlm replyWithUsage(int promptTokens, int completionTokens, String... deltas) {
			scripted.add(new Object[]{List.of(deltas), promptTokens, completionTokens});
			return this;
		}

		public FakeLlm fail(String message) {
			scripted.add(new LlmException(message, null));
			return this;
		}

		public void reset() {
			calls.clear();
			scripted.clear();
		}

		@Override
		@SuppressWarnings("unchecked")
		public Result stream(List<ChatMessage> messages, Consumer<String> onDelta) {
			calls.add(List.copyOf(messages));
			Object next = scripted.poll();
			if (next == null) throw new IllegalStateException("FakeLlm: no scripted reply");
			if (next instanceof LlmException e) throw e;
			List<String> deltas;
			Integer p = null;
			Integer c = null;
			if (next instanceof Object[] arr) {
				deltas = (List<String>) arr[0];
				p = (Integer) arr[1];
				c = (Integer) arr[2];
			} else {
				deltas = (List<String>) next;
			}
			StringBuilder sb = new StringBuilder();
			for (String d : deltas) {
				sb.append(d);
				onDelta.accept(d);
			}
			return new Result(sb.toString(), p, c, "fake-model");
		}
	}

	@Bean
	@Primary
	public FakeLlm fakeLlm() {
		return new FakeLlm();
	}

	@Bean
	@Primary
	public RoomAiExecutor syncRoomAiExecutor() {
		return new RoomAiExecutor(Runnable::run);
	}
}
