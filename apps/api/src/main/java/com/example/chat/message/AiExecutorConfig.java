package com.example.chat.message;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** AI 잡 스레드풀 + RoomAiExecutor 빈. @EnableScheduling 은 RoomEventBus 하트비트용(D-019). */
@Configuration
@EnableScheduling
public class AiExecutorConfig {

	@Bean(destroyMethod = "shutdownNow")
	public ThreadPoolExecutor aiJobPool(AiExecutorProperties props) {
		ThreadPoolExecutor pool = new ThreadPoolExecutor(props.coreThreads(), props.maxThreads(), 60, TimeUnit.SECONDS,
			new ArrayBlockingQueue<>(props.queueSize()));
		pool.setThreadFactory(r -> {
			Thread t = new Thread(r, "ai-job");
			t.setDaemon(true);
			return t;
		});
		return pool;
	}

	@Bean
	public RoomAiExecutor roomAiExecutor(ThreadPoolExecutor aiJobPool) {
		return new RoomAiExecutor(aiJobPool);
	}
}
