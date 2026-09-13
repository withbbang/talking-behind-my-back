# SCHEMA — DB 스키마

> **Write: 개발자 | Read: 전원**
> TL;DR: MySQL 8.4, utf8mb4. 테이블 7개. 초안 상태 — T-003에서 확정 후 `infra/mysql/init/01-schema.sql`과
> `apps/api/src/main/resources/db/migration/V1__init.sql`에 동일 반영. 이후 변경은 Flyway `V{n}__*.sql`만.

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

## 4. chat_rooms — 채팅방
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| user_id | BIGINT UNSIGNED | FK users, NOT NULL | |
| title | VARCHAR(100) | NOT NULL | 첫 메시지 30자 자동, 수정 가능 |
| message_count | INT UNSIGNED | NOT NULL DEFAULT 0 | 역정규화. 메시지 저장 시 +1 |
| last_message_at | DATETIME(3) | NULL | 목록 정렬 기준 |
| created_at, updated_at | DATETIME(3) | NOT NULL | |
| deleted_at | DATETIME(3) | NULL | |

- INDEX `(user_id, deleted_at, last_message_at DESC)`.

## 5. messages — 메시지
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | 커서 페이징 키 |
| room_id | BIGINT UNSIGNED | FK chat_rooms, NOT NULL | |
| role | VARCHAR(20) | NOT NULL | USER / ASSISTANT |
| content | MEDIUMTEXT | NOT NULL | |
| input_type | VARCHAR(20) | NULL | USER만: TEXT / VOICE |
| model | VARCHAR(100) | NULL | ASSISTANT만: OmniRoute가 실제 사용한 모델 |
| prompt_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| completion_tokens | INT UNSIGNED | NULL | ASSISTANT만 |
| created_at | DATETIME(3) | NOT NULL | |

- INDEX `(room_id, id)`. 삭제는 방 단위 soft delete로만(메시지 개별 삭제 없음).
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
users 1 ─ N chat_rooms 1 ─ N messages
users 1 ─ N daily_usage
personas (독립, 활성 1개)
```

## 미결
- 이메일 중복 시 계정 연결 정책 (D-003 보완)
- `messages.content` 길이 상한(4,000자 요청 기준이면 TEXT로 충분, 응답은 MEDIUMTEXT 유지)
- 방 개수 상한(사용자당) 필요 여부
