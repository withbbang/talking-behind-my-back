-- T-019 (D-017) 어드민 페르소나 폐지 → 시스템 프롬프트는 방 단위.
-- ai_prompt: 개설자가 직접 쓴 프롬프트(1~2,000자, 앱 레벨 검증). NULL 이면 ai_personality 프리셋 문구 사용.
-- 프리셋(ai_personality) 재선택 시 앱이 NULL 로 초기화한다.
ALTER TABLE chat_rooms
  ADD COLUMN ai_prompt TEXT NULL AFTER ai_personality;

-- personas: V1 시드 1행뿐(운영 데이터 없음). 어드민 편집 계층 자체를 없앤다.
DROP TABLE personas;
