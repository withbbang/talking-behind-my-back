package com.example.chat.chatroom;

import jakarta.validation.constraints.Size;

/**
 * PATCH /rooms/{id} body (API.md#rooms, T-017). 세 필드 모두 선택 — null 은 "변경 없음". 전부 null 이면 400.
 * title 공백 검사·권한·mode 규칙은 ChatRoomService.update 가 본다(한 요청은 전부-아니면-전무).
 */
public record RoomUpdate(@Size(max = 100) String title, RoomMode mode, AiPersonality aiPersonality) {

	public boolean isEmpty() {
		return title == null && mode == null && aiPersonality == null;
	}

	/** title 또는 aiPersonality 를 건드리면 개설자 권한 필요 */
	public boolean needsOwner() {
		return title != null || aiPersonality != null;
	}
}
