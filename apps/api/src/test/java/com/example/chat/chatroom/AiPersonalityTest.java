package com.example.chat.chatroom;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** T-017 — 방 AI 성격별 시스템 프롬프트 문구는 enum 이 보유한다(어드민 편집 없음). T-007 컨텍스트 조립에서 사용. */
class AiPersonalityTest {

	@Test
	void 모든_성격은_비어_있지_않은_시스템_프롬프트를_가진다() {
		for (AiPersonality p : AiPersonality.values()) {
			assertThat(p.systemPrompt()).as(p.name()).isNotBlank();
		}
	}

	@Test
	void 기본값은_RATIONAL_이고_두_문구는_서로_다르다() {
		assertThat(AiPersonality.DEFAULT).isEqualTo(AiPersonality.RATIONAL);
		assertThat(AiPersonality.RATIONAL.systemPrompt()).isNotEqualTo(AiPersonality.EMOTIONAL.systemPrompt());
	}
}
