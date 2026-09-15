package com.example.chat.chatroom;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/RoomMemberMapper.xml. "활성" = left_at IS NULL. 재입장(left_at 복구)·정원 잠금은 T-016. */
@Mapper
public interface RoomMemberMapper {

	/** (room_id, user_id) UNIQUE 충돌은 DuplicateKeyException. joined_at 은 DB 기본값. */
	int insert(RoomMember member);

	Optional<RoomMember> findActive(@Param("roomId") Long roomId, @Param("userId") Long userId);

	/** users 조인으로 nickname 포함. joined_at, id 순. */
	List<RoomMember> findActiveByRoomId(@Param("roomId") Long roomId);

	/** 활성 방 상한(50) 판정용 — 개설 + 참여 합산 */
	int countActiveByUserId(@Param("userId") Long userId);

	/** 나가기. 이미 나간 멤버는 0. */
	int leave(@Param("roomId") Long roomId, @Param("userId") Long userId);
}
