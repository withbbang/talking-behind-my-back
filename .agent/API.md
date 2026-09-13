# API — 프론트↔백 계약

> **Write: 개발자 | Read: 전원**
> TL;DR: 모든 경로는 `/api` 접두. 인증은 HttpOnly 쿠키(access/refresh). 응답 JSON은 camelCase.
> 계약을 바꾸면 이 파일을 먼저 고치고 TASKS.md 해당 작업에 `API 변경` 표시. 기획자·QA는 acceptance를 갱신한다.

## 공통

- Base: `/api` (Spring context-path). 프론트는 상대 경로 `/api/...`만 사용.
- 인증: `access_token`(15m), `refresh_token`(30d) — HttpOnly, Secure, SameSite=Lax. `refresh_token` 쿠키 Path는 `/api/auth/refresh`.
- 시간: ISO-8601 UTC 문자열 (`2026-09-13T12:34:56Z`).
- ID: 숫자(BIGINT) → JSON number. 노출용 외부 ID가 필요하면 별도 결정.
- 페이징: 커서 기반 `?cursor=<id>&size=<n>` (기본 30, 최대 100). 응답 `{ items, nextCursor }`, 마지막이면 `nextCursor: null`.

### 에러 형식
```json
{ "code": "ROOM_NOT_FOUND", "message": "채팅방을 찾을 수 없습니다.", "details": null }
```
| HTTP | code 예시 | 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED`, `AUDIO_TOO_LONG`, `TEXT_TOO_LONG` | 입력 검증 실패 (`details`에 필드별 메시지) |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REUSED` | 인증 없음/만료/refresh 재사용 감지 |
| 403 | `FORBIDDEN`, `USER_SUSPENDED` | 권한 없음, 정지 회원 |
| 404 | `ROOM_NOT_FOUND`, `MESSAGE_NOT_FOUND` | 타인 소유 리소스도 404로 통일 |
| 409 | `ROOM_BUSY` | 방에 진행 중 요청 존재 |
| 413 | `PAYLOAD_TOO_LARGE` | nginx `client_max_body_size` 초과 |
| 502 | `LLM_UPSTREAM_ERROR`, `SPEECH_UPSTREAM_ERROR` | 외부 API 실패 |
| 500 | `INTERNAL_ERROR` | 그 외 |

## auth

| Method | Path | 설명 |
|---|---|---|
| GET | `/oauth2/authorization/{provider}` | 로그인 시작. `provider` = `google` \| `naver` \| `kakao`. 브라우저 redirect. |
| GET | `/login/oauth2/code/{provider}` | 콜백(Spring 기본). 성공 시 쿠키 세팅 후 `APP_BASE_URL/`로 302. 실패 시 `/login?error=<code>`. |
| GET | `/auth/me` | 현재 사용자. 401이면 프론트는 refresh 시도. |
| POST | `/auth/refresh` | refresh 쿠키로 access/refresh 재발급(회전). 실패 401. |
| POST | `/auth/logout` | 쿠키 삭제 + refresh revoke. 204. |

`GET /auth/me` 200:
```json
{ "id": 1, "nickname": "영선", "profileImageUrl": "https://...", "role": "USER", "provider": "kakao" }
```

## rooms

| Method | Path | 설명 |
|---|---|---|
| GET | `/rooms?cursor&size` | 내 방 목록, `lastMessageAt` 내림차순 |
| POST | `/rooms` | 방 생성(draft → 실제). body 없음 또는 `{ "title"?: string }` |
| GET | `/rooms/{id}` | 방 상세 |
| PATCH | `/rooms/{id}` | `{ "title": string }` |
| DELETE | `/rooms/{id}` | soft delete. 204 |

Room:
```json
{ "id": 10, "title": "오늘 뭐 먹지", "messageCount": 12, "lastMessageAt": "2026-09-13T12:00:00Z", "createdAt": "..." }
```

## messages

| Method | Path | 설명 |
|---|---|---|
| GET | `/rooms/{id}/messages?cursor&size` | 과거 메시지, `id` 내림차순(최신 먼저). 프론트가 역순 렌더. |
| POST | `/rooms/{id}/messages` | 메시지 전송 + 응답 스트림. `Accept: text/event-stream`. |

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
- 동일 방에 진행 중 요청 존재 → 스트림 시작 전 HTTP 409 `ROOM_BUSY`.
- 클라이언트 중단 시 서버는 OmniRoute 스트림을 취소하고 ASSISTANT 메시지를 저장하지 않는다(D-008 open, 확정 시 갱신).

Message:
```json
{ "id": 102, "role": "ASSISTANT", "content": "안녕하세요!", "inputType": null, "createdAt": "..." }
```
`role` = `USER` \| `ASSISTANT`. `inputType`은 USER 메시지에만.

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
