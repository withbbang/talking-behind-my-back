package com.example.chat.global;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Base64;

/**
 * 커서 페이징의 불투명 커서 (API.md#공통). 내용은 base64url(no padding) 로 감싼 "{ISO LocalDateTime 또는 빈 값}|{id}".
 * 방 목록은 (last_message_at, id) 키셋, 메시지는 id 키셋 — at 이 null 이면 id 만 담는다.
 * 프론트는 서버가 준 nextCursor 를 그대로 되돌려주기만 한다. 잘못된 커서는 400 VALIDATION_FAILED.
 */
public final class CursorCodec {

	public static final int DEFAULT_SIZE = 30;
	public static final int MAX_SIZE = 100;

	private static final char SEPARATOR = '|';

	private CursorCodec() {
	}

	public record Cursor(LocalDateTime at, long id) {
	}

	public static String encode(LocalDateTime at, long id) {
		String raw = (at == null ? "" : at.toString()) + SEPARATOR + id;
		return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	public static Cursor decode(String cursor) {
		try {
			String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
			int sep = raw.lastIndexOf(SEPARATOR);
			if (sep < 0) throw new IllegalArgumentException("no separator");
			String atPart = raw.substring(0, sep);
			long id = Long.parseLong(raw.substring(sep + 1));
			LocalDateTime at = atPart.isEmpty() ? null : LocalDateTime.parse(atPart);
			return new Cursor(at, id);
		} catch (IllegalArgumentException | DateTimeParseException e) {
			throw new BusinessException(ErrorCode.VALIDATION_FAILED, "잘못된 커서입니다.");
		}
	}

	/** size 는 기본 30, 1~100 으로 clamp (API.md#공통). */
	public static int clampSize(Integer size) {
		if (size == null) return DEFAULT_SIZE;
		return Math.max(1, Math.min(MAX_SIZE, size));
	}
}
