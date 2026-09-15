# API — 프론트↔백 계약

> **Write: 개발자 | Read: 전원**
> TL;DR: 모든 경로는 `/api` 접두. 인증은 HttpOnly 쿠키(access/refresh). 응답 JSON은 camelCase.
> 계약을 바꾸면 이 파일을 먼저 고치고 TASKS.md 해당 작업에 `API 변경` 표시. 기획자·QA는 acceptance를 갱신한다.

## 공통

- Base: `/api` (Spring context-path). 프론트는 상대 경로 `/api/...`만 사용.
- 인증: `access_token`(15m, Path `/`), `refresh_token`(30d, Path `/api/auth`) — HttpOnly, Secure, SameSite=Lax.
  refresh 쿠키 Path를 `/api/auth`로 둔 이유: `/auth/logout`도 refresh 쿠키를 받아 해당 family만 revoke하기 위해 (T-004).
  access 만료 시 401 `TOKEN_EXPIRED`, 쿠키 없음/변조 시 401 `UNAUTHENTICATED` — 프론트는 둘 다 refresh 시도.
- 시간: ISO-8601 UTC 문자열 (`2026-09-13T12:34:56Z`).
- ID: 숫자(BIGINT) → JSON number. 노출용 외부 ID가 필요하면 별도 결정.
- 페이징: 커서 기반 `?cursor=<opaque>&size=<n>` (기본 30, 최대 100 — 범위 밖은 clamp). 응답 `{ items, nextCursor }`, 마지막이면 `nextCursor: null`.
  커서는 **불투명 문자열**(서버가 준 `nextCursor` 를 그대로 되돌려준다). 방 목록은 `(lastMessageAt, id)` 키셋, 메시지는 `id` 키셋 — 프론트는 형식을 해석하지 않는다.
  변조/형식 오류 커서는 400 `VALIDATION_FAILED`.

