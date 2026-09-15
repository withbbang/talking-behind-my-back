package com.example.chat.chatroom;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

/**
 * Room JSON (API.md#rooms). role 은 요청자의 역할. inviteCode/inviteUrl 은 OWNER 에게만(참여자 null).
 * 목록 항목은 members 를 채우지 않는다(null) — memberCount 만.
 */
public record RoomResponse(
	Long id,
	String title,
	RoomMember.Role role,
	RoomStatus status,
	RoomMode mode,
	AiPersonality aiPersonality,
	String inviteCode,
	String inviteUrl,
	List<Member> members,
	int memberCount,
	int messageCount,
	Instant lastMessageAt,
	Instant createdAt
) {

	public record Member(Long userId, String nickname, RoomMember.Role role) {

		static Member of(RoomMember m) {
			return new Member(m.getUserId(), m.getNickname(), m.getRole());
		}
	}

	/** @param members null 이면 목록 항목(members 생략) */
	static RoomResponse of(ChatRoom room, RoomMember.Role myRole, List<RoomMember> members, String baseUrl, ZoneId zone) {
		boolean owner = myRole == RoomMember.Role.OWNER;
		return new RoomResponse(
			room.getId(), room.getTitle(), myRole, room.getStatus(), room.getMode(), room.getAiPersonality(),
			owner ? room.getInviteCode() : null,
			owner ? baseUrl + "/join/" + room.getInviteCode() : null,
			members == null ? null : members.stream().map(Member::of).toList(),
			room.getMemberCount(), room.getMessageCount(),
			room.getLastMessageAt().atZone(zone).toInstant(),
			room.getCreatedAt().atZone(zone).toInstant());
	}
}
