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
- **nginx `proxy_set_header` 는 location 에 하나라도 있으면 server 레벨을 전부 무시한다.** 공통 헤더는 location 마다 반복(T-015).
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
  매퍼 4쌍(`mapper/*.xml`, resultMap 명시). `ChatRoomMapper.findByUserId` 커서는 id 기준(정렬 키셋 아님, 중복 버그) — T-006 에서 키셋으로 교체.
  `social_accounts`/`refresh_tokens` 도메인+매퍼는 T-004 에서(테이블은 V1 에 있음).

## T-004 소셜 로그인 3사 + JWT 쿠키 + refresh 회전 (api)
- status: DONE
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
- qa: PASS (QA_REPORT.md 2026-09-14) — 네이버·구글 실왕복 PASS, 카카오는 콘솔 설정 후 authorize 302 확인(로그인 왕복은 T-013).
- note: 개발자 콘솔 redirect URI 는 운영 `https://도메인/api/login/oauth2/code/{provider}` 와 로컬
  `http://localhost:3000/api/login/oauth2/code/{provider}` 둘 다 등록. 로컬은 nginx-dev(:3000) 경유.
  구현 결정(2026-09-14): refresh 쿠키 Path `/api/auth`(logout 이 family revoke 가능) → **API 변경, API.md 갱신**.
  authorization request 는 JWT 서명 쿠키(`oauth2_auth_request`, 10분, audience 분리). 정지/권한은 매 요청 `users` 1회 조회(즉시 반영).
  구글은 `openid` 없이 profile/email 만 요청해 3사 모두 `DefaultOAuth2UserService` 한 경로. 같은 이메일 다른 공급자 = 별도 계정.
  `/auth/me` 에 `status` 추가(정지 안내용). 실기기 소셜 왕복은 T-013 에서.
  카카오 scope 는 `profile_nickname, account_email` — 프로필 사진 동의항목 "사용 안함"(2026-09-14, 비즈 앱 전환 후 이메일만 켬). authorization request 쿠키 TTL 10분.

## T-005 로그인 페이지 + 세션 유지 + 라우트 가드 (web)
- status: DONE
- owner: 개발자
- milestone: M1
- spec: DESIGN.md#로그인, API.md#auth
- blocked_by: T-001, T-004
- acceptance:
  - `app/(auth)/login/page.tsx` 버튼 3개 → `/api/oauth2/authorization/{provider}` (a 태그, 전체 페이지 이동).
  - `middleware.ts`: access 쿠키 없으면 `/login`, 있으면 `/login` → `/`. (쿠키 존재만 검사, 검증은 API)
  - `app/features/auth/useMe.ts` React Query + `QueryClientProvider`(요청별 새 인스턴스, Homepage B-6b), 로그아웃 버튼.
  - 컴포넌트 테스트: 버튼 렌더/링크, 로그아웃 호출, `?error=` 알림.
- note: 착수 2026-09-14. 확정 사항 —
  (1) `middleware.ts` 대신 **`proxy.ts`**(Next 16 규약, Homepage 와 동일). 로직은 acceptance 그대로(쿠키 존재만 검사).
  (2) access 쿠키 Max-Age 15m 이라 15분 뒤 콜드 오픈은 proxy 가 `/login` 으로 보낸다. refresh 쿠키는 Path `/api/auth` 라 proxy 가
      서버 재발급 불가 → **`/login` 페이지가 마운트 시 `POST /auth/refresh` 1회 시도(silent refresh)**, 성공 시 `/` 이동, 실패 시 버튼 표시. api 변경 없음.
  (3) 약관/개인정보 링크 없음(v1). 소셜 아이콘은 인라인 SVG 근사치(디자이너 확정 후 교체 가능).
  (4) `app/page.tsx` 는 임시로 `useMe` 닉네임 + 로그아웃 표시(세션 유지 검증용, T-008 에서 교체).
  (5) 로그인/로그아웃 전환은 `lib/navigation.hardNavigate`(전체 이동) — proxy 가 쿠키를 다시 보고 React Query 캐시도 폐기.
  (6) 로그인 화면 스타일은 DESIGN.md 골격만(컬러 토큰 미결) — 브랜드색은 버튼 3개에만, 제목 좌측 정렬·버튼 하단 엄지 영역.