### 에러 형식
```json
{ "code": "ROOM_NOT_FOUND", "message": "채팅방을 찾을 수 없습니다.", "details": null }
```
| HTTP | code 예시 | 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED`, `AUDIO_TOO_LONG`, `TEXT_TOO_LONG`, `MODE_NOT_ALLOWED`, `SELF_INVITE` | 입력 검증 실패 (`details`에 필드별 메시지), 혼자인 방 HUMAN 전환, 본인 방 코드로 입장 |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REUSED` | 인증 없음/만료/refresh 재사용 감지 |
| 403 | `FORBIDDEN`, `USER_SUSPENDED` | 권한 없음(참여자가 `aiPersonality` 변경 등), 정지 회원 |
| 404 | `ROOM_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `INVITE_NOT_FOUND` | 멤버 아닌 방도 404로 통일. 초대 코드 없음 |
| 409 | `ROOM_BUSY`, `ROOM_FULL`, `ROOM_LIMIT_EXCEEDED` | 같은 유저 대기 요청 존재, 방 정원(2명) 초과, 활성 방 50개 초과 |
| 410 | `ROOM_ORPHANED` | 개설자가 이탈한 방에 입장 시도 |
| 413 | `PAYLOAD_TOO_LARGE` | nginx `client_max_body_size` 초과 |
| 502 | `LLM_UPSTREAM_ERROR`, `SPEECH_UPSTREAM_ERROR` | 외부 API 실패 |
| 500 | `INTERNAL_ERROR` | 그 외 |

## auth

| Method | Path | 설명 |
|---|---|---|
| GET | `/oauth2/authorization/{provider}` | 로그인 시작. `provider` = `google` \| `naver` \| `kakao`. 브라우저 redirect. |
| GET | `/login/oauth2/code/{provider}` | 콜백(Spring 기본). 성공 시 쿠키 세팅 후 `APP_BASE_URL/`로 302. 실패 시 `APP_BASE_URL/login?error=<code>`. |
| GET | `/auth/me` | 현재 사용자. 401이면 프론트는 refresh 시도. 정지 회원도 200(`status: SUSPENDED`) — 그 외 모든 API는 403 `USER_SUSPENDED`. |
| POST | `/auth/refresh` | refresh 쿠키로 access/refresh 재발급(회전). 204 + 새 쿠키 2개. 실패 401(`UNAUTHENTICATED`/`TOKEN_EXPIRED`/`TOKEN_REUSED`) + 쿠키 2개 삭제. |
| POST | `/auth/logout` | 쿠키 삭제 + refresh family revoke. 204. 인증 불필요(access 만료 후에도 호출 가능). |

`GET /auth/me` 200:
```json
{ "id": 1, "nickname": "영선", "profileImageUrl": "https://...", "role": "USER", "status": "ACTIVE", "provider": "KAKAO" }
```
- `provider` = `GOOGLE` \| `NAVER` \| `KAKAO` (대문자, `social_accounts.provider` 그대로). `status` = `ACTIVE` \| `SUSPENDED`.
- `/login?error=<code>`: 공급자 OAuth2 에러 코드(`access_denied` 등, `[a-z0-9_]`만) 또는 `oauth_failed`(그 외 모든 실패), `authorization_request_not_found`(시작 없이 콜백 / 10분 초과).
- refresh 회전: 구 refresh 재사용 감지 시 같은 family 전체 revoke → 최신 토큰도 무효, 재로그인 필요.
- 같은 이메일로 다른 공급자 로그인 → **별도 계정**(inbox/to-ceo.md 결정 전 정책 (b)).

## rooms (T-006/T-016/T-017 — 2인 채팅방 요건, 2026-09-15)

| Method | Path | 설명 |
|---|---|---|
| GET | `/rooms?cursor&size` | 내가 활성 멤버인 방 목록(개설+참여, ORPHANED 포함), `lastMessageAt` 내림차순 |
| POST | `/rooms` | 방 생성. body 없음 또는 `{ "title"?: string }`. 201 Room. 개설자 OWNER 멤버십 + 초대 코드 발급. 활성 방 50개 초과 409 `ROOM_LIMIT_EXCEEDED` |
| GET | `/rooms/{id}` | 방 상세 + 멤버. 멤버 아니면 404. ORPHANED 도 200(`status` 로 구분) |
| PATCH | `/rooms/{id}` | `{ "title"?, "mode"?, "aiPersonality"? }` 부분 갱신. 200 Room. `title`·`aiPersonality` 는 **개설자만**(참여자 403). ORPHANED 방은 410 |
| DELETE | `/rooms/{id}` | **나가기**. 204. 개설자 → 방 `ORPHANED`(참여자 멤버십은 유지). 참여자 → 멤버십 종료, 방 `mode=AI` 복귀. ORPHANED 방에서 참여자 호출 = "이용할 수 없는 방" 확인 처리 |
| POST | `/rooms/{id}/invite/regenerate` | 초대 코드 재발급(개설자만, 구 코드 즉시 무효). 200 `{ inviteCode, inviteUrl }` |
| GET | `/rooms/join/{code}` | 입장 전 미리보기 `{ roomId, title, ownerNickname, memberCount }`. 이미 멤버면 그대로 200 |
| POST | `/rooms/join/{code}` | 입장. 200 Room. 재입장 허용 |

- PATCH 규칙: `title` 1~100자(공백만 → 400 `VALIDATION_FAILED`, `details.title`), **개설자만**(참여자 403 `FORBIDDEN`, 2026-09-15 결정).
  `mode` = `AI` \| `HUMAN`, 멤버 누구나 — 혼자인 방에서 `HUMAN` 은 400 `MODE_NOT_ALLOWED`.
  `aiPersonality` = `RATIONAL` \| `EMOTIONAL`, **개설자만**(참여자 403 `FORBIDDEN`), 대화 전후 언제든. 시스템 프롬프트 문구는 서버 enum 상수(어드민 편집 없음).
  **T-017 확정(2026-09-15)**: 세 필드 전부 없는 body(`{}`) → 400 `VALIDATION_FAILED`. 잘못된 enum 값/JSON 파싱 실패 → 400 `VALIDATION_FAILED`.
  한 요청은 전부-아니면-전무 — 판정 순서 404 멤버 → 400 검증 → **410 `ROOM_ORPHANED`(개설자 이탈 방은 어떤 PATCH 도 불가)** → 403 권한 → 400 `MODE_NOT_ALLOWED`.
  `mode` 판정은 방 행 잠금(`FOR UPDATE`) 뒤 활성 멤버 수로 — 참여자 나가기와 동시 실행돼도 혼자인 방이 `HUMAN` 으로 남지 않는다.
- 입장 실패: 코드 없음 404 `INVITE_NOT_FOUND`, 정원(2명) 초과 409 `ROOM_FULL`, 개설자 이탈 방 410 `ROOM_ORPHANED`, 본인 방 400 `SELF_INVITE`, 활성 방 50개 초과 409 `ROOM_LIMIT_EXCEEDED`.
  **판정 순서(T-016, 2026-09-15)**: 404 → 410 → 400 SELF → 이미 활성 멤버면 200 통과 → 409 FULL → 409 LIMIT(POST 만, 실제 입장 직전).
  개설자는 항상 활성 멤버라 SELF 를 "이미 멤버" 보다 먼저 본다. `GET /rooms/join/{code}` 미리보기도 LIMIT 을 뺀 같은 검증을 잠금 없이 수행한다(프론트가 버튼 전에 안내).
  코드 비교는 DB collation(대소문자 무시) 기준.
- 초대 URL = `APP_BASE_URL/join/{code}`. QR 은 프론트가 이 URL 로 생성(별도 API 없음).
- 참여자가 나가면 개설자 혼자 → `mode` 는 서버가 `AI` 로 되돌린다. 개설자가 나가면 방은 영구 ORPHANED(복구 없음).
- 방 개수 상한 50 = 개설 + 참여 합산, `left_at IS NULL` 기준.

Room:
```json
{
  "id": 10, "title": "오늘 뭐 먹지", "role": "OWNER", "status": "ACTIVE", "mode": "AI", "aiPersonality": "RATIONAL",
  "inviteCode": "K7Q2M9XW", "inviteUrl": "https://.../join/K7Q2M9XW",
  "members": [ { "userId": 1, "nickname": "영선", "role": "OWNER" }, { "userId": 2, "nickname": "철수", "role": "PARTICIPANT" } ],
  "messageCount": 12, "lastMessageAt": "2026-09-13T12:00:00Z", "createdAt": "..."
}
```
- `role` = 요청자의 역할 `OWNER` \| `PARTICIPANT`. `inviteCode`/`inviteUrl` 은 **개설자에게만** 내려간다(참여자는 `null`).
- 목록(`GET /rooms`) 항목은 `members: null`, `memberCount` 만 채운다(상세는 둘 다). 나머지 필드는 Room 과 동일.
- `POST /rooms` body 의 `title` 은 trim 후 비면 "새 대화", 100자 초과 400.

## messages

| Method | Path | 설명 |
|---|---|---|
| GET | `/rooms/{id}/messages?cursor&size` | 과거 메시지, `id` 내림차순(최신 먼저). 프론트가 역순 렌더. |
| POST | `/rooms/{id}/messages` | 메시지 전송. **T-007 재정의(2026-09-15)**: 202 + `{ messageId }`, 결과는 방 이벤트 스트림으로 수신. 아래 SSE 형식은 초안 — T-007 착수 시 확정. |
| GET | `/rooms/{id}/events` | 방 이벤트 SSE 구독(멤버만). `message`(유저 메시지) / `delta` / `done` / `error` / `mode` / `member`. T-007 에서 확정 |

POST body:
```json
{ "content": "안녕", "inputType": "TEXT" }
```
`inputType` = `TEXT` \| `VOICE`. 상한 4,000자.

응답 `text/event-stream` (D-008):
```
event: user
data: {"messageId": 101, "createdAt": "..."}

