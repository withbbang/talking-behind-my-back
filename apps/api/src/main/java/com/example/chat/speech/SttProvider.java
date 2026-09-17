package com.example.chat.speech;

import java.nio.file.Path;

/** 음성→텍스트 공급자 추상화 (D-007). 운영 구현은 omniroute/*(D-027), clova/* 는 스텁, 테스트는 fake. 실패는 {@link SpeechException}. */
public interface SttProvider {

	/** durationMs 는 공급자가 보고한 오디오 길이(모르면 0). */
	record Transcript(String text, long durationMs) {}

	Transcript transcribe(Path audio, String contentType);

	/** 응답 `provider` 필드 값 (API.md#speech). */
	String name();
}
