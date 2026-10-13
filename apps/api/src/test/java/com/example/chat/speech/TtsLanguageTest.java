package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** T-038 답변 텍스트의 문자 종류로 TTS 언어 판정 (D-042 (2)). */
class TtsLanguageTest {

	@Test
	void 한글이_많으면_ko() {
		assertThat(TtsLanguage.detect("오늘 기분 어때? 나는 좋아!")).isEqualTo("ko");
	}

	@Test
	void 한글_문장에_영어_단어가_섞여도_ko() {
		assertThat(TtsLanguage.detect("오늘 meeting 은 어땠어? 진짜 궁금하다")).isEqualTo("ko");
	}

	@Test
	void 라틴_문자면_en() {
		assertThat(TtsLanguage.detect("Hey! How was your day? I'm doing great.")).isEqualTo("en");
	}

	@Test
	void 가나가_있으면_한자가_섞여도_ja() {
		assertThat(TtsLanguage.detect("今日はいい天気ですね。散歩に行きましょう")).isEqualTo("ja");
	}

	@Test
	void 가나_없는_한자는_zh() {
		assertThat(TtsLanguage.detect("今天天气很好，我们去散步吧")).isEqualTo("zh");
	}

	@Test
	void 문자가_없으면_판정하지_않는다() {
		assertThat(TtsLanguage.detect("123 !!! 😀")).isNull();
		assertThat(TtsLanguage.detect("")).isNull();
		assertThat(TtsLanguage.detect(null)).isNull();
	}

	@Test
	void 동률이면_ko() {
		assertThat(TtsLanguage.detect("ab 가나")).isEqualTo("ko");
	}
}
