package com.example.chat.chatroom;

import jakarta.validation.constraints.Size;

/**
 * PATCH /rooms/{id} body (API.md#rooms, T-017/T-019). 네 필드 모두 선택 — null 은 "변경 없음". 전부 null 이면 400.
 * aiPrompt 는 trim 후 빈 문자열이면 "초기화"(프리셋으로 복귀) — 길이 상한만 여기(@Size), 나머지 규칙은 ChatRoomService.update.
 * title 공백 검사·권한·mode 규칙도 서비스가 본다(한 요청은 전부-아니면-전무).
 */
public record RoomUpdate(
	@Size(max = 100) String title,
	RoomMode mode,
	AiPersonality aiPersonality,
	@Size(max = 2000) String aiPrompt
) {

	public boolean isEmpty() {
		return title == null && mode == null && aiPersonality == null && aiPrompt == null;
	}

	/** title / aiPersonality / aiPrompt 를 건드리면 개설자 권한 필요 */
	public boolean needsOwner() {
		return title != null || aiPersonality != null || aiPrompt != null;
	}

	/** trim 한 커스텀 프롬프트. 비면 null(= 초기화). aiPrompt 자체가 null 이면 호출하지 않는다. */
	public String normalizedAiPrompt() {
		String t = aiPrompt == null ? "" : aiPrompt.trim();
		return t.isEmpty() ? null : t;
	}
}
