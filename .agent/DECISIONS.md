# DECISIONS — 결정 로그

> **Write: CEO | Read: 전원**
> TL;DR: 우선순위·범위·기술 갈림길에 대한 결정을 D-번호로 기록. 개발/디자인은 이 결정을 따른다.
> 되돌린 결정은 SUPERSEDED로 표시하고 사유 명시. 결정이 필요하면 inbox/to-ceo.md에 남긴다.

## 형식
- decision / rationale / alternatives(기각 사유) / impact(영향 받는 파일·작업) / date

## 결정 로그

### D-001 단일 모노레포
- decision: `apps/web` + `apps/api` + `infra/` + `.agent/`를 **레포 하나**에 둔다. umbrella + front/back 서브모듈 구조는 채택하지 않는다.
- rationale: 1인 개발. API 계약 변경이 PR 하나로 끝나야 한다. 서브모듈은 자식 커밋 + 부모 포인터 bump로 작업이 3배가 되고, CI에서 서브모듈 checkout용 PAT가 추가로 필요하다.
- alternatives: umbrella(.agent + infra) + front/back 별도 레포 — 담당자가 나뉘거나 back을 다른 앱에서 재사용할 때만 이득. 나중에 분리해야 하면 `git subtree split -P apps/api`로 히스토리째 떼어낸다.
- impact: 루트 README.md, deploy.yml `paths:` 필터
- date: 2026-09-13

### D-002 TLS는 DSM 리버스 프록시, compose 내부 nginx는 HTTP 8080
- decision: 인증서·443은 DSM 리버스 프록시가 담당. compose의 nginx는 `8080:80`으로 HTTP만 받고 web/api로 라우팅한다.
- rationale: n8n 배포 때 검증된 방식. 인증서 갱신을 DSM에 맡기면 compose에 certbot이 안 들어온다.
- impact: `infra/nginx/default.conf`의 `X-Forwarded-Proto https` 고정, DSM에 `chat.도메인 → localhost:8080` 등록
- date: 2026-09-13

### D-003 인증 — 소셜 로그인만, JWT + HttpOnly 쿠키, refresh는 DB 저장
- decision: Spring Security OAuth2 Client로 구글/네이버/카카오 로그인. access 토큰 15분, refresh 토큰 30일. 둘 다 HttpOnly·Secure·SameSite=Lax 쿠키. refresh 토큰은 해시로 DB(`refresh_tokens`)에 저장하고 회전(rotation)한다. Redis 없음.
- rationale: "앱 껐다 켜도 로그인 유지" 요건 = 장기 refresh 쿠키. localStorage 토큰은 PWA/XSS 관점에서 배제. Homepage 프로젝트와 같은 패턴이라 재사용 가능.
- alternatives: Spring Session + JDBC — 세션 테이블 관리가 늘고 SSE 장기 연결과 궁합이 나쁨. 기각.
- impact: `auth/*`, `global/security/*`, SCHEMA.md `users`/`social_accounts`/`refresh_tokens`, API.md `/auth/*`
- open: iOS 홈화면 PWA에서 OAuth redirect가 Safari로 빠지는 문제 — T-013에서 실기기 검증 후 필요 시 결정 추가.
- date: 2026-09-13

### D-004 API는 context-path `/api`, 프론트는 같은 오리진만 호출
- decision: Spring `server.servlet.context-path=/api`. nginx는 `/api/`를 rewrite 없이 api로 전달. 프론트는 `/api/...` 상대 경로만 사용. CORS 설정 없음.
- rationale: HttpOnly 쿠키가 같은 오리진에서만 자동 전송된다. OAuth redirect URI도 `https://도메인/api/login/oauth2/code/{provider}`로 고정된다.
- impact: `infra/nginx/default.conf`, `infra/nginx/dev.conf`
- date: 2026-09-13
- 보완(2026-09-13, T-001): **Next `rewrites` 로 `/api` 를 프록시하지 않는다.** Homepage X21 — rewrite 경유 text/event-stream 이
  0바이트로 도착해 SSE 가 깨진다. 로컬도 운영과 같은 경로: `docker-compose.dev.yml` 의 nginx(:3000) →
  `next dev`(:3001) / api(:8080). 브라우저는 항상 `localhost:3000`.

### D-005 어드민은 별도 앱이 아닌 `(admin)` route group
- decision: `apps/web/app/(admin)/admin/**`에 둔다. 접근 제한은 (1) `middleware.ts` ROLE_ADMIN 체크 + (2) nginx `/admin`, `/api/admin/` IP allow(옵션).
- rationale: 배포 단위가 하나. NAS 빌드 부담 최소. 필요하면 디렉토리째 분리 가능.
- alternatives: `apps/admin` 별도 Next.js — 이미지 하나 더, CI 시간 2배. 기각.
- impact: `middleware.ts`, `infra/nginx/default.conf` 주석 블록, PWA 서비스워커에서 `/admin` 캐시 제외
- date: 2026-09-13

