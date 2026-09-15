# SCHEMA — DB 스키마

> **Write: 개발자 | Read: 전원**
> TL;DR: MySQL 8.4, utf8mb4. 테이블 8개. V1(T-003) = 초기 7개. **V2(T-006) = 2인 채팅방 요건** — `chat_rooms` 소유/초대/성격/모드/상태,
> `room_members` 신설, `messages.sender_user_id/mode`. Flyway `V{n}__*.sql`만 DDL 을 소유한다(D-009).

## 공통 규칙
- 이름: 테이블·컬럼 snake_case, 테이블은 복수형.
- PK: `id BIGINT UNSIGNED AUTO_INCREMENT`.
- 시간: `DATETIME(3)` UTC. `created_at`/`updated_at` 기본 `CURRENT_TIMESTAMP(3)`.
- soft delete: `deleted_at DATETIME(3) NULL`. 조회 시 `deleted_at IS NULL` 필수.
- enum은 `VARCHAR(20)` + 앱 레벨 enum (MySQL ENUM 미사용 — 값 추가 시 ALTER 회피).
- FK는 선언하되 `ON DELETE` 캐스케이드 없음(soft delete 정책과 충돌).

## 1. users — 회원
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| nickname | VARCHAR(50) | NOT NULL | 소셜 프로필명 기본값, 수정 가능 |
| profile_image_url | VARCHAR(500) | NULL | |
| role | VARCHAR(20) | NOT NULL DEFAULT 'USER' | USER / ADMIN |
| status | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE' | ACTIVE / SUSPENDED |
| last_login_at | DATETIME(3) | NULL | |
| created_at, updated_at | DATETIME(3) | NOT NULL | |
| deleted_at | DATETIME(3) | NULL | 탈퇴 |

- 이메일은 여기 두지 않는다(공급자마다 제공 여부·검증 여부가 다름) → `social_accounts.email`.

## 2. social_accounts — 소셜 연결
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| user_id | BIGINT UNSIGNED | FK users, NOT NULL | |
| provider | VARCHAR(20) | NOT NULL | GOOGLE / NAVER / KAKAO |
| provider_user_id | VARCHAR(191) | NOT NULL | 공급자 고유 ID(sub / id / response.id) |
| email | VARCHAR(255) | NULL | 공급자가 준 이메일 |
| created_at | DATETIME(3) | NOT NULL | |

- UNIQUE `(provider, provider_user_id)`. INDEX `(user_id)`.
- v1은 사용자당 소셜 1개. 같은 이메일로 다른 공급자 로그인 시 연결/신규 정책은 D-003 보완 결정 후 반영.

## 3. refresh_tokens — 리프레시 토큰 (회전)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| user_id | BIGINT UNSIGNED | FK users, NOT NULL | |
| token_hash | CHAR(64) | UNIQUE NOT NULL | SHA-256(raw token) |
| family_id | CHAR(36) | NOT NULL | 회전 체인 식별(재사용 감지 시 family 전체 revoke) |
| expires_at | DATETIME(3) | NOT NULL | |
| revoked_at | DATETIME(3) | NULL | |
| created_at | DATETIME(3) | NOT NULL | |

- INDEX `(user_id)`, `(family_id)`. 만료·revoke 행은 배치로 정리(주 1회).

## 4. chat_rooms — 채팅방 (V2 에서 변경)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| owner_id | BIGINT UNSIGNED | FK users, NOT NULL | 개설자. V1 `user_id` 에서 이름 변경 |
| title | VARCHAR(100) | NOT NULL | 생성 시 "새 대화", 첫 메시지 30자 자동, 수정 가능 |
| invite_code | VARCHAR(16) | NOT NULL, UNIQUE | 8자 base32(`0/O/1/I` 제외). 개설자가 재발급 가능 |
| ai_personality | VARCHAR(20) | NOT NULL DEFAULT 'RATIONAL' | RATIONAL / EMOTIONAL. 개설자만 변경 |
| mode | VARCHAR(20) | NOT NULL DEFAULT 'AI' | AI(유저↔AI) / HUMAN(유저끼리, AI 휴면). 혼자면 항상 AI |
| status | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE' | ACTIVE / ORPHANED(개설자 이탈, 주인 없는 방) |
| message_count | INT UNSIGNED | NOT NULL DEFAULT 0 | 역정규화. 메시지 저장 시 +1 |
| last_message_at | DATETIME(3) | NOT NULL | 목록 정렬 키. 생성 시 created_at 과 같은 값으로 초기화 |
| created_at, updated_at | DATETIME(3) | NOT NULL | |

