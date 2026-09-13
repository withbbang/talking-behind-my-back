package com.example.chat.global.error;

import lombok.Getter;

/**
 * 비즈니스 예외는 이것 하나로 통일 (CONVENTIONS.md#백엔드). 상태 코드·메시지는 ErrorCode 가 결정.
 */
@Getter
public class BusinessException extends RuntimeException {

	private final ErrorCode errorCode;
	private final transient Object details;

	public BusinessException(ErrorCode errorCode) {
		this(errorCode, errorCode.getDefaultMessage(), null);
	}

	public BusinessException(ErrorCode errorCode, String message) {
		this(errorCode, message, null);
	}

	public BusinessException(ErrorCode errorCode, String message, Object details) {
		super(message);
		this.errorCode = errorCode;
		this.details = details;
	}
}
