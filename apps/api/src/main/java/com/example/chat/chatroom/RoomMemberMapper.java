package com.example.chat.chatroom;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/RoomMemberMapper.xml. "활성" = left_at IS NULL. 정원 잠금은 ChatRoomMapper.findByInviteCodeForUpdate 가 잡는다(T-016). */
@Mapper
public interface RoomMemberMapper {

	/** (room_id, user_id) UNIQUE 충돌은 DuplicateKeyException. joined_at 은 DB 기본값. */
	int insert(RoomMember member);

	Optional<RoomMember> findActive(@Param("roomId") Long roomId, @Param("userId") Long userId);

	/** users 조인으로 nickname 포함. joined_at, id 순. */
	List<RoomMember> findActiveByRoomId(@Param("roomId") Long roomId);

	/** 나간 멤버 포함(left_at 무관), 입장순. T-007 컨텍스트 라벨용 — 나간 사람 메시지도 실제 닉으로 (D-019). */
	List<RoomMember> findAllByRoomId(@Param("roomId") Long roomId);

	/** 활성 방 상한(50) 판정용 — 개설 + 참여 합산 */
	int countActiveByUserId(@Param("userId") Long userId);

	/** 쌍 유일 규칙(D-022, T-023): 두 사람이 모두 활성 멤버인 ACTIVE 방 수(excludeRoomId 제외). 0 이면 입장 가능. */
	int countActiveRoomsShared(@Param("userId") Long userId, @Param("otherUserId") Long otherUserId,
		@Param("excludeRoomId") Long excludeRoomId);

	/** 정원(2명) 판정용 활성 멤버 수 */
	int countActiveByRoomId(@Param("roomId") Long roomId);

	/** 재입장 — 나간 행(left_at NOT NULL)을 left_at = NULL, joined_at = now 로 되살린다. 행이 없거나 이미 활성이면 0. */
	int rejoin(@Param("roomId") Long roomId, @Param("userId") Long userId);

	/** 테스트 전용 — joined_at 을 직접 지정(재입장 갱신 검증). 서비스 코드에서는 쓰지 않는다. */
	int setJoinedAt(@Param("roomId") Long roomId, @Param("userId") Long userId, @Param("at") LocalDateTime at);

	/** 나가기. 이미 나간 멤버는 0. */
	int leave(@Param("roomId") Long roomId, @Param("userId") Long userId);
}
