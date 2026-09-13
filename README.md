# 김영선 욕하는 앱 (talking-behind-my-back)

심심이 같은 음성 대화 앱. 소셜 로그인 → 채팅방 여러 개 → 방마다 텍스트/음성 대화, 음성도 텍스트로 기록.
표시명·슬러그는 D-011. 레포: https://github.com/withbbang/talking-behind-my-back
협업 규칙은 `.agent/README.md`, 작업 지침은 `CLAUDE.md`.

## 레포 레이아웃

```
chat-app/                        ← 단일 모노레포
├── CLAUDE.md                    # 에이전트 작업 지침 (진입점)
├── .agent/                      # 협업 워크플로우 (CONTEXT/PLAN/TASKS/DECISIONS/API/SCHEMA/...)
├── .claude/settings.json        # 태스크 규칙 리마인더 hook
├── apps/
│   ├── web/                     # Next.js 16 PWA (사용자 앱 + 어드민)
│   └── api/                     # Spring Boot 4.1 (MyBatis, Flyway)
├── infra/                       # NAS에 그대로 복사되는 배포 디렉토리
│   ├── docker-compose.yml       # 운영: nginx, web, api, mysql, omniroute
│   ├── docker-compose.dev.yml   # 로컬: nginx(:3000), mysql, omniroute
│   ├── nginx/default.conf       # 운영 (DSM 리버스 프록시 뒤)
│   ├── nginx/dev.conf           # 로컬 (:3000 → next dev :3001 / api :8080)
│   ├── mysql/init/01-schema.sql # DB 레벨 설정만 (테이블은 Flyway)
│   ├── .env.example             # → .env (NAS에만 존재)
│   └── .env.omniroute.example   # → .env.omniroute
└── .github/workflows/
    ├── ci.yml                   # dev/master PR: lint/typecheck/test/build
    └── deploy.yml               # master push: GHCR 빌드 → NAS scp+ssh 배포
```

`apps/web`, `apps/api`는 각각 독립 프로젝트(루트 워크스페이스 없음). 언어가 다르고 혼자 개발하니
공유 패키지 없이 Dockerfile 빌드 컨텍스트를 각 앱 디렉토리로 잡는 게 가장 단순함.

## apps/web (Next.js App Router)

`@/*` → `./app/*` (Homepage 와 동일). 라우트가 아닌 코드도 전부 `app/` 아래.

```
apps/web/
├── app/
│   ├── layout.tsx, globals.css, manifest.ts, page.tsx(임시)
│   ├── (auth)/login/page.tsx          # T-005: 소셜 버튼 3개 → /api/oauth2/authorization/{provider}
│   ├── (chat)/                        # T-008
│   │   ├── layout.tsx                 # 사이드바(채팅방 목록) + 메인
│   │   ├── page.tsx                   # draft 방 (D-010)
│   │   └── rooms/[roomId]/page.tsx
│   ├── (admin)/admin/                 # T-011: layout(ROLE_ADMIN), page, users/, rooms/, persona/
│   ├── components/
│   │   ├── chat/                      # MessageList, Composer, StreamingBubble
│   │   ├── voice/                     # VoiceButton, VoiceModeOverlay, AudioPlayer
│   │   └── ui/
│   ├── features/                      # 도메인별 훅 + API 호출 + 상태 (auth, rooms, chat, speech)
│   └── lib/
│       ├── api.ts (+test)             # ✅ fetch 래퍼: credentials include, 401 → refresh 1회 → 재시도
│       ├── sse.ts                     # T-008: fetch 기반 SSE 파서 (POST + 스트림)
│       └── audio.ts                   # T-010: 녹음 포맷/변환, 재생 큐
├── middleware.ts                      # T-005: 미로그인 → /login, /admin → role 체크
├── public/icons/                      # (미정) 192/512/maskable png
├── next.config.ts                     # output: 'standalone'. /api rewrite 없음(D-004 보완)
├── vitest.config.ts, vitest.setup.ts, eslint.config.mjs, postcss.config.mjs, tsconfig.json
├── Dockerfile, .dockerignore
```

- 어드민은 별도 앱이 아니라 route group `(admin)`. 접근 제한은 nginx `/admin` IP allow 로 충분함(D-005).
- 서비스워커는 T-014(M5). `/api/*`, `/admin/*` 는 절대 캐시하지 않는다.
- API 호출은 같은 오리진 `/api/...`로만. 토큰이 HttpOnly 쿠키라 CORS/헤더 처리가 없음.

## apps/api (Spring Boot, 패키지 = 기능 단위)

