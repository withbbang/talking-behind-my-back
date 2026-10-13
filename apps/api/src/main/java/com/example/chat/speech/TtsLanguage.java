package com.example.chat.speech;

/**
 * 답변 텍스트의 문자 종류로 TTS 언어를 판정한다 (D-042 (2)). 가장 많은 문자군 기준, 동률이면 ko.
 * 가나가 하나라도 있으면 한자는 일본어 쪽으로 센다. 라틴 계열(fr/es 등)은 구분하지 않고 en.
 */
final class TtsLanguage {

	private TtsLanguage() {
	}

	/** @return ko / ja / zh / en, 글자가 없으면 null */
	static String detect(String text) {
		if (text == null) return null;
		int hangul = 0;
		int kana = 0;
		int han = 0;
		int latin = 0;
		for (int i = 0; i < text.length(); ) {
			int cp = text.codePointAt(i);
			i += Character.charCount(cp);
			Character.UnicodeScript script = Character.UnicodeScript.of(cp);
			switch (script) {
				case HANGUL -> hangul++;
				case HIRAGANA, KATAKANA -> kana++;
				case HAN -> han++;
				case LATIN -> latin++;
				default -> { }
			}
		}
		int ja = kana > 0 ? kana + han : 0;
		int zh = kana > 0 ? 0 : han;
		int max = Math.max(Math.max(hangul, ja), Math.max(zh, latin));
		if (max == 0) return null;
		if (hangul == max) return "ko";
		if (ja == max) return "ja";
		if (zh == max) return "zh";
		return "en";
	}
}
