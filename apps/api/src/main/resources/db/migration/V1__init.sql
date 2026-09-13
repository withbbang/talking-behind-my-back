-- V1: 초기 스키마 (.agent/SCHEMA.md 확정본, T-003). Flyway 가 DDL 을 소유한다(D-009).
-- infra/mysql/init/01-schema.sql 은 DB 레벨 설정만 하고 테이블은 만들지 않는다.

CREATE TABLE users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nickname          VARCHAR(50)     NOT NULL,
  profile_image_url VARCHAR(500)    NULL,
  role              VARCHAR(20)     NOT NULL DEFAULT 'USER',      -- USER / ADMIN
  status            VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE / SUSPENDED
  last_login_at     DATETIME(3)     NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_users_status (status, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE social_accounts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  provider         VARCHAR(20)     NOT NULL,                      -- GOOGLE / NAVER / KAKAO
  provider_user_id VARCHAR(191)    NOT NULL,
  email            VARCHAR(255)    NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_social_provider_uid (provider, provider_user_id),
  KEY idx_social_user (user_id),
  KEY idx_social_email (email),
  CONSTRAINT fk_social_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL,                             -- SHA-256(raw)
  family_id  CHAR(36)        NOT NULL,                             -- 회전 체인. 재사용 감지 시 family 전체 revoke
  expires_at DATETIME(3)     NOT NULL,
  revoked_at DATETIME(3)     NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id),
  KEY idx_refresh_family (family_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE chat_rooms (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(100)    NOT NULL,
  message_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  last_message_at DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_rooms_user_list (user_id, deleted_at, last_message_at DESC),
  CONSTRAINT fk_rooms_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE messages (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id           BIGINT UNSIGNED NOT NULL,
  role              VARCHAR(20)     NOT NULL,                      -- USER / ASSISTANT
  content           MEDIUMTEXT      NOT NULL,
  input_type        VARCHAR(20)     NULL,                          -- USER 만: TEXT / VOICE
  model             VARCHAR(100)    NULL,                          -- ASSISTANT 만
  prompt_tokens     INT UNSIGNED    NULL,
  completion_tokens INT UNSIGNED    NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_messages_room (room_id, id),
  CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE personas (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50)     NOT NULL,
  system_prompt TEXT            NOT NULL,
  is_active     TINYINT(1)      NOT NULL DEFAULT 0,                -- 활성은 정확히 1개(앱 레벨 보장)
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_personas_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE daily_usage (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  usage_date        DATE            NOT NULL,                      -- KST 기준
  message_count     INT UNSIGNED    NOT NULL DEFAULT 0,
  prompt_tokens     INT UNSIGNED    NOT NULL DEFAULT 0,
  completion_tokens INT UNSIGNED    NOT NULL DEFAULT 0,
  stt_seconds       INT UNSIGNED    NOT NULL DEFAULT 0,
  tts_chars         INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usage_user_date (user_id, usage_date),
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 기본 페르소나 (어드민에서 수정/교체)
INSERT INTO personas (name, system_prompt, is_active) VALUES (
  '기본',
  '너는 사용자의 친근한 대화 친구야. 반말로 짧고 자연스럽게 대답해. 한 번에 두세 문장을 넘기지 말고, 사용자의 말에 공감하면서 가끔 되물어 대화를 이어가. 모르는 건 모른다고 솔직하게 말해.',
  1
);
