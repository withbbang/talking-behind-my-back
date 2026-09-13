package com.example.chat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 컨텍스트 기동 확인. test 프로파일(build.gradle 주입) → 로컬 compose MySQL 또는 CI MySQL 서비스 필요.
 * Flyway 마이그레이션까지 돌아가므로 V1__init.sql 문법 오류도 여기서 잡힌다.
 */
@SpringBootTest
class ChatApplicationTests {

	@Test
	void contextLoads() {
	}
}
