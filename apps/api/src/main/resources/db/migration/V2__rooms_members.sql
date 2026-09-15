-- T-006 2인 채팅방 (SCHEMA.md #4, #4-1, #5). 컬럼 추가는 이 마이그레이션 한 번에 — T-016/T-017 은 코드만.
-- 운영 배포 전(T-012 TODO)이라 백필 대상은 로컬 데이터뿐. 백필 규칙은 TASKS.md T-006 note.

-- 1. chat_rooms: user_id → owner_id, 초대코드/성격/모드/상태 추가, soft delete 제거
ALTER TABLE chat_rooms
  DROP FOREIGN KEY fk_rooms_user,
  DROP INDEX idx_rooms_user_list;

ALTER TABLE chat_rooms
  RENAME COLUMN user_id TO owner_id,
  ADD COLUMN invite_code    VARCHAR(16) NULL AFTER title,
  ADD COLUMN ai_personality VARCHAR(20) NOT NULL DEFAULT 'RATIONAL' AFTER invite_code,   -- RATIONAL / EMOTIONAL
  ADD COLUMN mode           VARCHAR(20) NOT NULL DEFAULT 'AI'       AFTER ai_personality, -- AI / HUMAN
  ADD COLUMN status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'   AFTER mode;           -- ACTIVE / ORPHANED

-- invite_code 백필: id 를 base32(0/O/1/I 제외 32자) 8자로 인코딩. 결정적·유일. 신규 방은 앱이 SecureRandom 으로 발급.
UPDATE chat_rooms SET invite_code = CONCAT(
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 35) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 30) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 25) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 20) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 15) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >> 10) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ((id >>  5) & 31) + 1, 1),
  SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ( id        & 31) + 1, 1)
) WHERE invite_code IS NULL;

-- last_message_at: 목록 정렬 키라 NOT NULL. 메시지 없던 방은 created_at.
UPDATE chat_rooms SET last_message_at = created_at WHERE last_message_at IS NULL;

-- soft delete 됐던 방은 "개설자가 나간 방"(ORPHANED) 으로 이관. 멤버십 백필(아래)에서 left_at 으로 옮긴다.
UPDATE chat_rooms SET status = 'ORPHANED' WHERE deleted_at IS NOT NULL;

-- 2. room_members 신설 + 기존 방 OWNER 백필
CREATE TABLE room_members (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id   BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  role      VARCHAR(20)     NOT NULL,                      -- OWNER / PARTICIPANT
  joined_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at   DATETIME(3)     NULL,                          -- NULL = 활성 멤버
  PRIMARY KEY (id),
  UNIQUE KEY uk_room_members_room_user (room_id, user_id),
  KEY idx_room_members_user (user_id, left_at),
  CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
  CONSTRAINT fk_room_members_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
SELECT id, owner_id, 'OWNER', created_at, deleted_at FROM chat_rooms;

-- 3. chat_rooms 제약 마무리 (백필 후)
ALTER TABLE chat_rooms
  MODIFY COLUMN invite_code     VARCHAR(16) NOT NULL,
  MODIFY COLUMN last_message_at DATETIME(3) NOT NULL,
  DROP COLUMN deleted_at,
  ADD UNIQUE KEY uk_rooms_invite_code (invite_code),
  ADD KEY idx_rooms_owner (owner_id),
  ADD KEY idx_rooms_list (last_message_at DESC, id DESC),
  ADD CONSTRAINT fk_rooms_owner FOREIGN KEY (owner_id) REFERENCES users (id);

-- 4. messages: 발신 유저·발신 당시 모드. V1 은 1인 방이라 USER 행 발신자 = 개설자, 모드 = AI.
ALTER TABLE messages
  ADD COLUMN sender_user_id BIGINT UNSIGNED NULL AFTER room_id,   -- USER 만. ASSISTANT 는 NULL
  ADD COLUMN mode           VARCHAR(20)     NULL AFTER input_type, -- 발신 당시 방 모드 AI / HUMAN
  ADD KEY idx_messages_sender (sender_user_id),
  ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users (id);

UPDATE messages m JOIN chat_rooms r ON r.id = m.room_id
SET m.sender_user_id = r.owner_id, m.mode = 'AI'
WHERE m.role = 'USER';
