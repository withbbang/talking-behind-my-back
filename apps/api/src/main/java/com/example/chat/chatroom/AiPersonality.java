package com.example.chat.chatroom;

/**
 * 방의 AI 성격 (SCHEMA.md #4). 개설자만 변경. 시스템 프롬프트 문구는 여기 상수로 보유(어드민 편집 없음, T-017) —
 * T-007 컨텍스트 조립이 어드민 기본 페르소나 뒤에 {@link #systemPrompt()} 를 붙인다. 문구 변경 = 코드 수정.
 */
public enum AiPersonality {

	RATIONAL("너는 논리적이고 차분한 대화 상대다. 감정보다 사실과 근거를 우선하고, 명확하고 간결하게 답한다."),
	EMOTIONAL("너는 따뜻하고 공감 능력이 높은 대화 상대다. 상대의 감정을 먼저 알아주고, 부드럽고 친근한 말투로 답한다.");

	public static final AiPersonality DEFAULT = RATIONAL;

	private final String systemPrompt;

	AiPersonality(String systemPrompt) {
		this.systemPrompt = systemPrompt;
	}

	public String systemPrompt() {
		return systemPrompt;
	}
}
