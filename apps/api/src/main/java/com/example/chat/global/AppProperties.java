package com.example.chat.global;

import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app.* 공통 값. base-url 은 초대 URL·OAuth redirect 의 기준, time-zone 은 DB DATETIME(서울 로컬시각) → API Instant(UTC) 변환 기준.
 * MySQL 이 TZ=Asia/Seoul 로 CURRENT_TIMESTAMP 를 찍고 JDBC serverTimezone 도 같아 LocalDateTime 은 서울 시각이다 (SCHEMA.md#공통).
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String baseUrl, String timeZone) {

	public AppProperties {
		if (baseUrl != null && baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
		if (timeZone == null || timeZone.isBlank()) timeZone = "Asia/Seoul";
	}

	public ZoneId zoneId() {
		return ZoneId.of(timeZone);
	}
}