- test: 33 케이스 신규 — `proxy.test.ts` 6, `features/auth/{loginErrorMessage 5, session 3, useMe 3, useLogout 2}`,
  `components/ui/{SocialLoginButton 4, Toast 3}`, `(auth)/login/LoginClient.test.tsx` 4, `HomeClient.test.tsx` 3. 전체 41 통과 + lint 0 errors + typecheck + build(2026-09-15 로컬).
- qa: PASS (QA_REPORT.md 2026-09-15) — 네이버·카카오 실왕복, 세션 유지, 로그아웃, 토스트, 접근성, PWA 아이콘.
  `api.test.ts` 의 기존 typecheck 오류(TS18046, T-001) 3줄 수정. 390×844 스크린샷으로 `/login?error=access_denied` 육안 확인.
  **실왕복 확인(2026-09-15, 로컬 compose+api+web, Playwright)**: 구글 세션 silent refresh 복원(`/login` → refresh 204 → `/` → me 200),
  `/login` 직접 접근 → `/` 307, 로그아웃 → `/login` + 이후 refresh 401, 네이버 신규 로그인 → 콜백 → `/` me 200(NAVER), 15분 뒤 access 만료 후 HMR RSC 재요청 → 307 → silent refresh 204 → 복귀.
  (7) 2026-09-15 표시명 **뒷담 친구**(inbox/to-ceo D-011 보완 요청) + **핑크 테마**(globals.css 토큰, 말풍선 로그인, inbox/to-designer.md). `useLogout` 은 캐시 clear 없이 전체 이동만(clear 시 이동 전 재조회 낭비 실측).
  (8) 2026-09-15 UI 피드백 반영: 제목 중앙, 소개 우측 2줄("뒷담화 전문 AI 친구 / 무엇이든지 이야기 해도 돼!"), 말풍선 안내문 제거, 오류는 `components/ui/Toast`(상단, 5초).
      아이콘 세트 적용(`app/icon.svg`, `app/apple-icon.png`, `public/icons/*` — 사용자 제공).

## M2 텍스트 채팅 · SSE

> **2026-09-15 요건 변경 — 2인 채팅방.** 회원 혼자 개설 → 코드/QR/URL 로 1명 초대(최대 2명). 혼자면 AI 와만 대화.
> 개설자가 AI 성격(RATIONAL/EMOTIONAL) 설정. 2명이면 모드 토글(HUMAN=유저끼리·AI 휴면 / AI=한 AI 와 대화). 모든 대화 저장.
> 나가도 물리 삭제 없음. 개설자 이탈 → 주인 없는 방(ORPHANED) → 참여자 확인 시 멤버십만 끊음. AI 는 개설자 4 : 참여자 1 가중.
> 결정 사항은 `inbox/to-ceo.md` D-017~ 초안 참조. 계약: API.md#rooms, SCHEMA.md #4/#4-1/#5. CONTEXT.md/PLAN.md 갱신은 기획자.

