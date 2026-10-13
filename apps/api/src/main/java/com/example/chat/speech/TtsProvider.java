package com.example.chat.speech;

/** 텍스트→음성 공급자 추상화 (D-007). 반환은 audio/mpeg 바이트. 실패는 {@link SpeechException}. */
public interface TtsProvider {

	byte[] synthesize(String text, String voice);

	/** 모델을 요청마다 고른다(1차/폴백, D-043). 모델 개념이 없는 공급자는 무시. */
	default byte[] synthesize(String text, String voice, String model) {
		return synthesize(text, voice);
	}

	String name();
}
