package com.example.chat.llm;

/** OmniRoute 호출 실패(연결/타임아웃/비 2xx/스트림 중단). 잡은 이것을 `error` 이벤트(LLM_UPSTREAM_ERROR)로 바꾼다 (D-018). */
public class LlmException extends RuntimeException {

	public LlmException(String message, Throwable cause) {
		super(message, cause);
	}
}