## T-006 채팅방 기본 CRUD + 멤버십 스키마 + 키셋 커서 (api)
- status: DONE
- owner: 개발자
- milestone: M2
- spec: API.md#rooms, SCHEMA.md#4 #4-1 #5, D-010 폐기(to-ceo)
- blocked_by: T-004
- acceptance:
  - `V2__rooms_members.sql`: `chat_rooms` `user_id`→`owner_id`, `+invite_code`(UNIQUE) `+ai_personality` `+mode` `+status`, `-deleted_at`, `last_message_at` NOT NULL(기존 행 = created_at);
    `room_members` 신설(기존 방은 OWNER 행 백필); `messages` `+sender_user_id` `+mode`. 컬럼 추가는 이 마이그레이션 한 번에(T-016/T-017 은 코드만).
  - 도메인 `chatroom/{ChatRoom, RoomMember, AiPersonality, RoomMode, RoomStatus}`, `message/Message` 에 `senderUserId`/`mode`. 매퍼 xml 갱신.
  - `GET /rooms`: 내 활성 멤버십 방, `(last_message_at, id)` 키셋 커서(불투명 base64url) — 기존 id 커서는 중복 버그. `global/{CursorPage, CursorCodec}` 재사용 가능하게.
  - `POST /rooms`: 제목 기본 "새 대화", 8자 base32 코드(`0/O/1/I` 제외) 발급, OWNER 멤버십, `last_message_at = created_at`, 활성 방 50개 초과 → 409 `ROOM_LIMIT_EXCEEDED`. 201.
  - `GET /rooms/{id}`: 멤버 아니면 404. `members` + 요청자 `role`. `inviteCode/inviteUrl` 은 OWNER 에게만.
  - `PATCH /rooms/{id}`: `title` 만(1~100자, 공백 400). `mode`/`aiPersonality` 는 T-017.
  - `DELETE /rooms/{id}`: 개설자 나가기 → `status=ORPHANED` + OWNER `left_at`. 참여자 분기는 T-017(이 태스크에선 참여자 DELETE 도 멤버십 종료만).
  - 응답 시간은 UTC `Z`(`app.time-zone` 기본 `Asia/Seoul` 기준 `LocalDateTime → Instant`). Jackson `Instant` ISO 직렬화 확인(tools.jackson).
  - 테스트: `CursorCodecTest`, `InviteCodeTest`, `ChatRoomServiceTest`(단위), `ChatRoomControllerIntegrationTest`(MockMvc + 실제 SecurityConfig: 401/404/409/400, 페이지 경계 중복 없음), `MapperTest.Rooms` 재작성.
- note: 초대 입장(T-016), 나가기 분기·mode·aiPersonality(T-017), 이벤트/큐/컨텍스트(T-007), web(T-008, T-018) 으로 분리.
  착수 2026-09-15. 확정 — (1) V2 백필: `invite_code` 는 SQL 로 id→base32 8자(운영 데이터 없음, 재발급은 T-016), `deleted_at` 행은 ORPHANED + OWNER `left_at` 이관 후 컬럼 DROP,
  기존 USER 메시지 `sender_user_id = owner_id`, `mode='AI'`. (2) **PATCH title 은 OWNER 만**(참여자 403) → API.md 갱신. (3) API.md 에 있는 rooms 에러 코드 전부 `ErrorCode` 에 지금 추가.
  구현 메모: `global/AppProperties(app.base-url, app.time-zone)` 신설 — DB DATETIME 은 서울 로컬시각이라 `LocalDateTime.atZone(Asia/Seoul).toInstant()` 로 응답(SCHEMA.md 공통 규칙 정정).
  Jackson 3 는 `Instant` 를 ISO `Z` 문자열로 기본 직렬화(통합 테스트로 확인). 목록 `role` 은 `owner_id` 비교, 상세는 멤버십 행. `ChatRoomMapper.setLastMessageAt` 는 테스트 전용(정렬 키 강제).
  서비스 테스트는 AuthServiceTest 와 같이 실제 매퍼(@SpringBootTest+@Transactional) — 참여자 입장은 T-016 전이라 `RoomMemberMapper.insert` 로 직접 넣음.
- test: 40 케이스 신규 — `global/CursorCodecTest` 5, `chatroom/InviteCodeTest` 3, `ChatRoomServiceTest` 15, `ChatRoomControllerIntegrationTest`(MockMvc + 실제 SecurityConfig) 13,
  `MapperTest` Rooms 6·Members 3·Messages 1 재작성. 전체 128 통과(2026-09-15 로컬, V1→V2 백필은 스크래치 DB 로 별도 확인).
