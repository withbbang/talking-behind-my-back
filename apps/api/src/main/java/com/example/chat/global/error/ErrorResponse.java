package com.example.chat.global.error;

/** API.md#에러-형식: { code, message, details } */
public record ErrorResponse(String code, String message, Object details) {

	public static ErrorResponse of(ErrorCode code) {
		return new ErrorResponse(code.name(), code.getDefaultMessage(), null);
	}

	public static ErrorResponse of(ErrorCode code, String message, Object details) {
		return new ErrorResponse(code.name(), message, details);
	}

	/** 필터 단계(Spring Security 진입점 등)에서 ObjectMapper 없이 쓰기 위한 최소 직렬화 */
	public String toJson() {
		return "{\"code\":\"" + code + "\",\"message\":\"" + escape(message) + "\",\"details\":null}";
	}

	private static String escape(String s) {
		return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
