package com.example.chat.auth.oauth2;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 로그인 후 복귀 경로(`?next=`) 정제 (API.md#auth, D-021, T-022).
 *
 * 앱 내부 상대경로만 통과시킨다 — open redirect 방지. 콜백은 `APP_BASE_URL + next` 로 302 하므로
 * 절대 URL·프로토콜 상대(`//`)·역슬래시·공백·개행·비ASCII 는 전부 거부하고 호출자가 "/" 로 대체한다.
 */
public final class NextPath {

	/** 시작 요청 쿼리 파라미터 이름이자 authorization request attribute 키. */
	public static final String PARAM = "next";
	public static final String ATTRIBUTE = "next";
	static final int MAX_LENGTH = 200;

	/** `/` 로 시작, 두 번째 글자는 `/` 가 아님, 경로·쿼리에 쓰는 ASCII 만. */
	private static final Pattern SAFE = Pattern.compile("/(?!/)[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*");

	private NextPath() {
	}

	public static Optional<String> sanitize(String raw) {
		if (raw == null || raw.length() > MAX_LENGTH || !SAFE.matcher(raw).matches()) {
			return Optional.empty();
		}
		return Optional.of(raw);
	}
}
