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
| 403 | `FORBIDDEN`, `USER_SUSPENDED` | 권한 없음(참여자가 `title`/`aiPersonality`/`aiPrompt` 변경 등), 정지 회원 |
| 404 | `ROOM_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `INVITE_NOT_FOUND` | 멤버 아닌 방도 404로 통일. 초대 코드 없음 |
| 409 | `ROOM_BUSY`, `ROOM_FULL`, `ROOM_LIMIT_EXCEEDED` | 같은 유저의 AI 잡 진행·대기 중, 방 정원(2명) 초과, 활성 방 50개 초과 |
| 410 | `ROOM_ORPHANED` | 개설자가 이탈한 방에 입장 시도 |
| 413 | `PAYLOAD_TOO_LARGE` | nginx `client_max_body_size` 초과 |
| 502 | `LLM_UPSTREAM_ERROR`, `SPEECH_UPSTREAM_ERROR` | 외부 API 실패 |
| 503 | `AI_BUSY` | AI 잡 스레드풀 포화(T-007) |
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
| PATCH | `/rooms/{id}` | `{ "title"?, "mode"?, "aiPersonality"?, "aiPrompt"? }` 부분 갱신. 200 Room. `title`·`aiPersonality`·`aiPrompt` 는 **개설자만**(참여자 403). ORPHANED 방은 410 |
| DELETE | `/rooms/{id}` | **나가기**. 204. 개설자 → 방 `ORPHANED`(참여자 멤버십은 유지). 참여자 → 멤버십 종료, 방 `mode=AI` 복귀. ORPHANED 방에서 참여자 호출 = "이용할 수 없는 방" 확인 처리 |
| POST | `/rooms/{id}/invite/regenerate` | 초대 코드 재발급(개설자만, 구 코드 즉시 무효). 200 `{ inviteCode, inviteUrl }` |
| GET | `/rooms/join/{code}` | 입장 전 미리보기 `{ roomId, title, ownerNickname, memberCount }`. 이미 멤버면 그대로 200 |
| POST | `/rooms/join/{code}` | 입장. 200 Room. 재입장 허용 |

- PATCH 규칙: `title` 1~100자(공백만 → 400 `VALIDATION_FAILED`, `details.title`), **개설자만**(참여자 403 `FORBIDDEN`, 2026-09-15 결정).
  `mode` = `AI` \| `HUMAN`, 멤버 누구나 — 혼자인 방에서 `HUMAN` 은 400 `MODE_NOT_ALLOWED`.
  `aiPersonality` = `RATIONAL` \| `EMOTIONAL` 프리셋, **개설자만**(참여자 403 `FORBIDDEN`), 대화 전후 언제든 재선택. 프리셋 문구는 서버 enum 상수. **프리셋을 고르면 `aiPrompt` 는 null 로 초기화**(T-019, D-017).
  `aiPrompt` = 개설자가 직접 쓰는 시스템 프롬프트(T-019). **개설자만**. trim 후 1~2,000자, 초과 400 `VALIDATION_FAILED`(`details.aiPrompt`). `""`(빈 문자열/공백) 은 **초기화**(프리셋으로 복귀), JSON 에서 필드를 빼면 변경 없음.
  `aiPersonality` 와 `aiPrompt` 를 한 요청에 함께 보내면 프리셋 변경 → `aiPrompt` 적용 순서(결과는 커스텀).
  **T-017 확정(2026-09-15)**: 네 필드 전부 없는 body(`{}`) → 400 `VALIDATION_FAILED`. 잘못된 enum 값/JSON 파싱 실패 → 400 `VALIDATION_FAILED`.
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
  "aiPrompt": null, "effectiveAiPrompt": "너는 논리적이고 차분한 대화 상대다. ...",
  "inviteCode": "K7Q2M9XW", "inviteUrl": "https://.../join/K7Q2M9XW",
  "members": [ { "userId": 1, "nickname": "영선", "role": "OWNER" }, { "userId": 2, "nickname": "철수", "role": "PARTICIPANT" } ],
  "messageCount": 12, "lastMessageAt": "2026-09-13T12:00:00Z", "createdAt": "..."
}
```
- `role` = 요청자의 역할 `OWNER` \| `PARTICIPANT`. `inviteCode`/`inviteUrl` 은 **개설자에게만** 내려간다(참여자는 `null`).
- `aiPrompt` = 개설자가 쓴 커스텀 프롬프트(없으면 `null`), `effectiveAiPrompt` = 실제 AI 에 적용되는 문구(`aiPrompt` ?? 프리셋 문구). 멤버 전원에게 내려간다(편집은 개설자만). 목록 항목도 동일.
- 목록(`GET /rooms`) 항목은 `members: null`, `memberCount` 만 채운다(상세는 둘 다). 나머지 필드는 Room 과 동일.
- `POST /rooms` body 의 `title` 은 trim 후 비면 "새 대화", 100자 초과 400.

