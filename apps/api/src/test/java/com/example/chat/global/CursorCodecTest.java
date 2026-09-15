package com.example.chat.global;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** T-006 불투명 커서. 방 목록은 (lastMessageAt, id), 메시지는 id 만 — 프론트는 형식을 해석하지 않는다 (API.md#공통). */
class CursorCodecTest {

	@Test
	void 시각과_id_를_왕복한다() {
		LocalDateTime at = LocalDateTime.of(2026, 9, 15, 10, 30, 45, 123_000_000);
		String cursor = CursorCodec.encode(at, 42L);

		CursorCodec.Cursor decoded = CursorCodec.decode(cursor);
		assertThat(decoded.at()).isEqualTo(at);
		assertThat(decoded.id()).isEqualTo(42L);
	}

	@Test
	void 시각_없이_id_만도_왕복한다() {
		CursorCodec.Cursor decoded = CursorCodec.decode(CursorCodec.encode(null, 7L));
		assertThat(decoded.at()).isNull();
		assertThat(decoded.id()).isEqualTo(7L);
	}

	@Test
	void 커서는_url_safe_이고_패딩이_없다() {
		String cursor = CursorCodec.encode(LocalDateTime.of(2026, 1, 1, 0, 0), 1L);
		assertThat(cursor).matches("[A-Za-z0-9_-]+");
	}

	@Test
	void 변조되거나_형식이_다른_커서는_VALIDATION_FAILED() {
		assertThatThrownBy(() -> CursorCodec.decode("not-base64!!"))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_FAILED);
		// base64url 은 맞지만 내용이 "abc" — 구분자 없음
		assertThatThrownBy(() -> CursorCodec.decode("YWJj"))
			.isInstanceOf(BusinessException.class)
			.extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_FAILED);
		assertThatThrownBy(() -> CursorCodec.decode(""))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void size_는_기본_30_최대_100_으로_clamp() {
		assertThat(CursorCodec.clampSize(null)).isEqualTo(30);
		assertThat(CursorCodec.clampSize(0)).isEqualTo(1);
		assertThat(CursorCodec.clampSize(500)).isEqualTo(100);
		assertThat(CursorCodec.clampSize(10)).isEqualTo(10);
	}
}
