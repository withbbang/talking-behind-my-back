package com.example.chat.chatroom;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** chat_rooms (SCHEMA.md #4). 삭제는 soft delete, 목록 정렬은 last_message_at DESC. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoom {

	/** 첫 USER 메시지에서 자동 제목 생성 시 자르는 길이 (D-010) */
	public static final int AUTO_TITLE_LENGTH = 30;

	private Long id;
	private Long userId;
	private String title;
	@Builder.Default
	private int messageCount = 0;
	private LocalDateTime lastMessageAt;
	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;
	private LocalDateTime deletedAt;

	/** 첫 메시지 앞 30자 → 제목. 개행/연속 공백은 하나로. 비면 "새 대화". */
	public static String autoTitle(String firstMessage) {
		if (firstMessage == null) return "새 대화";
		String t = firstMessage.replaceAll("\\s+", " ").trim();
		if (t.isEmpty()) return "새 대화";
		return t.length() <= AUTO_TITLE_LENGTH ? t : t.substring(0, AUTO_TITLE_LENGTH);
	}
}
