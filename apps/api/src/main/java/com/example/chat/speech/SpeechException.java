package com.example.chat.speech;

/** 공급자 호출 실패(연결/타임아웃/비 2xx/응답 파싱). SpeechService 가 502 SPEECH_UPSTREAM_ERROR 로 바꾼다. */
public class SpeechException extends RuntimeException {

	public SpeechException(String message, Throwable cause) {
		super(message, cause);
	}

	/** 로그용 근본 원인 클래스명 — Reactor 가 TimeoutException 등을 감싸므로 끝까지 내려간다. 메시지 본문은 쓰지 않는다. */
	public static String rootName(Throwable e) {
		Throwable t = e;
		while (t.getCause() != null && t.getCause() != t) t = t.getCause();
		return t.getClass().getSimpleName();
	}
}
