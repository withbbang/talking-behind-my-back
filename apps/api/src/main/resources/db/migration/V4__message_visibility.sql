-- T-031 (D-037) 방 모드 재정의: `AI` 모드 대화는 각자 AI 와 1:1 — 상대는 볼 수 없다.
-- visible_to_user_id: NULL = 방 전원(HUMAN 모드 대화), 값 = 그 유저만.
--   USER  행 → mode='AI' 면 발신자, mode='HUMAN' 이면 NULL
--   ASSISTANT 행 → 트리거 USER 메시지의 발신자
-- 조회는 항상 `visible_to_user_id IS NULL OR visible_to_user_id = :viewer`.
ALTER TABLE messages
  ADD COLUMN visible_to_user_id BIGINT UNSIGNED NULL AFTER mode,
  ADD KEY idx_messages_visibility (room_id, visible_to_user_id, id),
  ADD CONSTRAINT fk_messages_visible_to FOREIGN KEY (visible_to_user_id) REFERENCES users (id);

-- 백필 1: AI 모드 USER 행은 발신자 것.
UPDATE messages
SET visible_to_user_id = sender_user_id
WHERE role = 'USER' AND mode = 'AI';

-- 백필 2: ASSISTANT 행은 직전 AI 모드 USER 행의 발신자 것. 못 찾으면 NULL(전원 공개) 로 남는다.
-- MySQL 은 UPDATE 대상 테이블을 서브쿼리에서 다시 읽는 걸 막으므로 임시 테이블로 한 번 끊는다.
CREATE TEMPORARY TABLE tmp_assistant_owner AS
SELECT a.id AS message_id,
       (SELECT b.sender_user_id
          FROM messages b
         WHERE b.room_id = a.room_id AND b.id < a.id AND b.role = 'USER' AND b.mode = 'AI'
         ORDER BY b.id DESC
         LIMIT 1) AS owner_id
  FROM messages a
 WHERE a.role = 'ASSISTANT';

UPDATE messages m
  JOIN tmp_assistant_owner t ON t.message_id = m.id
   SET m.visible_to_user_id = t.owner_id;

DROP TEMPORARY TABLE tmp_assistant_owner;