event: delta
data: {"text": "안녕하"}

event: delta
data: {"text": "세요!"}

event: done
data: {"messageId": 102, "promptTokens": 320, "completionTokens": 18, "model": "chat-default"}
```
실패 시:
```
event: error
data: {"code": "LLM_UPSTREAM_ERROR", "message": "..."}
```
- 첫 이벤트 `user`는 USER 메시지 저장 확인(프론트 낙관적 렌더의 id 치환용).
- ~~동일 방에 진행 중 요청 존재 → 409~~ → **방 단위 직렬 큐**(2026-09-15 결정, D-008 보완): USER 메시지는 즉시 저장·브로드캐스트, AI 응답은 방당 순차 처리. 같은 유저의 대기 요청이 이미 있으면 409 `ROOM_BUSY`.
- `HUMAN` 모드에서는 AI 응답 없음(저장 + `message` 브로드캐스트만).
- AI 컨텍스트 = 어드민 기본 페르소나 + 방 `aiPersonality` 문구 + 개설자 4 : 참여자 1 가중 지시 + 최근 N개(발신자 라벨 `[개설자 닉]`/`[참여자 닉]`, HUMAN 모드 대화 포함).
- 클라이언트 중단 시 서버는 OmniRoute 스트림을 취소하고 ASSISTANT 메시지를 저장하지 않는다(D-008 open, 확정 시 갱신).

Message:
```json
{ "id": 102, "role": "ASSISTANT", "senderUserId": null, "content": "안녕하세요!", "inputType": null, "mode": "AI", "createdAt": "..." }
```
`role` = `USER` \| `ASSISTANT`. `inputType`·`senderUserId` 는 USER 메시지에만. `mode` = 발신 당시 방 모드.

## speech

| Method | Path | 설명 |
|---|---|---|
| POST | `/speech/stt` | multipart `audio` (webm/opus, mp4/aac, wav). 최대 25MB, 60초. |
| POST | `/speech/tts` | `{ "text": string, "voice"?: string }` → `audio/mpeg`. `text` 최대 1,000자. |

STT 200:
```json
{ "text": "오늘 날씨 어때", "durationMs": 2400, "provider": "openai" }
```
TTS 200: `Content-Type: audio/mpeg`, 본문은 오디오 바이트. 캐시 헤더 `Cache-Control: private, max-age=3600`.

프론트 보이스 모드는 `/speech/stt` → `POST /rooms/{id}/messages`(`inputType: "VOICE"`) → `done` 후 `/speech/tts`(assistant content) 순서로 호출한다. 별도 복합 엔드포인트는 두지 않는다.

## admin (ROLE_ADMIN)

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/stats` | `{ users, rooms, messages, tokensToday, tokens30d }` |
| GET | `/admin/users?cursor&size&q` | 회원 목록 (닉네임/이메일 검색) |
| PATCH | `/admin/users/{id}` | `{ "status": "ACTIVE" \| "SUSPENDED" }` |
| GET | `/admin/rooms?userId&cursor&size` | 방 목록 |
| GET | `/admin/rooms/{id}/messages?cursor&size` | 메시지 조회 |
| GET | `/admin/personas` | 페르소나 목록 |
| POST | `/admin/personas` | `{ name, systemPrompt }` |
| PUT | `/admin/personas/{id}` | `{ name, systemPrompt }` |
| POST | `/admin/personas/{id}/activate` | 활성화 (기존 활성 해제). 활성은 항상 정확히 1개. |
| DELETE | `/admin/personas/{id}` | 활성 페르소나는 삭제 불가 409 |

