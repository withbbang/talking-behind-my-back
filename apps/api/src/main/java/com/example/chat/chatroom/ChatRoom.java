package com.example.chat.chatroom;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * chat_rooms (SCHEMA.md #4). soft delete 없음 — "삭제" = 나가기(room_members.left_at). 목록 정렬은 (last_message_at, id) DESC.
 * 멤버십·권한 판정은 RoomMember 로, 여기엔 방 자체 상태만.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoom {

	public static final String DEFAULT_TITLE = "새 대화";

	/** 첫 USER 메시지로 제목을 채울 때 자르는 길이 (제목이 아직 DEFAULT_TITLE 일 때, T-007) */
	public static final int AUTO_TITLE_LENGTH = 30;

	private Long id;
	private Long ownerId;
	private String title;
	private String inviteCode;
	@Builder.Default
	private AiPersonality aiPersonality = AiPersonality.RATIONAL;
	/** 개설자가 직접 쓴 시스템 프롬프트. null 이면 프리셋 문구(T-019, D-017). */
	private String aiPrompt;
	@Builder.Default
	private RoomMode mode = RoomMode.AI;
	@Builder.Default
	private RoomStatus status = RoomStatus.ACTIVE;
	@Builder.Default
	private int messageCount = 0;
	private LocalDateTime lastMessageAt;
	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;
	/** 조회 전용 — 활성 멤버 수(서브쿼리). insert 에는 쓰이지 않는다. */
	private int memberCount;

	/** 새 방. title null/공백이면 DEFAULT_TITLE. last_message_at/created_at 은 매퍼 insert 가 같은 NOW(3) 로 채운다. */
	public static ChatRoom create(Long ownerId, String title, String inviteCode) {
		String t = title == null ? "" : title.trim();
		return ChatRoom.builder().ownerId(ownerId).title(t.isEmpty() ? DEFAULT_TITLE : t).inviteCode(inviteCode).build();
	}

	public boolean isOrphaned() {
		return status == RoomStatus.ORPHANED;
	}

	/** AI 에 실제로 넣는 시스템 프롬프트 — 커스텀(aiPrompt) 우선, 없으면 프리셋 문구. T-007 컨텍스트가 쓴다. */
	public String effectiveAiPrompt() {
		return aiPrompt != null ? aiPrompt : aiPersonality.systemPrompt();
	}

	/** 첫 메시지 앞 30자 → 제목. 개행/연속 공백은 하나로. 비면 "새 대화". */
	public static String autoTitle(String firstMessage) {
		if (firstMessage == null) return DEFAULT_TITLE;
		String t = firstMessage.replaceAll("\\s+", " ").trim();
		if (t.isEmpty()) return DEFAULT_TITLE;
		return t.length() <= AUTO_TITLE_LENGTH ? t : t.substring(0, AUTO_TITLE_LENGTH);
	}
}
