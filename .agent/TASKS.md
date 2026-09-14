# TASKS — 작업 큐 (상태 기반)

> **Read: 전원 | Write: 각 owner는 자기 작업 라인만 수정**
> 상태: TODO → IN_PROGRESS → REVIEW → DONE / BLOCKED
> 규칙: 시작 시 IN_PROGRESS, 구현 후 REVIEW, QA 통과 시 DONE.
> **TDD 필수**: 개발 작업은 테스트를 먼저 작성(RED→GREEN→REFACTOR)하고 전체 테스트 통과 후 REVIEW로 전환.
> 테스트 없는 구현은 DONE 불가. 프론트 `npm test`, 백엔드 `./gradlew test`(로컬 compose MySQL 필요).
> 마일스톤·acceptance 출처: PLAN.md. 계약: API.md, SCHEMA.md.
> **T-004 부터는 Claude Code 에서 진행** (2026-09-13 결정). 착수 전 CLAUDE.md → 이 파일 → API.md/SCHEMA.md 순으로 읽는다.

## 형식
```
## T-000 제목
- status: TODO
- owner: 개발자
- milestone: M1
- spec: PLAN.md#M1, API.md#auth
- blocked_by: T-000
- acceptance:
  - ...
- test: (구현 후) 테스트 파일/케이스 수
- qa: (QA 기록) PASS/FAIL + QA_REPORT.md 날짜
- note:
```

## 진행 중 얻은 교훈 (착수 전 읽기 — 같은 데서 두 번 넘어지지 않기)
- **Boot 4 import 는 Homepage/Admin 기존 코드에서 먼저 확인.** 예: `@WebMvcTest`/`@AutoConfigureMockMvc` 는
  `org.springframework.boot.webmvc.test.autoconfigure.*`. Jackson 은 `tools.jackson.*`. 기억으로 쓰지 말 것.
- **Boot 4 BOM 미관리 라이브러리는 버전 명시.** okhttp/mockwebserver, mybatis-spring-boot, jjwt, springdoc.
- **JDBC URL `characterEncoding=UTF-8`.** `utf8mb4` 를 넣으면 Connector/J 가 `UnsupportedEncodingException` 으로 죽는다.
- **`@WebMvcTest` 가 테스트 클래스 안의 nested `@RestController` 를 등록하지 않는다(Boot 4).** 핸들러/유틸은
  Homepage 처럼 직접 호출하는 단위 테스트로. HTTP 레벨은 실제 컨트롤러 테스트에서.
- **Next `/api` rewrite 금지** — SSE 0바이트(Homepage X21). 로컬도 nginx-dev(:3000) 경유.
- **`filesystem:edit_file` 의 oldText 에 한글이 있으면 실패할 수 있다.** 영문 앵커로 잡거나 파일 전체 write.
- **OAuth2 커스텀 provider(naver/kakao) 는 `redirect-uri` 를 명시해야 한다.** Boot 는 CommonOAuth2Provider(google 등)에만
  기본값을 채운다. 빠지면 기동 시 `redirectUri cannot be empty`. registration `client-id` 가 빈 문자열이어도 죽는다 → 로컬 기본값은 placeholder.
- **`Filter` 타입 @Bean 은 Boot 가 서블릿 필터로도 자동 등록한다.** 시큐리티 체인 전용 필터는 `FilterRegistrationBean.setEnabled(false)` 로 막을 것(T-004 `JwtAuthFilter`).
- **Spring Security 7 OAuth2 클래스는 Homepage/Admin 에 참고코드가 없다.** `javap -cp <jar>` 로 시그니처 확인 후 사용.
  `InvalidClientRegistrationIdException` 은 package-private(IllegalArgumentException 하위).

---

## M0 스캐폴드

## T-000 레포 스캐폴드 + CI/CD 뼈대 + .agent 워크플로
- status: DONE
- owner: 개발자
- milestone: M0
- qa: PASS (QA_REPORT.md 2026-09-13)
- note: 단일 모노레포(D-001). compose 운영/로컬, nginx, Dockerfile×2, ci.yml/deploy.yml, `.agent/*`, CLAUDE.md.

## M1 프로젝트 초기화 · 인증

