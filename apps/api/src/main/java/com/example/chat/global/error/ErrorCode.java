package com.example.chat.global.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * API 에러 코드 — API.md#에러-형식 과 1:1. 새 코드는 API.md 에 먼저 추가한다.
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

	// 400
	VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
	AUDIO_TOO_LONG(HttpStatus.BAD_REQUEST, "오디오가 너무 깁니다."),
	TEXT_TOO_LONG(HttpStatus.BAD_REQUEST, "텍스트가 너무 깁니다."),
	MODE_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "혼자인 방에서는 사람 모드로 바꿀 수 없습니다."),
	SELF_INVITE(HttpStatus.BAD_REQUEST, "본인이 만든 방에는 입장할 수 없습니다."),
	// 401
	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
	TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "토큰이 만료되었습니다."),
	TOKEN_REUSED(HttpStatus.UNAUTHORIZED, "재사용된 토큰입니다. 다시 로그인해 주세요."),
	// 403
	FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
	USER_SUSPENDED(HttpStatus.FORBIDDEN, "정지된 계정입니다."),
	// 404
	ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "채팅방을 찾을 수 없습니다."),
	MESSAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "메시지를 찾을 수 없습니다."),
	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
	INVITE_NOT_FOUND(HttpStatus.NOT_FOUND, "초대 코드를 찾을 수 없습니다."),
	// 409
	ROOM_BUSY(HttpStatus.CONFLICT, "답변이 끝난 뒤 보내주세요."),
	ROOM_FULL(HttpStatus.CONFLICT, "채팅방 정원이 찼습니다."),
	ROOM_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "채팅방은 최대 50개까지 만들거나 참여할 수 있습니다."),
	PAIR_ROOM_EXISTS(HttpStatus.CONFLICT, "이 사람과 이미 함께 있는 채팅방이 있습니다."),
	// 410
	ROOM_ORPHANED(HttpStatus.GONE, "개설자가 나간 채팅방입니다."),
	// 413
	PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "업로드 크기 제한을 초과했습니다."),
	// 502
	LLM_UPSTREAM_ERROR(HttpStatus.BAD_GATEWAY, "AI 응답에 실패했습니다."),
	AI_BUSY(HttpStatus.SERVICE_UNAVAILABLE, "AI 가 바쁩니다. 잠시 후 다시 보내주세요."),
	SPEECH_UPSTREAM_ERROR(HttpStatus.BAD_GATEWAY, "음성 처리에 실패했습니다."),
	// 500
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");

	private final HttpStatus status;
	private final String defaultMessage;
}
