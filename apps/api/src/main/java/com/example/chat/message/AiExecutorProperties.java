package com.example.chat.message;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** app.ai.* — AI 잡 공용 스레드풀 (D-019: core 2 / max 4 / queue 16, NAS 1대 기준). */
@ConfigurationProperties(prefix = "app.ai")
public record AiExecutorProperties(int coreThreads, int maxThreads, int queueSize) {

	public AiExecutorProperties {
		if (coreThreads <= 0) coreThreads = 2;
		if (maxThreads < coreThreads) maxThreads = Math.max(coreThreads, 4);
		if (queueSize <= 0) queueSize = 16;
	}
}