- INDEX `(owner_id)`, `(last_message_at DESC, id DESC)`. 목록은 `room_members` 조인(아래).
- **soft delete 없음.** V1 `deleted_at` 은 V2 에서 제거. "삭제" = 나가기 = `room_members.left_at`. 방·메시지 행은 영구 보존(물리 삭제 없음).
- 개설자 이탈: `status = ORPHANED` + 개설자 `left_at`. 참여자 멤버십은 남겨 두어 프론트가 "이용할 수 없는 채팅방" 모달을 띄우고, 확인 시 참여자 `left_at`.
- 활성 방 상한: 사용자당 50개(개설 + 참여, `left_at IS NULL` 기준). 앱 레벨 판정.

## 4-1. room_members — 방 멤버십 (V2 신설)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| room_id | BIGINT UNSIGNED | FK chat_rooms, NOT NULL | |
| user_id | BIGINT UNSIGNED | FK users, NOT NULL | |
| role | VARCHAR(20) | NOT NULL | OWNER / PARTICIPANT |
| joined_at | DATETIME(3) | NOT NULL | 재입장 시 갱신 |
| left_at | DATETIME(3) | NULL | NULL = 활성 멤버 |

- UNIQUE `(room_id, user_id)` — 방당 유저 1행. 재입장은 `left_at = NULL, joined_at = now` 로 갱신.
- INDEX `(user_id, left_at)` — 내 방 목록. 
- 활성 멤버(`left_at IS NULL`) ≤ 2 는 앱 레벨: 입장 트랜잭션에서 `SELECT ... FROM chat_rooms WHERE id = ? FOR UPDATE` 후 카운트.

## 5. messages — 메시지 (V2 에서 컬럼 추가)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | 커서 페이징 키 |
| room_id | BIGINT UNSIGNED | FK chat_rooms, NOT NULL | |
| sender_user_id | BIGINT UNSIGNED | FK users, NULL | USER 만: 발신 유저. ASSISTANT 는 NULL (V2) |
| role | VARCHAR(20) | NOT NULL | USER / ASSISTANT |
| content | MEDIUMTEXT | NOT NULL | |
| input_type | VARCHAR(20) | NULL | USER만: TEXT / VOICE |
| mode | VARCHAR(20) | NULL | 발신 당시 방 모드 AI / HUMAN (V2). 컨텍스트 라벨링·통계용 |
| model | VARCHAR(100) | NULL | ASSISTANT만: OmniRoute가 실제 사용한 모델 |
| prompt_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| completion_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| created_at | DATETIME(3) | NOT NULL | |

- INDEX `(room_id, id)`, `(sender_user_id)`. 메시지 개별 삭제 없음. 방 이탈해도 메시지는 남는다.
- HUMAN 모드 대화도 저장되며 AI 컨텍스트에 포함된다(발신자 라벨 부착, T-007).
- 오디오 관련 컬럼 없음 — 원본을 저장하지 않는다(D-007).

## 6. personas — 페르소나(시스템 프롬프트)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| name | VARCHAR(50) | NOT NULL | |
| system_prompt | TEXT | NOT NULL | |
| is_active | TINYINT(1) | NOT NULL DEFAULT 0 | 활성은 정확히 1개(앱 레벨 보장 + 활성화 시 트랜잭션) |
| created_at, updated_at | DATETIME(3) | NOT NULL | |

- 초기 데이터: `V1__init.sql`에서 기본 페르소나 1개 INSERT(is_active=1).

## 7. daily_usage — 일별 사용량 집계 (어드민 stats·상한용)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| user_id | BIGINT UNSIGNED | FK users, NOT NULL | |
| usage_date | DATE | NOT NULL | KST 기준 |
| message_count | INT UNSIGNED | NOT NULL DEFAULT 0 | |
| prompt_tokens | INT UNSIGNED | NOT NULL DEFAULT 0 | |
| completion_tokens | INT UNSIGNED | NOT NULL DEFAULT 0 | |
| stt_seconds | INT UNSIGNED | NOT NULL DEFAULT 0 | |
| tts_chars | INT UNSIGNED | NOT NULL DEFAULT 0 | |

- UNIQUE `(user_id, usage_date)`. `INSERT ... ON DUPLICATE KEY UPDATE`로 갱신.
- 일일 상한(D-007 open)이 결정되면 이 테이블로 판정.

## 관계
```
users 1 ─ N social_accounts
users 1 ─ N refresh_tokens
users 1 ─ N chat_rooms(owner) 1 ─ N messages
users N ─ N chat_rooms  (room_members, 방당 활성 ≤ 2)
users 1 ─ N messages(sender_user_id)
users 1 ─ N daily_usage
personas (독립, 활성 1개)
```

## 미결
- 이메일 중복 시 계정 연결 정책 (D-003 보완)
- `messages.content` 길이 상한(4,000자 요청 기준이면 TEXT로 충분, 응답은 MEDIUMTEXT 유지)
- ~~방 개수 상한(사용자당)~~ → 50개로 확정(2026-09-15, D-017~ 기록 대기)
- 방별 AI 장기 메모리(`ai_memory` 요약) — 백로그. 컨텍스트 윈도우 밖 과거 학습이 필요해지면 도입
