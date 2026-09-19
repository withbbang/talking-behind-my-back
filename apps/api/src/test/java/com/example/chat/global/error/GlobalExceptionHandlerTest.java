package com.example.chat.global.error;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * GlobalExceptionHandler 매핑 단위 테스트 — API.md#에러-형식 { code, message, details } (T-002 acceptance).
 * Homepage 와 같은 방식(핸들러 직접 호출). MockMvc 슬라이스는 Boot 4 에서 테스트 내부 컨트롤러 스캔이 달라
 * 여기선 쓰지 않는다. HTTP 레벨 통합은 T-004 이후 실제 컨트롤러 테스트가 덮는다.
 */
class GlobalExceptionHandlerTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	/** 로그 레벨 단언용 — "ERROR 스택으로 찍히지 않는다" 는 응답만 봐서는 검증되지 않는다 (T-033). */
	private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
	private final Logger handlerLogger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
	private Level 원래레벨;

	@BeforeEach
	void 로그_수집_시작() {
		원래레벨 = handlerLogger.getLevel();
		handlerLogger.setLevel(Level.DEBUG);
		logs.start();
		handlerLogger.addAppender(logs);
	}

	@AfterEach
	void 로그_수집_종료() {
		handlerLogger.detachAppender(logs);
		logs.stop();
		handlerLogger.setLevel(원래레벨);
	}

	private List<Level> 로그레벨() {
		return logs.list.stream().map(ILoggingEvent::getLevel).toList();
	}

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
	@DisplayName("쿼리/폼 파라미터 타입 불일치(durationMs=abc, size=x)는 400 VALIDATION_FAILED + details.<param>, 값은 노출하지 않는다")
	void 파라미터_타입_불일치() {
		ResponseEntity<ErrorResponse> res = handler.handleTypeMismatch(
			new MethodArgumentTypeMismatchException("abc", Long.class, "durationMs", null, new NumberFormatException("For input string: \"abc\"")));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("VALIDATION_FAILED");
		assertThat(res.getBody().details()).isEqualTo(Map.of("durationMs", "값의 형식이 올바르지 않습니다."));
		assertThat(res.getBody().toString()).doesNotContain("abc");
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
		// 끊김 안전망(T-033)이 진짜 실패를 삼키지 않는다
		assertThat(로그레벨()).containsExactly(Level.ERROR);
	}

	@Test
	@DisplayName("ErrorResponse.toJson 은 따옴표/역슬래시를 이스케이프한다 (Security 진입점용)")
	void toJson_이스케이프() {
		String json = ErrorResponse.of(ErrorCode.UNAUTHENTICATED, "say \"hi\" \\ bye", null).toJson();

		assertThat(json).isEqualTo("{\"code\":\"UNAUTHENTICATED\",\"message\":\"say \\\"hi\\\" \\\\ bye\",\"details\":null}");
	}

	@Test
	@DisplayName("AsyncRequestTimeoutException(셧다운 시 SSE 강제 타임아웃) 은 503 SERVICE_UNAVAILABLE — catch-all ERROR 가 아니다 (T-028)")
	void asyncTimeout_503() {
		ResponseEntity<ErrorResponse> res = handler.handleAsyncTimeout(new AsyncRequestTimeoutException());

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("SERVICE_UNAVAILABLE");
		assertThat(res.getBody().details()).isNull();
	}

	@Test
	@DisplayName("AsyncRequestNotUsableException(SSE 클라이언트 끊김) 은 503 SERVICE_UNAVAILABLE + debug 한 줄 — ERROR 스택이 아니다 (T-033)")
	void asyncNotUsable_503_debug() {
		ResponseEntity<ErrorResponse> res = handler.handleAsyncNotUsable(new AsyncRequestNotUsableException(
			"Servlet container error notification for disconnected client", new IOException("Broken pipe")));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("SERVICE_UNAVAILABLE");
		assertThat(res.getBody().details()).isNull();
		assertThat(로그레벨()).containsExactly(Level.DEBUG);
	}

	@Test
	@DisplayName("catch-all 로 온 다른 모양의 끊김(톰캣 ClientAbortException)도 ERROR 스택 없이 503 — 안전망 (T-033)")
	void catchAll_클라이언트_끊김_debug() {
		ResponseEntity<ErrorResponse> res = handler.handleUnknown(new ClientAbortException(new IOException("Broken pipe")));

		assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
		assertThat(res.getBody()).isNotNull();
		assertThat(res.getBody().code()).isEqualTo("SERVICE_UNAVAILABLE");
		assertThat(로그레벨()).containsExactly(Level.DEBUG);
	}

	/** MethodParameter 생성용 더미 시그니처 */
	@SuppressWarnings("unused")
	static void sample(String content) {
	}
}