## messages

| Method | Path | 설명 |
|---|---|---|
| GET | `/rooms/{id}/messages?cursor&size` | 과거 메시지, `id` 내림차순(최신 먼저). 프론트가 역순 렌더. 멤버만(비멤버 404). |
| POST | `/rooms/{id}/messages` | 메시지 전송. **202** + `{ "messageId": 101 }`. 결과는 방 이벤트 스트림으로 수신 (D-018). |
| GET | `/rooms/{id}/events` | 방 이벤트 SSE 구독(멤버만, 비멤버 404). `text/event-stream`, 타임아웃 없음, 20초마다 `: ping` 주석 (D-019). |

POST body:
```json
{ "content": "안녕", "inputType": "TEXT" }
```
`inputType` = `TEXT` \| `VOICE`(생략 시 TEXT). `content` 공백 불가, 상한 4,000자(400 `details.content`).

POST 판정 순서: 400 검증(바인딩) → 401 → 404(비멤버·나간 멤버) → 410 `ROOM_ORPHANED` → (AI 모드) 409 `ROOM_BUSY` / 503 `AI_BUSY`.
- USER 메시지는 요청 안에서 저장·커밋되고 `message` 이벤트로 브로드캐스트된다. `HUMAN` 모드면 여기서 끝(AI 응답 없음).
- `AI` 모드면 방당 직렬 큐에 잡을 넣는다. 같은 유저의 잡이 진행·대기 중이면 409(저장 전에 판정 — 중복 저장 없음). 풀 포화면 503(그 방에 이미 도는 잡이 있으면 다른 유저의 대기는 허용).
- 제목이 아직 "새 대화"이고 방의 첫 메시지면 앞 30자로 자동 제목(`ChatRoom.autoTitle`).
- `daily_usage`: 전송 시 발신자 `message_count +1`, AI 완료 시 트리거 메시지 발신자에게 토큰 귀속.

`GET /rooms/{id}/events` 이벤트 (T-007 확정, D-019):
```
event: message                      # USER 메시지 저장 직후 (양쪽 멤버 모두 받음 — 낙관적 렌더 치환용)
data: {"id":101,"role":"USER","senderUserId":7,"content":"안녕","inputType":"TEXT","mode":"AI","createdAt":"..."}

event: delta                        # AI 응답 조각. replyTo = 트리거 USER 메시지 id
data: {"replyTo":101,"text":"안녕하"}

event: done                         # AI 응답 저장 완료. message 는 ASSISTANT Message
data: {"replyTo":101,"message":{"id":102,"role":"ASSISTANT","senderUserId":null,"content":"안녕하세요!","inputType":null,"mode":null,"createdAt":"..."},"promptTokens":320,"completionTokens":18}

event: error                        # OmniRoute 실패/타임아웃/빈 응답 — ASSISTANT 미저장, 부분 델타 폐기
data: {"replyTo":101,"code":"LLM_UPSTREAM_ERROR","message":"AI 응답에 실패했습니다."}

event: mode                         # PATCH mode / 참여자 나가기로 AI 복귀
data: {"mode":"HUMAN"}

event: member                       # 입장·나가기. roomStatus 는 이벤트 시점 방 상태(개설자 나가기 → ORPHANED)
data: {"action":"JOINED","userId":8,"nickname":"영희","role":"PARTICIPANT","roomStatus":"ACTIVE"}

: ping                              # 20초 하트비트 (EventSource 는 무시)
```
- 구독자가 0명이어도 잡은 완주·저장한다(D-018). 재연결 시 놓친 이벤트는 `GET /rooms/{id}/messages` 로 보충(프론트 T-008).
- 잡 시작 시점에 방이 `HUMAN` 이면 건너뛴다(이벤트 없음). 이미 스트리밍 중인 잡은 완주.
- 한 방에 잡이 2건까지 쌓일 수 있다(개설자·참여자 각 1건). 직렬이라 델타는 섞이지 않지만 프론트는 `replyTo` 로 구분한다.
- AI 컨텍스트 = `effectiveAiPrompt`(D-017) + 가중 지시(참여자가 있던 방만, D-019 문구) + 최근 N(`LLM_CONTEXT_MAX_MESSAGES`, 기본 30)개 시간순. USER 는 `[개설자 닉]`/`[참여자 닉]` 라벨(나간 멤버 포함, HUMAN 모드 대화 포함), ASSISTANT 는 `assistant` 역할.
- 인스턴스 1대 in-memory 버스. 수평 확장 시 Redis pub/sub 로 교체.

