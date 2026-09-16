package com.example.chat.message;

import com.example.chat.chatroom.RoomMode;
import java.time.Instant;
import java.time.ZoneId;

/** Message JSON (API.md#messages). inputType·senderUserId·senderNickname·mode 는 USER 만, ASSISTANT 는 null. 시간은 UTC Instant. */
public record MessageResponse(
	Long id,
	Message.Role role,
	Long senderUserId,
	String senderNickname,
	String content,
	Message.InputType inputType,
	RoomMode mode,
	Instant createdAt
) {
	static MessageResponse of(Message m, ZoneId zone) {
		return new MessageResponse(m.getId(), m.getRole(), m.getSenderUserId(), m.getSenderNickname(), m.getContent(), m.getInputType(), m.getMode(),
			m.getCreatedAt().atZone(zone).toInstant());
	}
}
