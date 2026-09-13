package com.example.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * chat-app API. 패키지는 기능 단위(auth/user/chatroom/message/llm/speech/admin/global) — CONVENTIONS.md#백엔드.
 * context-path 는 /api (D-004).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class ChatApplication {

	public static void main(String[] args) {
		SpringApplication.run(ChatApplication.class, args);
	}
}
