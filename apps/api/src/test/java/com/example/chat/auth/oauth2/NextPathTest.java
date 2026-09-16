package com.example.chat.auth.oauth2;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** T-022 (D-021): 로그인 후 복귀 경로 정제 — 상대경로만 통과, 나머지는 empty(호출자가 "/" 로 대체). */
class NextPathTest {

	@Test
	void 상대경로는_그대로_통과() {
		assertThat(NextPath.sanitize("/join/K7Q2M9XW")).contains("/join/K7Q2M9XW");
		assertThat(NextPath.sanitize("/rooms/12?tab=info&x=1")).contains("/rooms/12?tab=info&x=1");
		assertThat(NextPath.sanitize("/")).contains("/");
	}

	@ParameterizedTest
	@ValueSource(strings = {
		"http://evil.example/x", "https://evil.example", "//evil.example/x", "/\\evil.example",
		"join/K7Q2M9XW", "", "  ", "/join/\nK7", "/join/K7\r", "/join/한글", "/join/K7 Q2", "/a<b>", "javascript:alert(1)"
	})
	void 절대URL_프로토콜상대_역슬래시_개행_비ASCII_공백은_거부(String raw) {
		assertThat(NextPath.sanitize(raw)).isEmpty();
	}

	@Test
	void null_과_200자_초과는_거부() {
		assertThat(NextPath.sanitize(null)).isEmpty();
		assertThat(NextPath.sanitize("/" + "a".repeat(199))).isPresent();
		assertThat(NextPath.sanitize("/" + "a".repeat(200))).isEmpty();
	}
}