## 변경 이력
- 2026-09-13 초안 (T-000)
- 2026-09-14 T-004: refresh 쿠키 Path `/api/auth`, `/auth/me`에 `status` 추가·`provider` 대문자, refresh 실패 시 쿠키 삭제, logout 인증 불필요, `?error=` 코드 명시. **API 변경 — T-005 acceptance 확인 필요.**
- 2026-09-15 T-006 착수: **2인 채팅방 요건** 반영 — rooms 전면 개정(멤버십·초대·나가기·mode·aiPersonality), 커서 불투명 문자열, 에러코드 6개 추가, messages 에 `senderUserId`/`mode`, POST messages 202 + `/rooms/{id}/events` 초안. **API 변경 — T-007/T-008 acceptance 재작성(TASKS.md), PLAN.md M2 갱신 필요(기획자).**
- 2026-09-15 T-006 구현: PATCH `title` 은 개설자만(참여자 403), 잘못된 커서 400, 목록 항목 `members: null`. **API 변경(권한) — T-008 acceptance 에 반영 필요.**
- 2026-09-15 T-017 구현: PATCH `mode`/`aiPersonality` 활성화, 빈 body·잘못된 enum 400, ORPHANED 방 PATCH 410, 참여자 나가기 시 `mode=AI` 복귀. **API 변경 — T-008/T-018 acceptance 에 반영 필요.**
