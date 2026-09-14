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
- decision: Spring 기본 `HttpSessionOAuth2AuthorizationRequestRepository` 대신 필요한 필드(state, registrationId, redirectUri, scopes, attributes, additionalParameters)만 JWT(HS256, audience=`oauth2-request`, 5분)로 서명해 쿠키 `oauth2_auth_request`(HttpOnly, SameSite=Lax, Path `/api`)에 담는다.
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

<!-- CEO가 이 아래에 결정을 계속 추가 -->

## 미결 (inbox/to-ceo.md에서 올라온 것)
- ~~프로젝트/서비스 이름~~ → D-011 확정
- ~~같은 이메일 다른 공급자 정책~~ → D-015 확정
- STT 녹음 길이·일일 호출 상한 (D-007 open)
- 스트림 중단 시 부분 응답 처리 (D-008 open)