### D-006 LLM은 OmniRoute `/v1` 경유, 컨텍스트는 시스템 프롬프트 + 최근 N개
- decision: api → `http://omniroute:20128/v1/chat/completions` (`stream=true`). 모델은 OmniRoute의 alias(`LLM_MODEL`)로 지정해 공급자 교체를 앱 코드 밖으로 뺀다. LLM에 보내는 메시지는 활성 페르소나 시스템 프롬프트 + 해당 방의 최근 `LLM_CONTEXT_MAX_MESSAGES`(기본 30)개.
- rationale: "세션 내용 전체 질의"를 무제한으로 하면 토큰·비용이 방 길이에 비례해 늘어난다. 공급자 폴백·사용량 추적은 OmniRoute 대시보드가 이미 하므로 어드민에 재구현하지 않는다.
- impact: `llm/OmniRouteClient`, `message/ChatService`, `.env` `LLM_*`
- open: 토큰 기준 윈도우(문자 수 추정)로 바꿀지는 실사용 후 결정.
- date: 2026-09-13

### D-007 STT/TTS는 서버 API 방식, Provider 인터페이스로 교체 가능하게
- decision: 브라우저 Web Speech API를 쓰지 않는다. `SttProvider`/`TtsProvider` 인터페이스 + `openai`/`clova` 구현체, `STT_PROVIDER`/`TTS_PROVIDER` 환경변수로 선택. 오디오는 `/tmp/audio`(tmpfs)에서 처리 후 즉시 삭제. 기능 3(메시지별 듣기/말하기 버튼)과 기능 4(보이스 모드 루프)는 같은 API를 쓰고 UI만 다르다. 음성 입력 메시지는 `input_type=VOICE`.
- rationale: 브라우저 API는 iOS Safari 지원이 불안정하고 음성 품질이 OS에 묶인다. 서버 방식은 비용이 들지만 일관된 품질과 한국어 정확도를 확보한다.
- alternatives: Web Speech API(무료) — 기각. OmniRoute `/v1/audio/*` 경유 — 지원 여부 미확인, 확인되면 별도 결정.
- impact: `speech/*`, API.md `/speech/*`, nginx `client_max_body_size 25m`, compose tmpfs
- open: 녹음 길이 상한(초), 하루 호출 상한 — 비용 확인 후 결정.
- date: 2026-09-13

### D-008 채팅 응답은 SSE 스트리밍, 완료 후 저장, 방당 동시 1건
- decision: `POST /api/rooms/{id}/messages`가 `text/event-stream`을 반환. 이벤트: `delta`(텍스트 조각) → `done`(messageId, 토큰) 또는 `error`. USER 메시지는 요청 즉시 저장, ASSISTANT 메시지는 스트림 완료 시 저장. 같은 방에 진행 중 요청이 있으면 409. WebSocket 미사용.
- rationale: 심심이 같은 즉답 체감은 스트리밍이어야 나온다. SSE는 nginx `proxy_buffering off`만으로 되고 재연결 로직이 단순하다.
- impact: `message/ChatController`, `lib/sse.ts`, nginx `/api/` 블록
- open: 스트림 중단(클라이언트 이탈) 시 부분 응답 저장 여부 — 기본은 저장 안 함, T-007에서 확정.
- date: 2026-09-13

### D-009 배포 — GHCR 이미지 + scp infra + ssh compose, DB는 bind mount, 스키마는 Flyway
- decision: `master` push → GH Actions가 web/api 이미지를 GHCR에 푸시 → `infra/`를 NAS에 scp → ssh로 `compose pull && up -d`. MySQL 데이터는 `${DATA_DIR}/mysql` bind mount(Hyper Backup 대상). **스키마는 Flyway 가 단독 소유** — `V1__init.sql` 부터 모든 DDL. `mysql/init/01-schema.sql` 은 DB 레벨 설정만(테이블 생성 금지 — 같은 DDL 이 두 곳에 있으면 Flyway V1 이 "table exists" 로 실패한다).
- 보완(2026-09-13, T-003): 원안은 init SQL + Flyway 병행이었으나 위 충돌 때문에 Flyway 단독으로 확정.
- rationale: NAS에 git을 두지 않아도 되고 `.env`는 gitignore라 덮어써지지 않는다. Homepage에서 Flyway로 스키마 소유권을 정리한 경험을 그대로 적용.
- alternatives: watchtower pull 방식 — 배포 시점 제어가 안 됨. 기각.
- impact: `.github/workflows/deploy.yml`, `infra/docker-compose.yml`
- open: NAS CPU 아키텍처(x86 vs ARM) 확인 후 `platforms:` 조정.
- date: 2026-09-13

