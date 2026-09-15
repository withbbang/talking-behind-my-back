package com.example.chat.chatroom;

/** POST /rooms/{id}/invite/regenerate 응답 (API.md#rooms, T-016). */
public record InviteResponse(String inviteCode, String inviteUrl) {

	static InviteResponse of(String code, String baseUrl) {
		return new InviteResponse(code, baseUrl + "/join/" + code);
	}
}
