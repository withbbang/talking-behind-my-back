package com.example.chat.global.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * GlobalExceptionHandler 매핑 단위 테스트 — API.md#에러-형식 { code, message, details } (T-002 acceptance).
 * Homepage 와 같은 방식(핸들러 직접 호출). MockMvc 슬라이스는 Boot 4 에서 테스트 내부 컨트롤러 스캔이 달라
 * 여기선 쓰지 않는다. HTTP 레벨 통합은 T-004 이후 실제 컨트롤러 테스트가 덮는다.
 */
class GlobalExceptionHandlerTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	@DisplayName("BusinessException 은 ErrorCode 의 상태/코드/기본 메시지로 응답한다")
	void businessException_기본() {
		ResponseEntity<ErrorResponse> res = handler.handleBusiness(new BusinessException(ErrorCode.ROOM_BUSY));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("ROOM_BUSY");
		assertThat(res.getBody().message()).isEqualTo("답변이 끝난 뒤 보내주세요.");
		assertThat(res.getBody().details()).isNull();
	}

	@Test
	@DisplayName("BusinessException 의 커스텀 메시지와 details 를 그대로 전달한다")
	void businessException_커스텀() {
		ResponseEntity<ErrorResponse> res = handler.handleBusiness(
			new BusinessException(ErrorCode.ROOM_NOT_FOUND, "room 99", Map.of("roomId", 99)));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("ROOM_NOT_FOUND");
		assertThat(res.getBody().message()).isEqualTo("room 99");
		assertThat(res.getBody().details()).isEqualTo(Map.of("roomId", 99));
	}

	@Test
	@DisplayName("본문 파싱 실패(잘못된 JSON·enum 에 없는 값)는 400 VALIDATION_FAILED, 본문 내용은 노출하지 않는다")
	void 본문_파싱_실패() {
		ResponseEntity<ErrorResponse> res = handler.handleUnreadable(
			new HttpMessageNotReadableException("Cannot deserialize value of type RoomMode from \"FOO\"", new MockHttpInputMessage(new byte[0])));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("VALIDATION_FAILED");
		assertThat(res.getBody().message()).doesNotContain("FOO");
		assertThat(res.getBody().details()).isNull();
	}

	@Test
	@DisplayName("검증 실패는 400 VALIDATION_FAILED + 필드별 details")
	void validation_실패() throws NoSuchMethodException {
		BeanPropertyBindingResult binding = new BeanPropertyBindingResult(new Object(), "body");
		binding.addError(new FieldError("body", "content", "", false, null, null, "must not be blank"));
		binding.addError(new FieldError("body", "content", "", false, null, null, "size must be <= 4000"));
		MethodParameter param = new MethodParameter(getClass().getDeclaredMethod("sample", String.class), 0);

		ResponseEntity<ErrorResponse> res = handler.handleValidation(new MethodArgumentNotValidException(param, binding));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("VALIDATION_FAILED");
		// 같은 필드에 여러 오류면 첫 메시지만 (putIfAbsent)
		assertThat(res.getBody().details()).isEqualTo(Map.of("content", "must not be blank"));
	}

	@Test
	@DisplayName("업로드 크기 초과는 413 PAYLOAD_TOO_LARGE")
	void 업로드_초과_413() {
		ResponseEntity<ErrorResponse> res = handler.handleUploadSize(new MaxUploadSizeExceededException(25L * 1024 * 1024));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("PAYLOAD_TOO_LARGE");
	}

	@Test
	@DisplayName("예상 못한 예외는 500 INTERNAL_ERROR, 원문 메시지는 노출하지 않는다")
	void 예상못한_예외_500() {
		ResponseEntity<ErrorResponse> res = handler.handleUnknown(new IllegalStateException("DB 커넥션 끊김 details"));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("INTERNAL_ERROR");
		assertThat(res.getBody().message()).doesNotContain("DB 커넥션");
	}

	@Test
	@DisplayName("ErrorResponse.toJson 은 따옴표/역슬래시를 이스케이프한다 (Security 진입점용)")
	void toJson_이스케이프() {
		String json = ErrorResponse.of(ErrorCode.UNAUTHENTICATED, "say \"hi\" \\ bye", null).toJson();

		assertThat(json).isEqualTo("{\"code\":\"UNAUTHENTICATED\",\"message\":\"say \\\"hi\\\" \\\\ bye\",\"details\":null}");
	}

	/** MethodParameter 생성용 더미 시그니처 */
	@SuppressWarnings("unused")
	static void sample(String content) {
	}
}