### D-010 첫 방은 draft — 첫 메시지 전송 시 서버에 생성
- decision: 로그인 후 `/`로 오면 서버에 방을 만들지 않고 클라이언트 draft 상태. 첫 메시지 전송 시 `POST /api/rooms` → 방 생성 → 그 id로 메시지 전송 → 사이드바 목록 +1. 방 제목은 첫 USER 메시지 앞 30자로 자동 생성, 이후 수정 가능.
- rationale: 요건 "신규 채팅방 자동 이동 → 대화 시작 시 히스토리 +1"의 자연스러운 구현. 빈 방이 DB에 쌓이지 않는다.
- impact: `(chat)/page.tsx`, `features/rooms`, API.md `POST /rooms`
- date: 2026-09-13

### D-011 프로젝트 이름 확정 — 표시명 "김영선 욕하는 앱", 슬러그 `talking-behind-my-back`
- decision: 사용자 노출 이름은 **김영선 욕하는 앱**(manifest name, `<title>`, 로그인 화면). 기술 슬러그는 GitHub 레포명과 동일한 **`talking-behind-my-back`**(compose `APP_NAME`, GHCR 이미지 접두어, `DATA_DIR`, package.json/settings.gradle 이름). 레포: https://github.com/withbbang/talking-behind-my-back
- 유지: DB 이름 `chat_app`(로컬에 이미 V1 적용, 이름 바꿀 이유 없음), Java 패키지 `com.example.chat`(바꾸면 전체 import 수정 — T-004 이전에 바꿀지는 Claude Code 에서 결정), 로컬 디렉토리명 `chat-app`(선택).
- rationale: 표시명은 한글·공백이라 식별자로 못 쓴다. 레포명을 슬러그로 쓰면 GHCR/NAS/compose 에서 한 이름으로 추적된다.
- impact: `infra/.env.example`, `docker-compose.yml`, `apps/web/package.json`, `apps/web/app/{manifest.ts,layout.tsx}`, `apps/api/settings.gradle`. GitHub Variables `APP_NAME=talking-behind-my-back`.
- date: 2026-09-13

### D-012 refresh 쿠키 Path는 `/api/auth` (D-003 보완)
- decision: `refresh_token` 쿠키 Path를 `/api/auth`로 둔다(API.md 초안 `/api/auth/refresh`에서 변경). `POST /auth/logout`이 refresh 쿠키를 받아 **해당 family만** revoke한다.
- rationale: Path가 `/api/auth/refresh`면 logout에 refresh 쿠키가 안 실려 "refresh revoke"가 불가능하다. `/api/auth` 아래는 `me/refresh/logout` 뿐이라 노출 범위 증가는 무시할 수준.
- alternatives: Path 유지 + logout은 `user_id` 기준 전체 revoke — 모든 기기가 같이 로그아웃되어 기각.
- impact: `auth/AuthCookies`, API.md#공통, T-005 프론트 로그아웃 호출
- date: 2026-09-14

### D-013 OAuth2 authorization request는 서명 쿠키에 보관 (D-003 보완)
- decision: Spring 기본 `HttpSessionOAuth2AuthorizationRequestRepository` 대신 필요한 필드(state, registrationId, redirectUri, scopes, attributes, additionalParameters)만 JWT(HS256, audience=`oauth2-request`, 10분)로 서명해 쿠키 `oauth2_auth_request`(HttpOnly, SameSite=Lax, Path `/api`)에 담는다.
- rationale: STATELESS 정책과 세션 저장소가 충돌한다. 서명 토큰이라 변조는 검증에서 걸리고, audience 분리로 access 토큰과 상호 대체가 안 된다.
- alternatives: Java 직렬화 + Base64 쿠키 — 쿠키는 신뢰 못 할 입력이라 역직렬화 취약점. 기각.
- impact: `auth/oauth2/CookieOAuth2AuthorizationRequestRepository`, `SecurityConfig`
- date: 2026-09-14

### D-014 정지·권한 판정은 매 요청 DB 조회
- decision: `JwtAuthFilter`가 access 토큰의 userId로 `users`를 매 요청 1회 조회해 role/status를 DB 값으로 세운다. 정지 회원은 `/auth/me`만 200, 그 외 403 `USER_SUSPENDED`.
- rationale: 어드민 정지가 즉시 반영돼야 한다. 탈퇴(soft delete) 사용자도 같은 조회로 걸러진다. 1인 NAS 규모에서 PK 조회 1회는 비용 아님.
- alternatives: JWT claim(role/status) — DB 무접촉이지만 최대 15분(access ttl) 지연. 기각.
- impact: `auth/JwtAuthFilter`, `auth/AuthPrincipal`, T-011 어드민 정지 기능
- date: 2026-09-14

