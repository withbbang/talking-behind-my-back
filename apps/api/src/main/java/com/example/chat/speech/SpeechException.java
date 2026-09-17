package com.example.chat.speech;

/** 공급자 호출 실패(연결/타임아웃/비 2xx/응답 파싱). SpeechService 가 502 SPEECH_UPSTREAM_ERROR 로 바꾼다. */
public class SpeechException extends RuntimeException {

	public SpeechException(String message, Throwable cause) {
		super(message, cause);
	}
}