## T-001 web 프로젝트 초기화
- status: DONE
- owner: 개발자
- milestone: M1
- spec: 루트 README.md#apps/web, CONVENTIONS.md#프론트
- test: `app/lib/api.test.ts` 8케이스 (401→refresh→재시도, refresh 실패→/login, 에러 매핑, 204, raw body)
- qa: PASS (사용자 로컬 `npm test` 통과, 2026-09-13)
- note: Serwist 는 Next 16 호환 미확인으로 **T-014 로 분리**. `next.config.ts` 에 `/api` rewrite 없음(D-004 보완).
  `@/*` → `./app/*`(Homepage 와 동일) — components/features/lib 도 `app/` 아래.
  `public/icons/*.png`(192/512/maskable) 은 아직 없음 → DESIGN.md 미결(아이콘) 확정 후 추가.

## T-002 api 프로젝트 초기화
- status: DONE
- owner: 개발자
- milestone: M1
- spec: 루트 README.md#apps/api, CONVENTIONS.md#백엔드
- test: `ChatApplicationTests.contextLoads`(Flyway V1 적용 포함), `GlobalExceptionHandlerTest` 6케이스(단위)
- qa: PASS (사용자 로컬 `./gradlew test` 통과, 2026-09-13)
- note: Java 17 / Boot 4.1.0 / mybatis-spring-boot 4.0.1 / Gradle 9.5.1 (Homepage·Admin 과 동일).
  `SecurityConfig` 는 뼈대(stateless, csrf off, 401 JSON, `/admin/**` ADMIN). OAuth2 registration 은 T-004.
  `gradlew`/`gradle/` 은 Homepage 에서 복사(바이너리 jar 포함).

## T-003 DB 스키마 확정 + 초기 SQL + 매퍼
- status: DONE
- owner: 개발자
- milestone: M1
- spec: SCHEMA.md
- blocked_by: T-002
- test: `MapperTest` (@SpringBootTest + @Transactional) — User 3, ChatRoom 5, Message 1, Persona 4 케이스
- qa: PASS (사용자 로컬 `./gradlew test` 통과, QA_REPORT.md 2026-09-13)
- note: **Flyway 가 DDL 단독 소유**(D-009 보완). `V1__init.sql` = 테이블 7개 + 기본 페르소나 시드. `01-schema.sql` 은 `SET NAMES` 만.
  도메인 `user/User`, `chatroom/ChatRoom`(autoTitle), `message/Message`(user()/assistant() 팩토리), `persona/Persona`.
  매퍼 4쌍(`mapper/*.xml`, resultMap 명시). `ChatRoomMapper.findByUserId` 커서는 id 기준(정렬 키셋 아님) — T-006 에서 재검토.
  `social_accounts`/`refresh_tokens` 도메인+매퍼는 T-004 에서(테이블은 V1 에 있음).

## T-004 소셜 로그인 3사 + JWT 쿠키 + refresh 회전 (api)
- status: REVIEW
- owner: 개발자
- milestone: M1
- spec: PLAN.md#M1, API.md#auth, SCHEMA.md#2 #3, D-003
- blocked_by: T-003
- acceptance:
  - `application.yml` 에 google/naver/kakao registration + naver/kakao provider(URI 직접 등록). 값은 `${OAUTH_*}`.
  - 구글(기본 provider), 네이버/카카오(커스텀) `OAuth2UserInfo` 파싱 단위 테스트. `SocialAccount`·`RefreshToken` 도메인+매퍼+테스트.
  - **stateless 와 충돌하는 기본 HttpSession `AuthorizationRequestRepository` 를 cookie 기반으로 교체**(SecurityConfig 주석).
  - 성공 핸들러: `social_accounts` upsert → `users` 생성/last_login → access/refresh 쿠키 → `app.base-url/` 로 redirect.
  - `POST /auth/refresh`: 유효 refresh → 새 access + 새 refresh(구 토큰 revoke, 같은 family). 재사용 감지 시 family 전체 revoke + `TOKEN_REUSED`.
  - `POST /auth/logout`: 쿠키 삭제 + refresh revoke. `GET /auth/me`: 미인증 401(JSON).
  - `JwtAuthFilter` 가 access 쿠키를 읽어 SecurityContext 세팅. 정지 회원은 `/auth/me` 는 되고 그 외 403 `USER_SUSPENDED`(T-011 과 합의).
  - MockMvc 통합 테스트(실제 SecurityConfig 적용)로 refresh 회전·재사용·로그아웃 흐름 커버.
  - 같은 이메일 다른 공급자 정책: inbox/to-ceo.md 결정 대기 — 결정 전엔 (b) 별도 계정으로 구현.
