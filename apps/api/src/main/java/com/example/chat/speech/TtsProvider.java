package com.example.chat.speech;

/** 텍스트→음성 공급자 추상화 (D-007). 반환은 audio/mpeg 바이트. 실패는 {@link SpeechException}. */
public interface TtsProvider {

	byte[] synthesize(String text, String voice);

	String name();
}
