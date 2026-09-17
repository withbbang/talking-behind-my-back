package com.example.chat.message;

import java.time.LocalDate;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/DailyUsageMapper.xml. 전부 INSERT ... ON DUPLICATE KEY UPDATE (T-007). 발신자 귀속 규칙은 MessageService. */
@Mapper
public interface DailyUsageMapper {

	/** USER 메시지 전송 시 message_count +1 */
	int addMessage(@Param("userId") Long userId, @Param("date") LocalDate date);

	/** AI 응답 완료 시 토큰 누적(트리거 메시지 발신자 귀속) */
	int addTokens(@Param("userId") Long userId, @Param("date") LocalDate date,
		@Param("promptTokens") int promptTokens, @Param("completionTokens") int completionTokens);

	/** STT 성공 시 stt_seconds 누적(공급자 보고 길이 올림, T-009) */
	int addSttSeconds(@Param("userId") Long userId, @Param("date") LocalDate date, @Param("seconds") int seconds);

	/** TTS 성공 시 tts_chars 누적(요청 텍스트 길이, T-009) */
	int addTtsChars(@Param("userId") Long userId, @Param("date") LocalDate date, @Param("chars") int chars);

	Optional<DailyUsage> find(@Param("userId") Long userId, @Param("date") LocalDate date);
}
