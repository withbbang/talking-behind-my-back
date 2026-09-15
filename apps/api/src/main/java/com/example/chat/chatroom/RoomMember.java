package com.example.chat.chatroom;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** room_members (SCHEMA.md #4-1). left_at NULL = 활성 멤버. 방당 유저 1행(UNIQUE), 활성 ≤ 2 는 앱 레벨. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomMember {

	public enum Role { OWNER, PARTICIPANT }

	private Long id;
	private Long roomId;
	private Long userId;
	private Role role;
	private LocalDateTime joinedAt;
	private LocalDateTime leftAt;
	/** 조회 전용 — users 조인으로 채움(findActiveByRoomId). insert 에는 쓰이지 않는다. */
	private String nickname;

	public static RoomMember owner(Long roomId, Long userId) {
		return RoomMember.builder().roomId(roomId).userId(userId).role(Role.OWNER).build();
	}

	public static RoomMember participant(Long roomId, Long userId) {
		return RoomMember.builder().roomId(roomId).userId(userId).role(Role.PARTICIPANT).build();
	}

	public boolean isOwner() {
		return role == Role.OWNER;
	}
}
