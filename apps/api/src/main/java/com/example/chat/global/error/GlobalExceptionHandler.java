package com.example.chat.global.error;

import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 모든 예외를 API.md#에러-형식 으로 변환. 본문/토큰/오디오는 로그에 남기지 않는다 (CONVENTIONS.md#공통).
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
		ErrorCode code = e.getErrorCode();
		if (code.getStatus().is5xxServerError()) {
			log.warn("business 5xx: {} - {}", code, e.getMessage());
		}
		return ResponseEntity.status(code.getStatus())
			.body(ErrorResponse.of(code, e.getMessage(), e.getDetails()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
		Map<String, String> fields = new LinkedHashMap<>();
		for (FieldError fe : e.getBindingResult().getFieldErrors()) {
			fields.putIfAbsent(fe.getField(), fe.getDefaultMessage());
		}
		ErrorCode code = ErrorCode.VALIDATION_FAILED;
		return ResponseEntity.status(code.getStatus())
			.body(ErrorResponse.of(code, code.getDefaultMessage(), fields));
	}

	/** JSON 파싱 실패·enum 에 없는 값(예: mode=FOO) — 본문은 로그에 남기지 않는다 (T-017). */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
		ErrorCode code = ErrorCode.VALIDATION_FAILED;
		return ResponseEntity.status(code.getStatus())
			.body(ErrorResponse.of(code, "요청 본문을 읽을 수 없습니다.", null));
	}

	/** 쿼리/폼 파라미터 타입 불일치(`durationMs=abc`, `size=x`) — 값은 로그·응답에 남기지 않는다 (T-009 리뷰). */
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
		ErrorCode code = ErrorCode.VALIDATION_FAILED;
		return ResponseEntity.status(code.getStatus())
			.body(ErrorResponse.of(code, code.getDefaultMessage(), Map.of(e.getName(), "값의 형식이 올바르지 않습니다.")));
	}

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	public ResponseEntity<ErrorResponse> handleUploadSize(MaxUploadSizeExceededException e) {
		ErrorCode code = ErrorCode.PAYLOAD_TOO_LARGE;
		return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code));
	}

	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
		ErrorCode code = ErrorCode.FORBIDDEN;
		return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code));
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
		return ResponseEntity.status(404)
			.body(new ErrorResponse("NOT_FOUND", "존재하지 않는 경로입니다.", null));
	}

	/**
	 * async 요청 타임아웃. 실제로는 api 종료 시 Tomcat 이 열린 SSE(SseEmitter 무제한)를 강제 timeout 할 때 온다 — 응답은 이미 커밋돼
	 * 본문은 안 나가고, catch-all 로 가면 연결마다 ERROR 스택이 찍힌다(T-028). 일반 async 요청이면 Spring 기본과 같은 503.
	 */
	@ExceptionHandler(AsyncRequestTimeoutException.class)
	public ResponseEntity<ErrorResponse> handleAsyncTimeout(AsyncRequestTimeoutException e) {
		log.debug("async request timed out: {}", e.getMessage());
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
			.body(new ErrorResponse("SERVICE_UNAVAILABLE", "요청 처리 시간이 초과되었습니다.", null));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleUnknown(Exception e) {
		log.error("unhandled exception", e);
		ErrorCode code = ErrorCode.INTERNAL_ERROR;
		return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code));
	}
}
