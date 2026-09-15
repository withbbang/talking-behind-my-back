package com.example.chat.chatroom;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * mapper/ChatRoomMapper.xml. 멤버 검증이 필요한 조회는 findByIdForMember(활성 멤버십 조인) — 비멤버는 empty → 404 (API.md).
 * 모든 select 는 활성 멤버 수(member_count)를 서브쿼리로 함께 가져온다.
 */
@Mapper
public interface ChatRoomMapper {

	/** last_message_at 과 created_at 을 같은 NOW(3) 로 채운다. invite_code UNIQUE 충돌은 DuplicateKeyException. */
	int insert(ChatRoom room);

	Optional<ChatRoom> findById(@Param("id") Long id);

	/** userId 가 활성 멤버(left_at IS NULL)인 경우에만. ORPHANED 방도 멤버십이 남아 있으면 반환. */
	Optional<ChatRoom> findByIdForMember(@Param("id") Long id, @Param("userId") Long userId);

	/**
	 * 내 활성 멤버십 방 목록. (last_message_at DESC, id DESC) 키셋 — cursorAt/cursorId 둘 다 null 이면 처음부터.
	 * 호출자는 size+1 로 조회해 다음 페이지 유무를 판정한다(CursorPage).
	 */
	List<ChatRoom> findListByMember(@Param("userId") Long userId, @Param("cursorAt") LocalDateTime cursorAt,
		@Param("cursorId") Long cursorId, @Param("size") int size);

	int updateTitle(@Param("id") Long id, @Param("title") String title);

	int updateStatus(@Param("id") Long id, @Param("status") RoomStatus status);

	/** 메시지 저장 시 message_count +1, last_message_at = now */
	int touchOnNewMessage(@Param("id") Long id);

	/** 테스트·백필용 — 정렬 키를 직접 지정. 서비스 코드에서는 쓰지 않는다. */
	int setLastMessageAt(@Param("id") Long id, @Param("at") LocalDateTime at);
}