```
apps/api/src/main/java/com/example/chat/
├── ChatApplication.java               # ✅ @ConfigurationPropertiesScan
├── global/
│   ├── config/    ✅ SecurityConfig(뼈대), WebClientConfig(OmniRoute)   · T-004: JwtAuthFilter 등록
│   ├── security/  T-004: JwtProvider, JwtAuthFilter, CookieUtil, CookieAuthorizationRequestRepository
│   └── error/     ✅ ErrorCode, BusinessException, ErrorResponse, GlobalExceptionHandler
├── user/          ✅ User(Role/Status), UserMapper
├── chatroom/      ✅ ChatRoom(autoTitle), ChatRoomMapper                 · T-006: Controller/Service
├── message/       ✅ Message(Role/InputType), MessageMapper             · T-007: ChatController(SSE), ChatService
├── persona/       ✅ Persona, PersonaMapper                              · T-011: admin 에서 CRUD
├── llm/           ✅ LlmProperties                                       · T-007: OmniRouteClient, dto/
├── auth/          T-004: AuthController, CustomOAuth2UserService, OAuth2SuccessHandler, userinfo/, SocialAccount, RefreshToken + 매퍼
├── speech/        T-009: SttProvider/TtsProvider, openai/, clova/, SpeechProperties, SpeechController
└── admin/         T-011: AdminController, PersonaService, StatsService

src/main/resources/
├── application.yml (${ENV:로컬 기본값}), application-prod.yml (비밀은 ${ENV} 만)
├── mapper/{User,ChatRoom,Message,Persona}Mapper.xml   ✅
└── db/migration/V1__init.sql                          ✅ 테이블 7개 + 기본 페르소나
src/test/
├── resources/application-test.yml
└── java/com/example/chat/ ChatApplicationTests, MapperTest, global/error/GlobalExceptionHandlerTest
```

- `server.servlet.context-path=/api` → nginx에서 rewrite 없이 그대로 전달. OAuth redirect URI는
  `https://도메인/api/login/oauth2/code/{google|naver|kakao}` (로컬: `http://localhost:3000/api/...`).
- 네이버/카카오는 Spring Security 기본 provider가 아니므로 `spring.security.oauth2.client.provider.*`에
  authorization/token/user-info URI를 직접 등록(T-004).
- STT/TTS는 인터페이스 뒤에 두고 환경변수로 구현체 교체. 오디오 파일은 `/tmp/audio`(tmpfs)에서
  처리 후 즉시 삭제 — 텍스트만 DB에 남음.
- 스키마는 Flyway 가 단독 소유(D-009). 변경은 `V{n}__*.sql` 추가만.

## 요청 흐름

텍스트
1. `POST /api/rooms/{id}/messages` `{content, inputType}` → USER 메시지 저장 + `touchOnNewMessage`
2. 활성 페르소나 시스템 프롬프트 + 최근 `LLM_CONTEXT_MAX_MESSAGES`개 → OmniRoute `stream=true`
3. 델타를 SSE로 클라이언트에 중계, 클라이언트는 말풍선에 이어붙임
4. 스트림 종료 시 ASSISTANT 메시지 저장, 마지막 SSE 이벤트로 `messageId`/토큰 수 전달
5. 방에 진행 중 요청이 있으면 409 — 한 방에 동시 1건

음성 (보이스 모드)
1. MediaRecorder 녹음 → `POST /api/speech/stt` → 텍스트
2. 텍스트로 1~4 수행 (`inputType=VOICE`)
3. 완성된 응답 → `POST /api/speech/tts` → `audio/mpeg` 재생
4. 재생 끝나면 자동으로 다시 녹음 시작 (보이스 모드 켜져 있는 동안 반복)

첫 방 진입: 로그인 후 `/`로 오면 서버에 방을 만들지 않고 클라이언트 draft 상태.
첫 메시지 전송 시 `POST /api/rooms` → 방 생성(`ChatRoom.autoTitle`) → 그 방 id로 메시지 전송 → 사이드바 목록 +1.

## 로컬 개발

```
cd infra && docker compose -f docker-compose.dev.yml up -d   # nginx :3000, mysql :3306, omniroute :20128
cd apps/api && ./gradlew bootRun                              # :8080/api (Flyway 가 V1 적용)
cd apps/web && npm run dev                                    # :3001 — 브라우저는 http://localhost:3000
```

테스트: `cd apps/web && npm test` / `cd apps/api && ./gradlew test` (api 테스트는 compose MySQL 필요).
OmniRoute 대시보드 `http://localhost:20128` 에서 공급자 연결 + 모델 alias `chat-default` 생성 후 채팅 가능.

## 첫 배포 순서

1. 도메인 DNS → 공유기 443 → NAS. DSM 리버스 프록시: `chat.example.com` → `http://localhost:8080`
   (인증서는 DSM Let's Encrypt). 사용자 지정 헤더에서 `X-Forwarded-For` 전달 확인.
2. NAS에 `/volume1/docker/chat-app` 생성, `infra/*` 복사, `.env`/`.env.omniroute` 작성.
3. `docker compose --env-file .env up -d mysql omniroute` → `http://<NAS-IP>:20128` 에서 공급자 연결,
   모델 alias 생성, API 키 발급 → `.env`의 `OMNIROUTE_API_KEY`, `LLM_MODEL`에 기입.
4. 구글/네이버/카카오 개발자 콘솔에 redirect URI 등록 → `.env`에 키 기입.
5. GitHub Variables/Secrets 등록(deploy.yml 상단 참고) → master push → 자동 배포.
6. iOS 홈화면 PWA에서 소셜 로그인 왕복이 되는지 실기기로 확인 (Safari로 튀어나가는 이슈).