### D-015 같은 이메일 다른 공급자 = 별도 계정 (D-003 보완)
- decision: 카카오로 가입한 사용자가 같은 이메일로 구글 로그인하면 **별도 계정**을 만든다. 계정 식별은 `(provider, provider_user_id)`만. 이메일은 `social_accounts.email`에 참고용으로만 저장.
- rationale: v1 단순화. 공급자마다 이메일 제공·검증 여부가 달라 이메일 기반 자동 연결은 계정 탈취 표면이 된다.
- alternatives: (a) 기존 계정 연결 — 검증된 이메일만 허용하는 추가 정책 필요, v2 후보. (c) 거부 — UX 손해. 둘 다 기각.
- impact: `auth/AuthService.loginBySocial`, SCHEMA.md#2 미결 해소
- date: 2026-09-14

### D-016 401 코드 구분 — 만료는 `TOKEN_EXPIRED`, 그 외는 `UNAUTHENTICATED`
- decision: access 쿠키가 있고 서명은 유효하나 만료면 401 `TOKEN_EXPIRED`, 쿠키 없음/변조/모르는 사용자는 401 `UNAUTHENTICATED`. refresh 실패도 같은 코드 체계(+재사용 `TOKEN_REUSED`)이며 실패 시 서버가 쿠키 2개를 삭제한다.
- rationale: 프론트 `api.ts`는 401이면 무조건 refresh를 시도하므로 동작은 같다. 코드를 나누는 건 로그·디버깅용이며 API.md 에러 표와 1:1.
- alternatives: 401 단일 코드 — 만료와 위조를 로그에서 구분 못 함. 기각.
- impact: `SecurityConfig` entrypoint, `auth/AuthController.refresh`, API.md#공통
- date: 2026-09-14

### D-017 어드민 페르소나 폐지 — 시스템 프롬프트는 방 단위, 개설자가 프리셋 선택 + 자유 편집
- decision: `personas` 테이블·`/admin/personas` API·US-22/US-40 을 폐기한다. AI 시스템 프롬프트는 방마다 `aiPersonality` 프리셋(RATIONAL/EMOTIONAL, 코드 상수 문구)을 기본으로 하고, 개설자가 `aiPrompt`(자유 텍스트, 1~2,000자)로 덮어쓸 수 있다. 유효 프롬프트 = `aiPrompt` 있으면 그것, 없으면 프리셋 문구. 프리셋을 다시 고르면 `aiPrompt` 는 초기화된다(언제든 재선택 가능). 앱 공통 기본 페르소나 층은 없다.
- rationale: 9/15 2인 채팅방 요건으로 방 단위 성격(`AiPersonality`)이 생기면서 어드민 페르소나와 층이 겹쳤다. 말투를 정하는 주체는 방 개설자가 자연스럽고, 관리자가 전역 프롬프트를 바꿔 모든 방 대화 톤이 한꺼번에 바뀌는 것은 원하지 않는다.
- alternatives: (a) 두 층 유지(어드민 공통 + 방 성격) — 겹침, 관리자 편집 화면 비용. (c) 프리셋 문구를 DB 로 옮겨 관리자 편집 — 기각, 개설자 편집으로 충분.
- impact: `V3__room_ai_prompt.sql`(`chat_rooms.ai_prompt` 추가, `personas` DROP), `persona/*` 삭제, `PATCH /rooms/{id}` `aiPrompt`, Room 응답 `aiPrompt`/`effectiveAiPrompt`, T-007 컨텍스트 = 유효 프롬프트 + 가중 지시 + 최근 N, API.md#rooms/#admin, SCHEMA.md #4/#6, PLAN.md US-22/40·M4, T-008 UI(프롬프트 편집 textarea). → T-019
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정)

### D-018 D-008 보완 — AI 응답은 방 단위 서버 잡, 클라이언트 이탈과 무관하게 완주·저장
- decision: `POST /rooms/{id}/messages` 는 202 로 즉시 끝나고 AI 응답은 방당 직렬 큐의 서버 잡이 만든다. 결과는 `GET /rooms/{id}/events` SSE(방 단위 브로드캐스트)로 흘리며, 구독자가 0명이어도 잡은 완주하고 ASSISTANT 메시지를 저장한다. 취소 없음. 미저장은 OmniRoute 오류·타임아웃뿐(`error` 이벤트, 부분 응답 폐기). 대기 중 방이 `HUMAN` 으로 바뀌면 잡 시작 시 재확인해 건너뛴다(이미 스트리밍 중인 잡은 완주). 풀 포화 시 503 `AI_BUSY`.
- rationale: 2인 방에서는 한쪽이 나가도 상대는 답을 봐야 한다. 응답이 특정 HTTP 연결에 묶이지 않으므로 "중단 시 부분 저장" 질문 자체가 사라진다. SSE 구현은 `SseEmitter`(Homepage X21 선례, webmvc 스택) — CONVENTIONS.md#백엔드.
- impact: `message/{RoomEventBus, RoomAiExecutor, MessageService}`, `llm/OmniRouteClient`, API.md#messages, CONVENTIONS.md SSE 규칙. → T-007
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정)

