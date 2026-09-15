package com.example.chat.message;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** daily_usage (SCHEMA.md #7). (user_id, usage_date) UNIQUE, upsert 로만 갱신. 날짜는 KST(AppProperties.zoneId). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyUsage {

	private Long id;
	private Long userId;
	private LocalDate usageDate;
	private int messageCount;
	private int promptTokens;
	private int completionTokens;
	private int sttSeconds;
	private int ttsChars;
}
