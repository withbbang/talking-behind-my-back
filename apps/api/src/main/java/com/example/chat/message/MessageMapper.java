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

	/**
	 * 과거 메시지 페이지: id DESC, cursorId 보다 작은 것. null 이면 최신부터. (API.md#messages)
	 * viewerId 가 볼 수 있는 행만 — `visible_to_user_id IS NULL OR = viewerId` (D-037).
	 */
	List<Message> findByRoomId(@Param("roomId") Long roomId, @Param("viewerId") Long viewerId,
		@Param("cursorId") Long cursorId, @Param("size") int size);

	/** 가시성과 무관한 최근 N개 (id DESC). 어드민·검증용 — AI 컨텍스트는 findRecentForAiContext 를 쓴다. */
	List<Message> findRecentByRoomId(@Param("roomId") Long roomId, @Param("limit") int limit);

	/**
	 * LLM 컨텍스트용 최근 N개 (id DESC 로 나옴 — 서비스에서 뒤집어 시간순으로) (D-006).
	 * 두 유저의 `AI` 모드 대화 + 모든 ASSISTANT 응답. `HUMAN` 모드 USER 행은 제외 — 최근 N 창도 그 행을 세지 않는다(D-037).
	 */
	List<Message> findRecentForAiContext(@Param("roomId") Long roomId, @Param("limit") int limit);

	long countByRoomId(@Param("roomId") Long roomId);
}