### D-019 T-007 SSE/큐 세부 확정 — 이벤트 형식·하트비트·라벨·가중 문구·풀 크기
- decision:
  - 이벤트 payload: `message`={Message} / `delta`={replyTo,text} / `done`={message,replyTo,promptTokens,completionTokens} / `error`={replyTo,code,message} / `mode`={mode} / `member`={action,userId,nickname,role,roomStatus}. `replyTo` = 트리거 USER 메시지 id(동시 잡 델타 구분).
  - 하트비트: 서버가 20초마다 SSE 주석 `: ping`(`@Scheduled`), `SseEmitter` 타임아웃 무제한. nginx `proxy_read_timeout 300s` 우회, EventSource 재연결 공백 유실 방지.
  - 컨텍스트 라벨 닉네임은 나간 멤버 포함(`RoomMemberMapper.findAllByRoomId`). 재입장 시 같은 사람이 두 라벨로 갈라지지 않게.
  - 가중 지시 문구: "이 방에는 개설자 {닉}과 참여자 {닉}이 있다. 개설자의 요청과 취향 그리고 개설자 편향 적으로 80%, 참여자를 20% 비중으로 반영해 답한다. 각 메시지 앞 [이름] 은 발신자다."
  - AI 스레드풀 core 2 / max 4 / queue 16(설정값). 초과 시 503 `AI_BUSY`.
  - QA 백로그(`ExceptionHandlerExceptionResolver` WARN 이 본문 값 로그) 는 T-007 에 로거 레벨 `ERROR` 한 줄로 포함.
  - 커밋 2개: (1) `OmniRouteClient` + `DailyUsageMapper`, (2) 이벤트 버스·큐·서비스·컨트롤러·문서.
- rationale: D-018 확정 후 남은 구현 갈림길. 하트비트 없는 안(타임아웃 4분 + 재연결 의존)은 재연결 공백 중 `delta`/`done` 유실로 T-008 복잡도가 오른다.
- impact: API.md#messages 확정, CONVENTIONS.md SSE 규칙, `application.yml` executor/logging, T-007.
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정)

### D-020 T-008 착수 확정 — draft 방 폐기(D-010 대체), `/` 동작, 토스트 스펙, 아이콘 라이브러리
- decision:
  - D-010(첫 방 draft) 폐기. 사이드바 "+ 새 방" 이 즉시 `POST /rooms` → `/rooms/{id}` 이동. 빈 방이 DB 에 남을 수 있음을 감수(제목은 첫 메시지로 자동).
  - `/`(로그인 직후): 활성 방이 있으면 최신 방(`lastMessageAt` 내림차순 첫 항목)으로 `router.replace`, 없으면 셸 안 빈 상태(하트 아바타 + "아직 방이 없네? 하나 파자." + "+ 새 방").
  - 토스트는 DESIGN.md 스펙으로 통일: 필(9999)·그림자 없음·닫기 X 없음·3초, 안내 `surface`/`on-surface`, 오류 `danger-bg`/`danger`. 로그인 화면 토스트도 같이 바뀐다.
  - 아이콘은 `@phosphor-icons/react` 단일 패밀리, weight `bold`(2px 선), 24px, `currentColor`. 손그림 SVG 는 말풍선 꼬리만.
  - 시간 표기: 목록 상대시간(방금/n분 전/n시간 전/어제/`M.D`), 말풍선 `HH:mm`, 날짜 칩 `M월 D일 요일`. 표시는 KST.
  - 다크/라이트 수동 테마 선택은 v1 이후 별도 작업 → T-020.
- rationale: DESIGN.md 2026-09-16 개정이 D-010 과 모순이었고 `/` 동작·시간 표기·아이콘 소스가 미정이었다. 채팅 앱은 열면 바로 대화가 이어지는 게 자연스러워 최신 방 자동 이동. 토스트는 기존 코드가 스펙과 달랐다.
- alternatives: `/` 를 항상 빈 메인으로 두고 방은 사이드바에서 선택 — 모바일에서 탭 하나 더 필요, 기각. 아이콘 손그림 — 6개뿐이지만 M3 이후 늘어나 일관성 관리 비용, 기각.
- impact: `app/(chat)/*`, `components/ui/Toast` 리팩터, `package.json`(+phosphor), DESIGN.md 미결에 아이콘 라이브러리 반영 요청(to-designer). → T-008, T-020
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정)

