package com.example.chat.message;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/MessageMapper.xml. 방 소유권 검증은 ChatRoomMapper 로 먼저 하고 여기선 room_id 만 믿는다. */
@Mapper
public interface MessageMapper {

	int insert(Message message);

	Optional<Message> findById(@Param("id") Long id);

	/** 과거 메시지 페이지: id DESC, cursorId 보다 작은 것. null 이면 최신부터. (API.md#messages) */
	List<Message> findByRoomId(@Param("roomId") Long roomId, @Param("cursorId") Long cursorId, @Param("size") int size);

	/** LLM 컨텍스트용 최근 N개 (id DESC 로 나옴 — 서비스에서 뒤집어 시간순으로) (D-006) */
	List<Message> findRecentByRoomId(@Param("roomId") Long roomId, @Param("limit") int limit);

	long countByRoomId(@Param("roomId") Long roomId);
}