- test: 68 케이스 — `auth/AuthMapperTest` 7, `JwtProviderTest` 6, `AuthCookiesTest` 5, `JwtAuthFilterTest` 8, `RefreshTokenServiceTest` 7,
  `AuthServiceTest` 5, `oauth2/OAuth2UserInfoTest` 7, `CookieOAuth2AuthorizationRequestRepositoryTest` 5, `OAuth2HandlersTest` 4,
  `AuthFlowIntegrationTest`(MockMvc + 실제 SecurityConfig) 14. 전체 88 통과(2026-09-14 로컬).
- note: 개발자 콘솔 redirect URI 는 운영 `https://도메인/api/login/oauth2/code/{provider}` 와 로컬
  `http://localhost:3000/api/login/oauth2/code/{provider}` 둘 다 등록. 로컬은 nginx-dev(:3000) 경유.
  구현 결정(2026-09-14): refresh 쿠키 Path `/api/auth`(logout 이 family revoke 가능) → **API 변경, API.md 갱신**.
  authorization request 는 JWT 서명 쿠키(`oauth2_auth_request`, 5분, audience 분리). 정지/권한은 매 요청 `users` 1회 조회(즉시 반영).
  구글은 `openid` 없이 profile/email 만 요청해 3사 모두 `DefaultOAuth2UserService` 한 경로. 같은 이메일 다른 공급자 = 별도 계정.
  `/auth/me` 에 `status` 추가(정지 안내용). 실기기 소셜 왕복은 키 등록 후 T-013 에서.

## T-005 로그인 페이지 + 세션 유지 + 라우트 가드 (web)
- status: TODO
- owner: 개발자
- milestone: M1
- spec: DESIGN.md#로그인, API.md#auth
- blocked_by: T-001, T-004
- acceptance:
  - `app/(auth)/login/page.tsx` 버튼 3개 → `/api/oauth2/authorization/{provider}` (a 태그, 전체 페이지 이동).
  - `middleware.ts`: access 쿠키 없으면 `/login`, 있으면 `/login` → `/`. (쿠키 존재만 검사, 검증은 API)
  - `app/features/auth/useMe.ts` React Query + `QueryClientProvider`(요청별 새 인스턴스, Homepage B-6b), 로그아웃 버튼.
  - 컴포넌트 테스트: 버튼 렌더/링크, 로그아웃 호출, `?error=` 알림.

## M2 텍스트 채팅 · SSE

## T-006 채팅방 CRUD (api)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: API.md#rooms, D-010
- blocked_by: T-004
- acceptance:
  - `GET/POST /rooms`, `GET/PATCH/DELETE /rooms/{id}`. 타인 방 404. 삭제 soft.
  - `ChatRoomMapper.findByUserId` 커서를 `(last_message_at, id)` 키셋으로 바꿀지 결정 후 반영. 응답 `{ items, nextCursor }`.
  - `ChatRoom.autoTitle` 은 이미 있음 — 첫 메시지 시 적용은 T-007.

## T-007 메시지 SSE 스트리밍 + OmniRoute 클라이언트 + 컨텍스트 윈도우 (api)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: API.md#messages, D-006, D-008
- blocked_by: T-006
- acceptance:
  - `llm/OmniRouteClient` — `omniRouteWebClient`(WebClientConfig) 로 `/chat/completions` `stream=true`, MockWebServer 로 델타 파싱 테스트.
  - `message/ChatService`: USER 저장 → `touchOnNewMessage` → 컨텍스트(`PersonaMapper.findActive` + `findRecentByRoomId(N)` 뒤집기) → 스트림 → ASSISTANT 저장. 순서 테스트.
  - `POST /rooms/{id}/messages` → SSE `user`/`delta`/`done`/`error` (API.md). SseEmitter vs Flux 결정 → CONVENTIONS.md 에 기록.
  - 동시 요청 409: 방 단위 in-memory 락(`ConcurrentHashMap<roomId, ...>`) — 인스턴스 1대라 충분.
  - 스트림 중 DB 트랜잭션 열어두지 않기. 중단 시 정책(D-008 open) 확정해 inbox/to-ceo.md.
  - `daily_usage` upsert(message_count, tokens).

## T-008 채팅 셸 + draft 방 + 스트리밍 UI (web)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: DESIGN.md#채팅, API.md#messages
- blocked_by: T-005, T-007
- acceptance:
  - `app/(chat)/layout.tsx` 사이드바 + 메인, 방 목록/선택/제목 수정/삭제.
  - `/` draft → 첫 전송 시 `POST /rooms` → `router.replace('/rooms/{id}')` → 메시지 전송.
  - `app/lib/sse.ts` POST 스트림 파서(fetch + ReadableStream) 단위 테스트(delta/done/error, 청크 경계).
  - 전송 중 입력 비활성, 409 토스트, 상단 도달 시 이전 페이지.