- qa: PASS (QA_REPORT.md 2026-09-15, 개발자 대행) — 실서버 curl 수동 검증 포함. 후속: 잘못된 percent-encoding 쿼리 500 → 백로그.

## T-016 초대 코드 입장 + 재발급 (api)
- status: DONE
- owner: 개발자
- milestone: M2
- spec: API.md#rooms
- blocked_by: T-006
- acceptance:
  - `GET /rooms/join/{code}` 미리보기 `{ roomId, title, ownerNickname, memberCount }`. `POST /rooms/join/{code}` 입장 → Room(PARTICIPANT).
  - 실패: 404 `INVITE_NOT_FOUND`, 409 `ROOM_FULL`, 410 `ROOM_ORPHANED`, 400 `SELF_INVITE`, 409 `ROOM_LIMIT_EXCEEDED`(입장자 기준 50개).
  - 동시 입장 2명 제한: `SELECT ... FOR UPDATE` 트랜잭션. 재입장은 `left_at=NULL, joined_at=now`. 이미 멤버면 200 그대로.
  - `POST /rooms/{id}/invite/regenerate` 개설자만(참여자 403), 구 코드 즉시 404.
  - 테스트: 서비스 단위 + MockMvc 통합(동시 입장은 스레드 2개로 1명만 성공).
- test: 17 케이스 신규 — `ChatRoomServiceTest` Preview 3·Join 8·Regenerate 2, `ChatRoomControllerIntegrationTest` JoinByCode 2·Regenerate 1,
  `ChatRoomJoinConcurrencyTest` 1(비-@Transactional, 스레드 2개 + JdbcTemplate 정리). 전체 145 통과(2026-09-15 로컬).
  `FOR UPDATE` 를 빼면 동시 테스트가 3/3 실패하는 것 확인(잠금 실효성).
- note: 착수 2026-09-15. 확정 — (1) 판정 순서 404 → 410 → 400 SELF → 이미 멤버 200 → 409 FULL → 409 LIMIT(개설자는 항상 활성 멤버라 SELF 우선).
  (2) GET 미리보기도 POST 와 같은 검증(LIMIT 제외)을 잠금 없이 수행. (3) 재발급 응답은 `{inviteCode, inviteUrl}` 만. → API.md#rooms 갱신.
  구현 메모: 정원 잠금은 `ChatRoomMapper.findByInviteCodeForUpdate`(방 행 `FOR UPDATE`) 후 `RoomMemberMapper.countActiveByRoomId`.
  재입장은 `RoomMemberMapper.rejoin`(UPDATE left_at=NULL, joined_at=NOW) 0행이면 insert. 코드 재시도 헬퍼 `withFreshCode` 로 생성·재발급 공용.
  `RoomMemberMapper.setJoinedAt` 은 테스트 전용. 동시 입장 테스트는 @Transactional 롤백 불가라 별도 클래스 + @AfterEach 삭제.
- qa: PASS (QA_REPORT.md 2026-09-15, 개발자 대행) — 실서버 curl 22 스텝 수동 검증 포함.

## T-017 나가기 분기 + 모드 토글 + AI 성격 (api)
- status: DONE
- owner: 개발자
- milestone: M2
- spec: API.md#rooms
- blocked_by: T-016
- acceptance:
  - `DELETE /rooms/{id}` 참여자 → `left_at`, 방 `mode=AI` 복귀. ORPHANED 방에서 참여자 DELETE = 확인 처리(멤버십 종료, 방 행 유지).
  - `PATCH mode`: 멤버 누구나. 활성 멤버 1명인데 `HUMAN` → 400 `MODE_NOT_ALLOWED`.
  - `PATCH aiPersonality`: 개설자만(참여자 403 `FORBIDDEN`), 기본 `RATIONAL`, 언제든 변경. `AiPersonality` enum 에 시스템 프롬프트 문구 보유(어드민 편집 없음).
  - 테스트: 단위 + 통합(권한/상태 전이 표).