Message:
```json
{ "id": 102, "role": "ASSISTANT", "senderUserId": null, "content": "안녕하세요!", "inputType": null, "mode": null, "createdAt": "..." }
```
`role` = `USER` \| `ASSISTANT`. `inputType`·`senderUserId`·`mode` 는 USER 메시지에만(ASSISTANT 는 null). `mode` = 발신 당시 방 모드.

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

- ~~`/admin/personas` 5개~~ → D-017(2026-09-16) 폐기. 시스템 프롬프트는 방 단위(`PATCH /rooms/{id}` `aiPersonality`/`aiPrompt`).

## 변경 이력
- 2026-09-13 초안 (T-000)
- 2026-09-14 T-004: refresh 쿠키 Path `/api/auth`, `/auth/me`에 `status` 추가·`provider` 대문자, refresh 실패 시 쿠키 삭제, logout 인증 불필요, `?error=` 코드 명시. **API 변경 — T-005 acceptance 확인 필요.**
- 2026-09-15 T-006 착수: **2인 채팅방 요건** 반영 — rooms 전면 개정(멤버십·초대·나가기·mode·aiPersonality), 커서 불투명 문자열, 에러코드 6개 추가, messages 에 `senderUserId`/`mode`, POST messages 202 + `/rooms/{id}/events` 초안. **API 변경 — T-007/T-008 acceptance 재작성(TASKS.md), PLAN.md M2 갱신 필요(기획자).**
- 2026-09-15 T-006 구현: PATCH `title` 은 개설자만(참여자 403), 잘못된 커서 400, 목록 항목 `members: null`. **API 변경(권한) — T-008 acceptance 에 반영 필요.**
- 2026-09-15 T-017 구현: PATCH `mode`/`aiPersonality` 활성화, 빈 body·잘못된 enum 400, ORPHANED 방 PATCH 410, 참여자 나가기 시 `mode=AI` 복귀. **API 변경 — T-008/T-018 acceptance 에 반영 필요.**
- 2026-09-16 T-019(D-017): 어드민 페르소나 폐기 — `/admin/personas` 삭제, `PATCH /rooms/{id}` 에 `aiPrompt`, Room 에 `aiPrompt`/`effectiveAiPrompt`. 프리셋 재선택 시 `aiPrompt` 초기화. **API 변경 — T-008(성격/프롬프트 편집 UI)·T-011(어드민 persona 화면 제거) acceptance 반영 필요.**
- 2026-09-16 T-007 구현: **messages 확정** — POST 202 `{messageId}`, `/rooms/{id}/events` 이벤트 6종 + `: ping`, `delta`/`done`/`error` 에 `replyTo`, 503 `AI_BUSY` 추가, 비멤버 404·ORPHANED 410. `mode`/`member` 이벤트는 rooms PATCH/leave/join 에서 발행. **API 변경 — T-008 `lib/sse.ts` 리듀서·acceptance 에 반영 필요.**
