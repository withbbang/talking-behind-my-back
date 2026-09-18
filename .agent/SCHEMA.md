# SCHEMA — DB 스키마

> **Write: 개발자 | Read: 전원**
> TL;DR: MySQL 8.4, utf8mb4. 테이블 7개. V1(T-003) = 초기 7개. **V2(T-006) = 2인 채팅방 요건** — `chat_rooms` 소유/초대/성격/모드/상태,
> `room_members` 신설, `messages.sender_user_id/mode`. **V3(T-019, D-017) = `chat_rooms.ai_prompt` 추가 + `personas` DROP.**
> **V4(T-031, D-037) = `messages.visible_to_user_id`** — `AI` 모드 대화는 발신자에게만 보인다. Flyway `V{n}__*.sql`만 DDL 을 소유한다(D-009).

## 공통 규칙
- 이름: 테이블·컬럼 snake_case, 테이블은 복수형.
- PK: `id BIGINT UNSIGNED AUTO_INCREMENT`.
- 시간: `DATETIME(3)`. **저장값은 서울 로컬시각**(MySQL `TZ=Asia/Seoul`, JDBC `serverTimezone=Asia/Seoul`) — API 응답은 `app.time-zone` 으로 `Instant`(UTC `Z`) 변환(T-006 `AppProperties`).
  `created_at`/`updated_at` 기본 `CURRENT_TIMESTAMP(3)`.
- soft delete: `deleted_at DATETIME(3) NULL`. 조회 시 `deleted_at IS NULL` 필수. (chat_rooms 는 V2 에서 제거 — 나가기 모델)
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
| ai_personality | VARCHAR(20) | NOT NULL DEFAULT 'RATIONAL' | RATIONAL / EMOTIONAL 프리셋. 개설자만 변경, 언제든 재선택 |
| ai_prompt | TEXT | NULL | 개설자가 직접 쓴 시스템 프롬프트(1~2,000자). NULL 이면 프리셋 문구 사용. 프리셋 재선택 시 NULL 로 초기화 (V3, D-017) |
| mode | VARCHAR(20) | NOT NULL DEFAULT 'AI' | AI(유저↔AI) / HUMAN(유저끼리, AI 휴면). 혼자면 항상 AI |
| status | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE' | ACTIVE / ORPHANED(개설자 이탈, 주인 없는 방) |
| message_count | INT UNSIGNED | NOT NULL DEFAULT 0 | 역정규화. 메시지 저장 시 +1 |
| last_message_at | DATETIME(3) | NOT NULL | 목록 정렬 키. 생성 시 created_at 과 같은 값으로 초기화 |
| created_at, updated_at | DATETIME(3) | NOT NULL | |

- INDEX `(owner_id)`, `(last_message_at DESC, id DESC)`. 목록은 `room_members` 조인(아래).
- **soft delete 없음.** V1 `deleted_at` 은 V2 에서 제거. "삭제" = 나가기 = `room_members.left_at`. 방·메시지 행은 영구 보존(물리 삭제 없음).
- 개설자 이탈: `status = ORPHANED` + 개설자 `left_at`. 참여자 멤버십은 남겨 두어 프론트가 "이용할 수 없는 채팅방" 모달을 띄우고, 확인 시 참여자 `left_at`.
- 활성 방 상한: 사용자당 50개(개설 + 참여, `left_at IS NULL` 기준). 앱 레벨 판정.
- **V2 백필(2026-09-15, 운영 데이터 없음)**: `invite_code` 는 SQL 로 `id` 를 base32 8자 인코딩(결정적, 재발급은 T-016), `last_message_at NULL → created_at`,
  `deleted_at` 있던 방은 `status=ORPHANED` + OWNER `left_at=deleted_at` 로 이관 후 컬럼 DROP. 기존 방 전부 OWNER 멤버십 백필(`joined_at=created_at`).

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
| mode | VARCHAR(20) | NULL | 발신 당시 방 모드 AI / HUMAN (V2). 컨텍스트 필터·라벨링·통계용 |
| visible_to_user_id | BIGINT UNSIGNED | FK users, NULL | **NULL = 방 전원, 값 = 그 유저만 볼 수 있다** (V4, D-037) |
| model | VARCHAR(100) | NULL | ASSISTANT만: OmniRoute가 실제 사용한 모델 |
| prompt_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| completion_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| created_at | DATETIME(3) | NOT NULL | |

- INDEX `(room_id, id)`, `(sender_user_id)`, `(room_id, visible_to_user_id, id)`(V4 — 뷰어 필터가 붙은 커서 페이징용). 메시지 개별 삭제 없음. 방 이탈해도 메시지는 남는다.
- **가시성(V4, D-037)**: `mode='AI'` USER 행은 `visible_to_user_id = sender_user_id`, 그 응답 ASSISTANT 행은 트리거 USER 의 발신자. `mode='HUMAN'` USER 행은 NULL(방 전원).
  조회는 언제나 `visible_to_user_id IS NULL OR visible_to_user_id = :viewer`. 모드가 바뀌어도 이미 저장된 행의 가시성은 변하지 않는다.
- **AI 컨텍스트(D-037)**: `role='ASSISTANT' OR mode='AI'` 만 넣는다 — `HUMAN` 모드 USER 행은 영구 제외. `AI` 모드 행은 **양쪽 유저 것을 전부** 넣는다(가시성과 무관).
- V2 백필: 기존 USER 행은 `sender_user_id = 방 owner_id`, `mode='AI'`(V1 은 1인 방). ASSISTANT 는 둘 다 NULL 유지.
- V4 백필: `mode='AI'` USER 행 → `visible_to_user_id = sender_user_id`. ASSISTANT 행 → 직전 `AI` 모드 USER 행의 발신자(없으면 NULL). `HUMAN` USER 행 → NULL.
- 오디오 관련 컬럼 없음 — 원본을 저장하지 않는다(D-007).

## 6. ~~personas~~ — V3 에서 DROP (D-017)
- 어드민 페르소나 폐지. 시스템 프롬프트는 `chat_rooms.ai_personality`(프리셋) + `chat_rooms.ai_prompt`(개설자 편집)로 방 단위. V1 시드 행은 V3 에서 테이블과 함께 사라진다(운영 데이터 없음).

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
```

## 미결
- 이메일 중복 시 계정 연결 정책 (D-003 보완)
- `messages.content` 길이 상한(4,000자 요청 기준이면 TEXT로 충분, 응답은 MEDIUMTEXT 유지)
- ~~방 개수 상한(사용자당)~~ → 50개로 확정(2026-09-15)
- 방별 AI 장기 메모리(`ai_memory` 요약) — 백로그. 컨텍스트 윈도우 밖 과거 학습이 필요해지면 도입