- note: 착수 2026-09-15. 확정 — (1) 빈 PATCH body `{}` 400 `VALIDATION_FAILED`, 잘못된 enum 값도 400(`HttpMessageNotReadableException` 핸들러 추가).
  (2) **ORPHANED 방은 어떤 PATCH 도 410 `ROOM_ORPHANED`**. (3) 판정 순서 404 → 400 검증 → 410 → 403 → 400 MODE, 한 요청은 전부-아니면-전무.
  (4) `mode` PATCH 와 참여자 leave 는 방 행 `FOR UPDATE` 로 직렬화(T-016 패턴). (5) 페르소나 문구는 enum 상수 초안 — 코드 수정으로 변경. → API.md#rooms 갱신.
  구현 메모: PATCH body 는 `chatroom/RoomUpdate` record(세 필드 optional, `@Size` 만) — 빈 body·공백 title 은 서비스 `validate` 가 BusinessException 으로.
  `updateTitle` → `update(userId, roomId, RoomUpdate)` 로 교체. `ChatRoomMapper.findByIdForUpdate/updateMode/updateAiPersonality` 추가.
  `GlobalExceptionHandler.handleUnreadable` — 메시지에 본문 값(예: `FOO`) 을 넣지 않는다. 잠금 경합 자체는 별도 동시성 테스트 없음(T-016 과 같은 행 잠금, 판정 경로는 단위 테스트가 덮음).
- test: 16 케이스 신규 — `AiPersonalityTest` 2, `ChatRoomServiceTest` Update 7(UpdateTitle 1 대체)·Leave 2, `ChatRoomControllerIntegrationTest` PATCH 4·DELETE 1,
  `GlobalExceptionHandlerTest` 1. 전체 161 통과(2026-09-15 로컬).
- qa: PASS (QA_REPORT.md 2026-09-15, 개발자 대행) — 실서버 19 스텝 수동 검증 포함. 백로그: Spring 예외 리졸버 WARN 에 잘못된 enum 값 노출(프레임워크 로그).

## T-019 어드민 페르소나 폐지 + 방 AI 프롬프트 편집 (api)
- status: DONE
- owner: 개발자
- milestone: M2
- spec: D-017, API.md#rooms, SCHEMA.md #4/#6
- blocked_by: T-017
- acceptance:
  - `V3__room_ai_prompt.sql`: `chat_rooms.ai_prompt TEXT NULL` 추가, `personas` DROP. `persona/*`·`PersonaMapper.xml`·`ErrorCode.PERSONA_*` 삭제.
  - `PATCH /rooms/{id}` `aiPrompt`: 개설자만(참여자 403), trim 후 1~2,000자(초과 400 `details.aiPrompt`), `""`/공백 = null 초기화, 필드 없음 = 변경 없음. `aiPersonality` 변경 시 `aiPrompt` null. 둘 다 오면 프리셋 → 커스텀 순. ORPHANED 410 유지.
  - Room 응답(목록·상세) `aiPrompt` + `effectiveAiPrompt`(= `aiPrompt` ?? 프리셋 문구). `ChatRoom.effectiveAiPrompt()`.
  - 테스트: `ChatRoomServiceTest` Update(aiPrompt 설정/초기화/길이/권한/프리셋 재선택 시 초기화/동시 전송), 통합 PATCH 2, `MapperTest` ai_prompt round-trip. `ChatApplicationTests` V3 적용.
- note: 착수 2026-09-16. 사용자 결정(D-017): 프리셋 유지 + 커스텀 덮어쓰기, 프리셋 언제든 재선택. web 편집 UI 는 T-008.
  구현 메모: `RoomUpdate.normalizedAiPrompt()`(trim, 빈 문자열 → null). 매퍼 `updateAiPrompt` 는 `jdbcType=VARCHAR` 로 null 바인딩.
  프리셋 재선택 초기화는 서비스에서 `updateAiPersonality` 직후 `updateAiPrompt(null)` — 같은 요청에 `aiPrompt` 가 있으면 그 뒤에 덮어쓴다.
  `ErrorCode.PERSONA_*` 삭제. 로컬 DB 는 Flyway V3 가 `personas` 를 DROP 한다(운영 미배포).