### D-021 T-018 착수 확정 — 로그인 `next` 는 OAuth state 로, 미리보기 `alreadyMember`, QR 은 `uqr` 자체 렌더, ORPHANED 모달 단일 트리거, 입장 화면 디테일
- decision:
  - **로그인 복귀 경로는 api 가 책임진다.** `GET /oauth2/authorization/{provider}?next=<상대경로>` → authorization request attribute 로 보관(서명 쿠키 저장소가 이미 attributes 를 직렬화) → 콜백 성공 시 `APP_BASE_URL{next}` 로 302. 허용은 `/` 로 시작하는 상대경로만(`//`, `\`, 개행, 200자 초과 거부). 없거나 불량이면 `/`. web `proxy.ts` 는 미인증 보호 경로를 `/login?next=<경로>` 로 보내고, 로그인 화면은 그 값을 소셜 버튼 href 에 그대로 붙인다. → T-022(api)
  - **미리보기 응답에 `alreadyMember: boolean`** 추가(`GET /rooms/join/{code}`). 프론트가 "들어갈래 / 다시 들어가기" 를 판정하는 유일한 근거. → T-022(api)
  - **QR 은 `uqr`(MIT, 의존성 0)로 행렬만 받고 SVG 는 직접 그린다** — 모듈을 `rx` 둥근 사각형으로(DESIGN "귀여움" 규칙). 로고 삽입 없음(스캔 신뢰성). 오류정정 M.
  - **ORPHANED 모달 트리거는 캐시 `room.status` 하나로 모은다.** 목록 탭(상세 GET) · SSE `member` · 전송 410 모두 캐시 status 를 `ORPHANED` 로 만들고, `RoomView` 가 `status === 'ORPHANED' && role === 'PARTICIPANT'` 이면 모달. 확인 → 기존 `useLeaveRoom`(DELETE → 목록 갱신 → `/`). `sendErrorMessage` 의 410 토스트는 제거(모달이 대신).
  - 입장·초대 화면 디테일(DESIGN.md §4·§5 반영): (E1) 초대장 말풍선 꼬리 발치에 개설자 이니셜 아바타 28px — 개설자가 말 거는 장면. 소개문 자리 "{닉}이(가) 부른 방 / 들어와서 같이 씹자". (E2) 코드 4+4 표시 "K7Q2 M9XW", 복사는 8자 연속. (E3) QR 카드는 모드 무관 라이트 토큰 고정(`--qr-bg`/`--qr-ink` 를 globals.css 상수로) — 스캐너 호환, T-020 `[data-theme]` 와 충돌 없음. (E4) "공유하기" 보조 버튼은 `navigator.share` 있을 때만 렌더.
- rationale: DESIGN/TASKS 는 `/login?next=` 까지만 적고 소셜 왕복에서 `next` 가 어떻게 살아남는지 비어 있었다. web 쿠키 방식은 iOS 홈화면 앱↔Safari 저장소 분리 때문에 PWA 에서 깨지고, 만료·잔존 쿠키 엣지가 생긴다. state 방식은 콜백을 완료하는 브라우저가 어디든 서버가 목적지를 안다. `alreadyMember` 는 web 이 `GET /rooms/{id}` 를 한 번 더 치는 것보다 한 필드가 싸다. ORPHANED 트리거 3갈래를 따로 구현하면 모달 중복·정리 누락 경로가 생긴다.
- alternatives: `next` 를 web 쿠키(`next_path`, 10분)로 — PWA 저장소 분리로 기각. `qrcode.react` — 9KB gz, 각진 기본 QR 커스텀 불가, 기각. 미리보기 후 `GET /rooms/{id}` 로 멤버 판정 — 요청 1회 추가, 기각. 항상 "들어갈래" — DESIGN §5 문구와 불일치, 기각.
- impact: api `auth/oauth2/{OAuth2SuccessHandler, NextPathAuthorizationRequestResolver, NextPath}`, `SecurityConfig`, `JoinPreviewResponse`, API.md#auth/#rooms; web `proxy.ts`, `(auth)/login`, `(auth)/join/[code]`, `components/chat/{InviteSheet,OrphanedDialog}`, `components/ui/QrCode`, `features/rooms/useInvite`, `globals.css`, `package.json`(+uqr); DESIGN.md §4·§5·미결, BRAND.md §5 표. → T-022, T-018
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정)

### D-022 같은 두 사람은 활성 방 1개만 — 개설자·참여자 쌍 유일
- decision: 이미 A(개설자)·B(참여자)로 함께 있는 활성 방이 있으면, B 는 A 의 다른 방에 입장할 수 없다. 판정은 입장 시점(`GET/POST /rooms/join/{code}`)에서 서버가 하고, 409 로 거절한다. 같은 방 재입장은 그 방이 곧 "유일한 방"이므로 허용.
- 세부(2026-09-16 사용자 확정 — 제안값 그대로):
  (1) 방향: **쌍 기준** — A 가 B 방의 참여자여도 같은 쌍. (2) ORPHANED 방은 **제외**(ACTIVE 방만 셈).
  (3) 409 `PAIR_ROOM_EXISTS`, 카피 "걔랑은 이미 방 있잖아". (4) 판정 순서 404 → 410 → 400 SELF → 이미 멤버 200 → **409 PAIR** → 409 FULL → 409 LIMIT(POST 만). 미리보기도 PAIR 까지 검사.
- rationale: 뒷담 상대는 사람 단위다. 같은 두 사람의 대화가 방 여러 개로 갈라지면 AI 컨텍스트(D-019 가중 지시)와 기록이 나뉜다.
- alternatives: 방 생성 시점 제한 — 초대 전엔 참여자를 모르므로 불가. 클라이언트 판정 — 우회 가능, 기각.
- impact: api `ChatRoomService.checkJoinable`, `RoomMemberMapper`(쌍 조회 쿼리), `ErrorCode`, API.md#rooms 입장 실패 표; web `features/rooms/joinErrorMessage.ts` 한 줄, BRAND.md#5. → T-023
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정 — 세부 4건도 같은 날 사용자 확정)

### D-023 T-021 발신자 닉네임은 `Message.senderNickname` — 읽기 시 users JOIN, 스냅샷 컬럼 없음
- decision: `Message` 응답(`GET /rooms/{id}/messages`, SSE `message`·`done`)에 `senderNickname` 을 싣는다. USER 만, ASSISTANT 는 null. 값은 조회 시점 `users.nickname`(LEFT JOIN) — 나간 멤버·탈퇴 유저도 users 행이 남아 있으니 이름 유지. users 행이 없으면 null → web 은 현재 멤버 목록 폴백 → 그래도 없으면 "나간 사람". 스키마 변경 없음.
- rationale: 화면 표시가 서버 LLM 컨텍스트(D-019, `findAllByRoomId` 현재 닉)와 같은 기준이 된다. 닉 변경 시 과거 메시지도 새 닉으로 보이는 건 카카오 등 채팅 앱 관행과 같다. 방 상세 `members` 는 "활성 멤버" 의미로 모드 토글·헤더에서 쓰여 건드리지 않는다.
- alternatives: (B) `messages.sender_nickname` 스냅샷 컬럼(V4) — 마이그레이션·백필 + 닉 변경 시 LLM 라벨과 다시 어긋남, 기각. (C) 방 상세 `members` 에 나간 멤버 포함(`leftAt`) — 활성 의미 의존처마다 필터 필요, 재입장 케이스 애매, 기각.
- impact: api `message/{Message, MessageResponse}`, `mapper/MessageMapper.xml`(조회 3종 LEFT JOIN users), API.md#messages; web `features/messages/types.ts`, `components/chat/MessageList.buildRows`(우선순위 senderNickname → members → "나간 사람"), `useMessages` 낙관적 메시지 `senderNickname: null`. → T-021
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정 — A안 채택)

### D-024 T-020 테마 수동 선택 — 사이드바 하단 글자 필 토글, 고정 용어 "시스템 | 라이트 | 다크"
- decision:
  - UI 는 사이드바 하단 프로필 줄 **아래** 한 줄에 `PillToggle` 3칸(`시스템 | 라이트 | 다크`). 좌측 보조 라벨("화면") 없음. `aria-label="테마 선택"`. 사이드바 컴포넌트를 공유하므로 모바일 드로어에도 같은 위치.
  - 라벨은 고정 용어(로그인/로그아웃과 같은 층) — 개구쟁이 카피 적용 안 함. BRAND.md#5 고정 용어 목록에 추가.
  - 저장: `localStorage["theme"]` = `light`|`dark`, 시스템은 키 삭제. 첫 페인트 전 `<html data-theme>` 부착은 `app/layout.tsx` `<head>` 인라인 스크립트. `<meta name="theme-color">` 는 Next `viewport.themeColor` 미디어 배열 대신 단일 메타를 직접 렌더하고 JS 가 content 를 갱신한다(미디어 메타는 수동 선택을 반영 못 함).
  - `globals.css` 다크 토큰은 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` 와 `:root[data-theme="dark"]` 두 셀렉터에서 같은 값. `--qr-*` 는 D-021 E3 대로 모드 무관.
- rationale: 3안 목업(A 글자 필 / B 아이콘 필 프로필 줄 안 / C 순환 버튼 1개) 중 A — 기존 컴포넌트 재사용, 3상태가 한눈에 읽히고 닉네임 말줄임을 압박하지 않는다. 라벨에 장난기를 넣으면 32px 필 안에서 의미가 흐려진다.
- alternatives: B — 280px 안에 아바타+닉+필+로그아웃, 긴 닉 말줄임 심함. C — 현재 상태만 보이고 다음 상태 예측 불가, 툴팁 필요. 기각.
- impact: web `lib/theme.ts`, `components/chat/ThemePicker.tsx`, `Sidebar.tsx`, `app/layout.tsx`, `globals.css`; DESIGN.md #원칙·§2, BRAND.md #2·#5. → T-020
- date: 2026-09-16 (개발자 대행 기록, 사용자 결정 — A안, "화면" 라벨 제거, 고정 용어)

### D-025 T-025 UI 문구 전면 개정 — 사용자 수정안(copy-inventory.md) 확정
- decision:
  - `.agent/inbox/copy-inventory.md` `수정안` 열이 단일 소스. 빈 칸 = 원안 승인, 기입 = 교체. 총 52건 교체.
  - 공용 오류 문구 "삐끗했다. 다시 해볼까?" → **"시스템 오류. 다시 시도해줄래?"** 전면 교체.
  - 서버 메시지(`ErrorCode` 존댓말)를 토스트에 그대로 내보내지 않는다. web 이 코드→문구로 덮는다: 전송 400 "불가능한 요청이야!", `MODE_NOT_ALLOWED` "혼자서는 유저끼리 대화할 수 없어!", 그 외 공용 오류 문구. api 는 손대지 않음.
  - 용어 "주인" → **"방장"**(배지, ORPHANED 문구 3곳). 시스템 라인 모드 전환은 "유저끼리 대화 가능!" / "AI랑 대화 가능!". 혼자일 때 모드 토글 안내는 "친구 초대해봐!".
  - 입장 버튼은 `alreadyMember` 와 무관하게 **"들어가기"** 하나(D-021 의 "다시 들어가기" 구분 폐기, 기능은 유지). 입장 소개문 "{닉}의 방 / 같이 뒷담화하자!" — 이/가 조사 로직 삭제.
  - ORPHANED 모달 제목 "이용할 수 없는 채팅방입니다." → **"이용할 수 없는 채팅방이야."**(T-018 acceptance 고정 문구 해제), 버튼 "알았어" → "나가기".
  - 확인 모달 제목에 `\n` 줄바꿈 허용(나가기 확인 2종, 코드 재발급).
- rationale: BRAND.md#5 존댓말 금지 위반(로그인 오류·서버 메시지)을 걷어내고, 개발자가 임의로 정했던 문구를 사용자가 한 번에 확정.
- alternatives: api `ErrorCode` 메시지를 반말로 바꾸기 — 어드민·로그에도 쓰이는 문구라 web 매핑으로 한정.
- impact: web 문구 전반(`lib/copy.ts` 신설, `lib/josa.ts` 삭제), BRAND.md#5 표·DESIGN.md#2~6 문구 갱신(to-designer.md), API.md 변경 없음. → T-025
- date: 2026-09-17 (개발자 대행 기록, 사용자 결정 — 수정안 기입 + 확인 질문 4건 답변)

### D-026 보이스 모드는 턴 기반(D-007 유지) — 실시간 음성↔음성은 채택하지 않음, 체감 보강은 T-026 으로 분리
- decision: T-009/T-010 은 문서대로 턴 기반(녹음 → `/speech/stt` → 메시지 전송(SSE) → `done` 후 `/speech/tts` → 재생 → 자동 재녹음)으로 만든다.
  OpenAI Realtime 류 실시간 양방향(WebSocket/WebRTC, STT/TTS 단계 없음)은 채택하지 않는다.
  "대화 같은 느낌"은 같은 API 위에서 클라이언트만 바꿔 보강한다 → T-026(VAD 무음 감지 자동 종료 + 문장 단위 TTS 선재생). 끼어들기(barge-in)는 백로그.
  T-009 세부: STT 는 클라이언트가 `durationMs`(MediaRecorder 실측)를 같이 보내면 공급자 호출 전에 상한을 검사하고, 공급자가 돌려준 길이로 한 번 더 검사한다(둘 다 `AUDIO_TOO_LONG`).
  `daily_usage.stt_seconds` 는 공급자 보고 길이 올림, `tts_chars` 는 요청 텍스트 길이. OpenAI 는 OmniRoute 를 거치지 않고 직접 호출(D-007 의 `/v1/audio/*` 경유는 미확인 상태 유지).
- rationale: 실시간 방식은 OmniRoute 모델 alias·Provider 인터페이스(D-007)·직렬 큐·4:1 컨텍스트·텍스트 보존을 전부 우회하고 분당 과금이라 CONTEXT.md 비용 상한 요건과 충돌한다.
  턴 기반 + VAD + 문장 단위 선재생이면 Claude 앱 보이스 모드와 거의 같은 체감이 나오고 설계 변경이 없다.
- alternatives: OpenAI Realtime API 직접 연결 — 기각(위 이유). Web Speech API — D-007 에서 이미 기각.
- impact: T-009 착수, T-026 신설(blocked_by T-010), API.md#speech 에 `durationMs` 추가. DESIGN.md#7 변경 없음.
- date: 2026-09-17 (개발자 대행 기록, 사용자 결정 — "추천 방식으로 진행")

<!-- CEO가 이 아래에 결정을 계속 추가 -->

## 미결 (inbox/to-ceo.md에서 올라온 것)
- ~~프로젝트/서비스 이름~~ → D-011 확정
- ~~같은 이메일 다른 공급자 정책~~ → D-015 확정
- STT 녹음 길이·일일 호출 상한 (D-007 open)
- ~~스트림 중단 시 부분 응답 처리 (D-008 open)~~ → D-018 확정