## M3 음성

## T-009 STT/TTS Provider + 엔드포인트 (api)
- status: TODO
- owner: 개발자
- milestone: M3
- spec: API.md#speech, D-007
- blocked_by: T-002
- acceptance:
  - `speech/SttProvider`·`TtsProvider` + `openai/*` 구현 + `clova/*` 스텁. `SpeechProperties`(app.speech.*) + provider 선택 `@ConditionalOnProperty`.
  - `/speech/stt` multipart → `app.speech.tmp-dir` 저장 → 변환 → 삭제(테스트로 확인). 길이 상한 → `AUDIO_TOO_LONG`.
  - `/speech/tts` 텍스트 상한(`max-tts-chars`) → `TEXT_TOO_LONG`, `audio/mpeg` 반환. `daily_usage.stt_seconds/tts_chars` 갱신.

## T-010 듣기/말하기 버튼 + 보이스 모드 루프 (web)
- status: TODO
- owner: 개발자
- milestone: M3
- spec: DESIGN.md#보이스-모드, API.md#speech
- blocked_by: T-008, T-009
- acceptance:
  - `app/features/speech/useRecorder` (MediaRecorder, iOS Safari mime 분기) 훅 테스트.
  - 메시지별 듣기 → TTS 재생 큐. 마이크 → STT → `inputType: 'VOICE'`.
  - 보이스 모드 상태 머신(idle→recording→transcribing→streaming→speaking→recording) 순수 함수 + 테스트.
  - 권한 거부/네트워크 오류 시 텍스트 입력으로 복귀.

## M4 어드민

## T-011 어드민 API + 페이지
- status: TODO
- owner: 개발자
- milestone: M4
- spec: API.md#admin, DESIGN.md#어드민
- blocked_by: T-008
- acceptance:
  - `ROLE_ADMIN` 아니면 403. persona CRUD + activate(활성 1개 보장 트랜잭션), users 목록/상태, stats, rooms/messages 조회.
  - 정지 회원 메시지 전송 403. `(admin)` 4개 페이지 렌더 테스트.

## M5 배포 · PWA

## T-012 NAS 첫 배포 리허설
- status: TODO
- owner: 개발자
- milestone: M5
- spec: 루트 README.md#첫-배포-순서, D-002, D-009
- blocked_by: T-008
- acceptance:
  - GitHub Variables/Secrets 등록, `master` push → GHCR → NAS 기동. DSM 리버스 프록시 경유 SSE 동작.
  - NAS CPU 아키텍처 확인 → deploy.yml `platforms:`. DSM `X-Forwarded-For` 전달 확인.
  - `docker stats` 로 api 메모리 상한 내 동작. 인프라 작업이라 자동 테스트 없음 — QA 체크리스트.

## T-013 iOS/Android 홈화면 PWA 검증
- status: TODO
- owner: QA
- milestone: M5
- blocked_by: T-012, T-014
- acceptance:
  - 홈화면 설치, 소셜 로그인 3사 왕복, 마이크 권한, 백그라운드 복귀 후 세션 유지. 실패는 inbox/to-ceo.md.

## T-014 서비스워커(PWA 오프라인 셸) — T-001 에서 분리
- status: TODO
- owner: 개발자
- milestone: M5
- blocked_by: T-008
- acceptance:
  - `@serwist/next` 의 Next 16 호환 확인(안 되면 대안 결정 → DECISIONS.md). `app/sw.ts`, `next.config.ts` 래핑.
  - `/api/*`, `/admin/*` NetworkOnly. 앱 셸·정적 자원만 precache. 오프라인 시 "연결 없음" 안내.
  - `public/icons/*` 추가(DESIGN.md 아이콘 확정 후). Lighthouse PWA 체크 통과.

---

## 백로그 (마일스톤 미배정)
- 방 검색
- 메시지 복사/재생성(regenerate)
- TTS 응답 스트리밍(문장 단위 선재생)
- 토큰 기준 컨텍스트 윈도우(D-006 open)
- 사용량 일일 상한 + 어드민 알림(D-007 open)
- `MapperTest` 를 `@MybatisTest` 슬라이스로 전환(속도) — Boot 4 `AutoConfigureTestDatabase` 패키지 확인 후