- test: 9 케이스 신규 — `ChatRoomServiceTest` Update 6, `ChatRoomControllerIntegrationTest` PATCH 2, `MapperTest` Rooms 1(ai_prompt round-trip). `MapperTest.Personas` 4 삭제. 전체 166 통과(2026-09-16 로컬).
- qa: PASS (QA_REPORT.md 2026-09-16, 개발자 대행) — 실서버 14 스텝 수동 검증 포함.

## T-007 방 이벤트 SSE + 직렬 큐 + 4:1 컨텍스트 + OmniRoute 클라이언트 (api)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: API.md#messages, D-006, D-018(D-008 보완: 방 단위 서버 잡 + 직렬 큐), D-017
- blocked_by: T-019
- acceptance:
  - `llm/OmniRouteClient` — `omniRouteWebClient`(WebClientConfig) 로 `/chat/completions` `stream=true`, MockWebServer 로 델타 파싱 테스트.
  - `GET /rooms/{id}/events` SSE 구독(멤버만). in-memory `RoomEventBus`(방→emitter 목록, 인스턴스 1대). 이벤트 `message`/`delta`/`done`/`error`/`mode`/`member`. SseEmitter vs Flux 결정 → CONVENTIONS.md.
  - `POST /rooms/{id}/messages` → USER 저장(`sender_user_id`, `mode`) → `touchOnNewMessage` → `message` 브로드캐스트 → 202. HUMAN 모드면 여기서 끝.
  - AI 모드: 방당 직렬 큐(`RoomAiExecutor`, 공용 스레드풀 + 방별 순차). 같은 유저 대기 요청 있으면 409 `ROOM_BUSY`. 두 번째 응답 컨텍스트는 첫 답변 포함.
  - 컨텍스트: `ChatRoom.effectiveAiPrompt()`(D-017) + "개설자 80% / 참여자 20% 가중" 지시 + `findRecentByRoomId(N)` 뒤집기, 각 USER 메시지에 `[개설자 닉]`/`[참여자 닉]` 라벨. HUMAN 모드 대화 포함. 순서·라벨 테스트.
  - 스트림 중 DB 트랜잭션 열어두지 않기. 중단 정책은 D-018 로 확정(취소 없음, 완주·저장). `daily_usage` upsert(발신자 귀속: 전송 시 message_count, done 시 토큰). 풀 포화 503 `AI_BUSY`(ErrorCode·API.md 추가). 대기 중 HUMAN 전환 시 잡 skip.
  - `GET /rooms/{id}/messages?cursor&size`(API.md#messages) 컨트롤러 포함 — 매퍼 `findByRoomId` 재사용, `id` 커서.
  - 제목 자동: 방 `title == "새 대화"` 이고 첫 USER 메시지면 앞 30자(`ChatRoom.autoTitle`).
  - 이 태스크에서 SSE/큐 형식 확정 후 API.md#messages 초안 → 확정.

## T-008 채팅 셸 + 방 생성 + 모드/성격 + 스트리밍 UI (web)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: DESIGN.md#채팅(갱신 필요, 디자이너), API.md#rooms #messages
- blocked_by: T-005, T-007
- acceptance:
  - `app/(chat)/layout.tsx` 사이드바 + 메인. 방 목록(역할·ORPHANED 표시)/선택/제목 수정/나가기. draft 방 폐기 → "+ 새 방" 버튼이 `POST /rooms`.
  - 방 헤더: 멤버 표시, 모드 토글(2명일 때만 활성), AI 성격 선택(개설자만, 프리셋 2개 + 프롬프트 편집 textarea ≤2,000자·초기화 버튼, `effectiveAiPrompt` 표시 — T-019/D-017), 초대 버튼(개설자만 → T-018 공유 시트).
  - `app/lib/sse.ts` EventSource 래퍼 + 이벤트 리듀서 단위 테스트(`message`/`delta`/`done`/`error`/`mode`/`member`, 재연결).
  - 전송 중 본인 입력 비활성(상대는 가능), 409 토스트, 상단 도달 시 이전 페이지.

## T-018 초대 입장 페이지 + QR/링크 공유 + 주인 없는 방 모달 (web)
- status: TODO
- owner: 개발자
- milestone: M2
- spec: API.md#rooms, DESIGN.md(갱신 필요)
- blocked_by: T-008, T-016, T-017
- acceptance:
  - `/join/{code}`: 미로그인 → `/login?next=/join/{code}` 왕복 후 복귀. 미리보기 → 입장 버튼 → `router.replace('/rooms/{id}')`. 404/409/410/400 별 안내.
  - 공유 시트: 코드 표시·복사, URL 복사, QR(클라이언트 라이브러리, 번들 크기 확인), 코드 재발급.
  - ORPHANED 방 진입 시 "이용할 수 없는 채팅방입니다." 모달 → 확인 → `DELETE /rooms/{id}` → 목록에서 제거.
  - 컴포넌트 테스트: 미리보기 상태별 렌더, 모달 확인 호출, 공유 시트 복사.

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
  - `ROLE_ADMIN` 아니면 403. users 목록/상태, stats, rooms/messages 조회. (persona CRUD 는 D-017 로 폐기)
  - 정지 회원 메시지 전송 403. `(admin)` 3개 페이지(users/rooms/stats) 렌더 테스트.

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

## T-015 nginx location 헤더 상속 버그 — /api 경유 시 400 (T-004 리뷰 중 발견)
- status: DONE
- owner: 개발자
- milestone: M1
- spec: 루트 README.md#요청-흐름, D-004
- acceptance:
  - `dev.conf`/`default.conf` 의 `location /api/`, `location /` 안에 Host·X-Real-IP·X-Forwarded-* 를 명시(server 레벨 상속 안 됨).
  - 로컬: `curl http://localhost:3000/api/actuator/health` 200, `/api/oauth2/authorization/kakao` 302 의 `redirect_uri=http://localhost:3000/api/login/oauth2/code/kakao`.
  - 운영: `X-Forwarded-Proto https` 가 실제로 전달되는지 T-012 배포 리허설에서 확인.
- test: 인프라 설정이라 자동 테스트 없음. 로컬 curl 로 확인(2026-09-14). QA 체크리스트로.
- qa: PASS (QA_REPORT.md 2026-09-14). 운영 `X-Forwarded-Proto` 는 T-012 에서.
- note: nginx 규칙 — location 에 `proxy_set_header` 가 하나라도 있으면 server 레벨 `proxy_set_header` 를 전부 버린다.
  T-000 부터 있던 버그. dev 는 `$http_host`(포트 포함) 사용, prod 는 `$host`(443 이라 포트 불필요).

---

## 백로그 (마일스톤 미배정)
- 방별 AI 장기 메모리(`ai_memory` 개설자 발화 위주 요약) — 컨텍스트 윈도우 밖 과거 학습
- AI 성격 문구 어드민 편집(현재는 `AiPersonality` enum 고정)
- 2인 방 보이스 모드 동시 사용 시 TTS 재생 충돌 처리(모두 허용 결정, M3 에서 확인)
- 방 검색
- 메시지 복사/재생성(regenerate)
- TTS 응답 스트리밍(문장 단위 선재생)
- 토큰 기준 컨텍스트 윈도우(D-006 open)
- 사용량 일일 상한 + 어드민 알림(D-007 open)
- `MapperTest` 를 `@MybatisTest` 슬라이스로 전환(속도) — Boot 4 `AutoConfigureTestDatabase` 패키지 확인 후
- 잘못된 percent-encoding 쿼리스트링(Tomcat `InvalidParameterException`) 500 → 400 `VALIDATION_FAILED` 매핑(T-006 QA 발견)
