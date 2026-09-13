package com.example.chat.chatroom;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/ChatRoomMapper.xml. 모든 조회는 deleted_at IS NULL + 소유자(userId) 조건. 타인 방은 empty → 404 (API.md). */
@Mapper
public interface ChatRoomMapper {

	int insert(ChatRoom room);

	Optional<ChatRoom> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

	/**
	 * 사이드바 목록. last_message_at DESC, id DESC. cursorId 가 null 이면 처음부터.
	 * (커서는 id 기준 — 정렬 키가 last_message_at 이라 엄밀한 키셋은 아니지만 v1 은 방 수가 작아 충분. T-006 에서 재검토)
	 */
	List<ChatRoom> findByUserId(@Param("userId") Long userId, @Param("cursorId") Long cursorId, @Param("size") int size);

	int updateTitle(@Param("id") Long id, @Param("userId") Long userId, @Param("title") String title);

	/** 메시지 저장 시 message_count +1, last_message_at = now */
	int touchOnNewMessage(@Param("id") Long id);

	int softDelete(@Param("id") Long id, @Param("userId") Long userId);
}
