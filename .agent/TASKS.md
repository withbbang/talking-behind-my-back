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
- **SSE(SseEmitter) + Spring Security 는 `dispatcherTypeMatchers(ASYNC, ERROR).permitAll()` 필수.** 클라이언트가 끊기면 톰캣이 ASYNC/ERROR 로 재디스패치하는데
  `OncePerRequestFilter` 인증 필터는 그걸 건너뛰어 익명 → 끊길 때마다 "response already committed" ERROR 스택(T-007 QA). 구독 직후 `: connected` 주석으로 헤더를 바로 커밋할 것.
- **vitest `beforeEach(() => mock.mockReset())` 처럼 화살표가 mock 을 반환하면 vitest 가 그 반환값을 cleanup 훅으로 호출한다** → 인자 없는 유령 호출. 항상 중괄호 블록으로.
- **React Query 5 `mutateAsync` 거절은 훅의 `onError` 정리보다 먼저 전달될 수 있다.** 실패 후 캐시 상태 단언은 `waitFor`.
- **Spring Security 7 OAuth2 클래스는 Homepage/Admin 에 참고코드가 없다.** `javap -cp <jar>` 로 시그니처 확인 후 사용(`~/.gradle` 에서 찾을 때 `-javadoc`/`-sources` jar 제외).
  `InvalidClientRegistrationIdException` 은 package-private(IllegalArgumentException 하위).
- **MyBatis XML 안 SQL 의 `<>` 는 XML 파싱 오류.** `!=` 로. `bootRun` 중 `gradlew test` 를 돌리면 devtools 가 재시작하는데 그때 리소스가 깨져 있으면 앱이 죽은 채 남는다 — 고친 뒤 bootRun 재기동.
- **RTL `getByText` 는 한 `<p>` 안에서 `<br/>` 로 나뉜 줄을 못 잡는다.** 여러 줄 카피는 줄마다 `<span className="block">`.
- **외부 AI 호출(LLM·STT·TTS)은 전부 OmniRoute 경유가 기본.** 새 외부 API 를 붙일 때 "직접 호출" 로 설계하지 말고 OmniRoute `/v1/*` 지원부터 확인(T-009 에서 OpenAI 직접 호출로 갔다가 되돌림). 로컬 OmniRoute 에 `curl -X POST … /v1/<path>` 로 404 인지 400 인지 보면 안다.
- **hydration 전 인라인 스크립트로 React 가 렌더한 `<meta>`/`<title>` 을 바꾸면 React 19 가 hoistable 매칭에 실패해 같은 태그를 하나 더 꽂는다**(T-020 theme-color 중복 실측). 첫 페인트 전엔 `<html>` 속성만 건드리고 메타는 마운트 후 갱신. `'use client'` 모듈의 문자열 상수를 서버 컴포넌트(layout)에서 import 하면 클라이언트 참조가 되니 상수는 지시어 없는 모듈로 분리.
- **업로드 상한 실측 파일은 26,214,401B 이상.** "26MB" 를 26,000,000B 로 만들면 25MiB 미만이라 nginx(25m)·Boot(25MB) 를 통과해 공급자까지 갔다가 502 가 난다(T-009 QA).
- **`MediaRecorder.stop()` 은 `stop` 이벤트가 비동기라 자동 종료 트리거가 둘(VAD·상한)이면 두 번 불려 InvalidStateError.** finish 결과 Promise 를 세션에 저장해 한 번만(T-026). 공유 Promise 에 `.finally()` 를 붙이면 거절이 한 번 더 unhandled 로 새니 `.then(after, after)` 로.
- **React Compiler ESLint 는 훅이 돌려준 객체 안에 `xxxRef` 가 있으면 그 객체 접근 전부를 "refs during render" 로 잡는다.** 훅 반환값은 호출부에서 `const { open, menuRef } = useMenu()` 로 구조분해(T-030).
- **zustand 스토어 모듈을 고친 뒤엔 실측 전에 하드 리로드.** Fast Refresh 가 모듈을 다시 평가하면 스토어 인스턴스가 새로 생기는데 마운트된 화면은 옛 인스턴스를 구독한다 → 스토어를 바꾸는 코드가 "안 먹는" 것처럼 보인다(T-032 오류 말풍선 실측, 리로드 후 정상).
- **스토어 단위 테스트는 "화면에서 사라지는지" 를 보증하지 않는다.** 상태를 지우는 동작은 컴포넌트 수준 테스트(DOM 에서 없어지는지)까지 같이 둘 것(T-032).
- **macOS Safari 는 버튼을 클릭해도 포커스를 주지 않는다** → 메뉴/팝업을 `focusout` 으로 닫으면 `relatedTarget: null` 이 와서 click 전에 닫히고 항목이 안 눌린다(T-032 실측, Chrome·Firefox 는 통과). `relatedTarget` 이 null 인 focusout 은 무시하고 바깥 클릭은 `pointerdown` 으로 판정할 것.
- **Tailwind `group-hover:` 는 조상 중 어떤 `.group` 이든 hover 면 매칭된다** — `.group` 을 중첩하면 안쪽 툴팁이 전부 같이 켜진다(T-032 실측). 여러 개가 필요하면 named group(`group/x`) 이거나 상태로 하나만 그린다. `overflow-y-auto` 컨테이너는 x축도 auto 라 절대배치 말풍선이 넘치면 가로 스크롤바가 생긴다.
- **컴포넌트를 `vi.mock` 으로 스텁하면 그 경로는 테스트가 없는 것과 같다** — `ChatShell.test.tsx` 가 Sidebar 를 스텁해 "프로필 메뉴 → 설정" 이 한 번도 검증되지 않았다. 스텁은 격리 목적에만 쓰고, 실제 조립을 확인하는 통합 테스트를 따로 둘 것.
- **Gemini 는 컨텍스트가 assistant 턴으로 끝나면 400 `Requests ending with a model turn are not supported`.** 2인 방에서 각자 AI 와 대화하면
  상대 잡이 먼저 끝나 내 질문 뒤에 행이 쌓인다 — AI 잡은 **자기 트리거 메시지 id 까지만** 읽어야 한다(T-031 실측). 답 상대가 바뀌는 혼선도 같은 원인.
- **MySQL 은 UPDATE 대상 테이블을 서브쿼리에서 다시 읽지 못한다**(파생 테이블로 감싸도 머지되면 1093). 백필은 `CREATE TEMPORARY TABLE … AS SELECT` 로 한 번 끊고 JOIN UPDATE(T-031 V4). 빈 DB 에서는 백필이 0행이라 "성공"만 보이니 더미 데이터를 넣어 결과를 눈으로 확인할 것.
- **`docker exec -i mysql < file.sql` 은 한글이 깨져 1064**(클라이언트 charset 기본값). `--default-character-set=utf8mb4` 를 붙인다.
- **포커스된 엘리먼트를 `disabled` 로 만들면 브라우저가 포커스를 뗀다**(다시 활성화해도 복원 안 됨) — 전송 직후 잠기는 입력창·값이 비면 disabled 되는 전송 버튼 둘 다 해당(T-034). 잠금으로 가리는 UI 는 "풀릴 때 포커스를 어디로 돌려줄지" 를 같이 정할 것. **jsdom 은 이 blur 를 흉내내지 않으니** 테스트에서 `el.blur()` 로 그 지점을 직접 재현해야 한다.
- **thinking 모델(Gemini 2.5 `*-latest`)은 스트리밍에서 본문이 빈다** — 추론에 토큰을 다 씀. 요청에 `reasoning_effort:"none"`(옵션 `LLM_REASONING_EFFORT`) 을 실어 끈다. OmniRoute 게이트웨이는 무료지만 뒤 공급자(Gemini 무료)는 rate limit 이 낮아 연타 시 429/빈 응답(D-031).
- **"로그에 안 찍힌다" 는 응답 단언으로 검증되지 않는다** — logback `ListAppender` 를 핸들러 로거에 붙여 레벨을 단언한다(T-033). api 로그를 실측할 땐 사용자 bootRun(:8080)을 건드리지 말고 `ps` 에서 뽑은 같은 클래스패스로 `java -Dserver.port=8081 … ChatApplication` 두 번째 인스턴스를 띄워 로그를 파일로 받는다. **클라이언트 끊김은 다음 하트비트(20초) 쓰기 시점에야 예외로 드러난다** — 끊고 바로 로그를 보면 아직 없다.
- **GH Actions `vars.*` 는 Settings → Secrets and variables → Actions 의 Repository variables 탭에 있어야 읽힌다.** Secrets 탭이나 Environment 범위(job 에 `environment:` 없음)에 넣으면 빈 문자열 → `ghcr.io/owner/-api` invalid reference (T-012, master push 10회 실패). 레포명 폴백(`vars.X || github.event.repository.name`)을 둬서 없어도 돌게 했다.
- **Synology 비대화형 SSH(GH Actions·`ssh host cmd`)는 PATH 에 `/usr/local/bin` 이 없고, `docker.sock` 은 root:root 660 + docker 그룹 없음, `visudo`·SFTP 없음.** deploy 스크립트는 `export PATH=/usr/local/bin:$PATH` + `sudo -n docker`(sudoers.d NOPASSWD), Mac 에서 파일 올릴 땐 `scp -O`(레거시 프로토콜). `ls -l` 모드 비트는 보는 계정의 ACL 유효권한으로 합성돼 계정마다 다르게 보인다 — 실제 권한은 `synoacltool -get`(T-012).
- **DSM 방화벽은 도커 브리지 안 컨테이너끼리 트래픽도 FORWARD 체인에서 걸러 DROP 한다**(`bridge-nf-call-iptables=1`). 증상: 같은 compose 인데 DNS 는 풀리고 TCP 는 timeout. 제어판 → 보안 → 방화벽에 소스 `172.16.0.0/255.240.0.0` 허용 규칙을 DROP 위에(T-012).
- **compose env_file 은 값이 빈 줄의 인라인 `# 주석` 을 값으로 넣는다**(값이 있으면 잘라냄). `LLM_REASONING_EFFORT=   # ...` 가 그대로 Gemini 로 가서 400. 빈 값 줄엔 주석을 윗줄로(T-012, `.env.example` 반영).
- **bind mount 는 컨테이너 유저 소유여야 한다 — 이미지의 chown/tmpfs `mode=` 는 마운트에 안 먹는다.** omniroute(node 1000)는 storage.sqlite 를 못 써 설정이 메모리에만 남고, api tmpfs `/tmp/audio` 는 root 755. 해결: 배포 시 `docker run alpine chown 1000:1000`, tmpfs 는 `uid=100,gid=101`(T-012).

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
- status: DONE
- owner: 개발자
- milestone: M2
- spec: API.md#messages, D-006, D-018(D-008 보완: 방 단위 서버 잡 + 직렬 큐), D-017, D-019(세부)
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
- test: 44 케이스 신규 — `llm/OmniRouteClientTest` 6(MockWebServer), `message/{AiContextBuilderTest 5, RoomEventBusTest 6, RoomAiExecutorTest 5, MessageServiceTest 12, MessageControllerIntegrationTest 10}`, `MapperTest` +3(Usage 1, AllMembers 1, findById), `ChatRoomServiceTest.Events` 5. 전체 217 통과(2026-09-16 로컬).
- qa: PASS (QA_REPORT.md 2026-09-16, 개발자 대행) — 실서버 29 스텝(fake OmniRoute) 수동 검증. QA 중 발견 2건(ASYNC/ERROR 디스패치 401 ERROR 로그, 구독 직후 헤더 미커밋) 같은 태스크에서 수정.
- note: 구현 메모 — 큐는 `RoomAiExecutor.reserve()`(409/503 판정) → tx 저장 → `Ticket.start()` 순서. 저장 뒤 409 를 내면 중복 저장이 남아서 예약을 먼저 한다.
  `mode`/`member` 이벤트는 `ChatRoomService` 가 트랜잭션 안에서 바로 발행(afterCommit 훅은 테스트 롤백 트랜잭션에서 안 돈다).
  `RoomEventBus.subscribe(roomId, emitter)` 공개 오버로드는 테스트 mock 주입용. `daily_usage` 매퍼는 `message` 패키지(admin/speech 도 여기 것을 쓴다).
  가중 지시는 참여자가 한 번도 없던 방에는 안 붙는다(이름 자리가 비어서). 환경변수 `AI_CORE_THREADS/AI_MAX_THREADS/AI_QUEUE_SIZE` 는 기본값 있음 — NAS .env 반영 선택.
  후속: T-008 `lib/sse.ts` 는 `replyTo` 로 델타 매칭, 재연결 시 `GET messages` 보충. 수평 확장 시 RoomEventBus → Redis.

## T-008 채팅 셸 + 방 생성 + 모드/성격 + 스트리밍 UI (web)
- status: DONE
- owner: 개발자
- milestone: M2
- spec: DESIGN.md#2~3 #6, BRAND.md, API.md#rooms #messages
- blocked_by: T-005, T-007
- acceptance:
  - `app/(chat)/layout.tsx` 사이드바 + 메인. 방 목록(역할·ORPHANED 표시)/선택/제목 수정/나가기. draft 방 폐기 → "+ 새 방" 버튼이 `POST /rooms`.
  - 방 헤더: 멤버 표시, 모드 토글(2명일 때만 활성), AI 성격 선택(개설자만, 프리셋 2개 + 프롬프트 편집 textarea ≤2,000자·초기화 버튼, `effectiveAiPrompt` 표시 — T-019/D-017), 초대 버튼(개설자만 → T-018 공유 시트).
  - `app/lib/sse.ts` EventSource 래퍼 + 이벤트 리듀서 단위 테스트(`message`/`delta`/`done`/`error`/`mode`/`member`, 재연결).
  - 전송 중 본인 입력 비활성(상대는 가능), 409 토스트, 상단 도달 시 이전 페이지.

- test: web 33 파일 168 케이스(`npm test`, QA 중 결함 수정으로 166→168). 신규: lib/{time,sse}, components/ui 7종, components/chat 8종, features/rooms 5훅, features/messages(cache·streamStore·useMessages·useSendMessage·useRoomEvents·sendErrorMessage), (chat)/RootRedirect. `npm run lint`(0 error) · `typecheck` · `build` 통과.
- note: 착수 2026-09-16, 커밋 4개(a7990c1 → fa9d996 → e99757c → 9465b38). 사용자 결정 D-020(draft 폐기, `/` 최신 방 이동, 토스트 스펙 통일, phosphor 아이콘, 시간 표기). 테마 수동 선택은 T-020.
  구현 중 판단(디자이너 확인 요청 to-designer): 목록 API 에 members 가 없어 참여자 보조 줄은 "초대받은 방", 2인 방 목록 아바타는 Users 아이콘, mode AI 복귀 시스템 라인 "AI 다시 귀 열었다", 사이드바 다음 페이지는 하단 도달.
  ORPHANED 방은 입력창 잠금까지만(확인 모달 + DELETE 는 T-018). 초대 시트 진입(RoomHeaderSheet onInvite)은 T-018 연결.
  실브라우저 검증 완료(QA_REPORT.md 2026-09-16): 로컬 compose+bootRun+`npm run dev` 로 로그인 세션·2인 방 SSE 라이브 반영·모드/성격 편집·나가기까지 확인.
  검증 중 결함 2건 발견 즉시 수정(TDD RED→GREEN): (1) 첫 메시지 자동 제목이 헤더에 반영 안 됨 — 방 상세 쿼리 무효화 누락 → `useSendMessage`/`useRoomEvents` 수정.
  (2) 사이드바에서 다른 방을 나가면 보고 있던 방에서 강제 이동 → `useLeaveRoom` 이 지금 보는 방일 때만 이동하도록 수정. 테스트 166 → 168.
  나간 멤버의 과거 메시지가 "나간 사람" 으로 표시되는 API 계약 공백 발견 → T-021 참조.
- qa: PASS (QA_REPORT.md 2026-09-16, 사용자 지시로 QA 대행 기록 + 실브라우저 검증)

## T-021 메시지에 발신 당시 닉네임 보존 (api + web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-16, 사용자 지시로 QA 대행 — 실서버 curl + 내장 브라우저 2계정 실측)
- owner: 개발자
- milestone: M2
- spec: API.md#messages, QA_REPORT.md#T-008
- blocked_by: T-008
- acceptance:
  - 멤버가 방을 나간 뒤에도 그 사람이 보낸 과거 메시지의 발신자 표시가 실명(닉네임)으로 유지된다(현재는 "나간 사람"으로 소급 표시됨).
  - API 계약 변경(먼저 API.md, 그다음 코드): 예) `Message` 응답에 발신 당시 닉네임을 싣거나, 방 상세가 나간 멤버를 포함한 스냅샷을 함께 내려준다. 방식은 착수 전 제안 → 선택.
  - web `MessageList`/`RoomHeaderSheet` 가 이 값을 우선 사용하도록 갱신, 현재 멤버 목록으로 되돌아가는 폴백은 유지.
- note: T-008 QA(2026-09-16) 중 실브라우저에서 발견. 서버 LLM 컨텍스트는 이미 나간 멤버 라벨을 유지하는데(D-019) 화면 표시만 어긋나 있었다.
- test: api `MessageControllerIntegrationTest.History` +1(나간 멤버 메시지 senderNickname 유지·ASSISTANT null), 전체 244 통과.
  web `MessageList.test` +2(senderNickname 우선 / null 이면 멤버 폴백), 전체 40 파일 223 통과, lint 0 오류(기존 경고 1), typecheck·build 통과(2026-09-16 로컬).
  착수 2026-09-16, 방식은 D-023(A안: `Message.senderNickname` 읽기 시 users JOIN, 스키마 변경 없음).
  구현 메모: `MessageMapper.xml` 조회 3종(`findById/findByRoomId/findRecentByRoomId`)이 `LEFT JOIN users` 로 `sender_nickname` 을 채운다. 전송 직후 SSE `message`/`done` 은 이미 `findById` 재조회라 자동 포함.
  web `buildRows.nameOf` 우선순위 senderNickname → `room.members` → "나간 사람". `RoomHeaderSheet` 는 활성 멤버 목록이라 변경 없음. 낙관적 임시 메시지는 `senderNickname: null`(본인 말풍선이라 이름 미표시).

## T-022 OAuth 로그인 `next` 복귀 + 미리보기 `alreadyMember` (api)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-16, 사용자 참여 Playwright QA)
- owner: 개발자
- milestone: M2
- spec: API.md#auth #rooms, D-021
- blocked_by: T-016
- acceptance:
  - `GET /oauth2/authorization/{provider}?next=/join/K7Q2M9XW` → authorization request attribute `next` 로 보관(서명 쿠키 저장소 경유) → 콜백 성공 시 `APP_BASE_URL/join/K7Q2M9XW` 로 302. `next` 없으면 `/`.
  - 불량 `next` 는 무시하고 `/`: 절대 URL(`http://…`), `//evil`, `\`, 개행, `/` 로 안 시작, 200자 초과.
  - `GET /rooms/join/{code}` 응답에 `alreadyMember: boolean`(활성 멤버면 true). 기존 필드 불변.
  - 테스트: `NextPath` 정제 단위, resolver 가 attribute 를 싣는지, 성공 핸들러 redirect(정상/없음/불량), 미리보기 `alreadyMember` 서비스+MockMvc.
- test: 신규 `NextPathTest` 3(파라미터화 13건 포함), `NextPathAuthorizationRequestResolverTest` 4, `OAuth2HandlersTest` +2,
  `AuthFlowIntegrationTest.OAuth2Entry` +1(실제 필터 체인 → 서명 쿠키 attribute), `ChatRoomServiceTest.Preview` +1·수정 2, 통합 jsonPath +1. 전체 240 통과(2026-09-16 로컬).
- note: T-018 착수 협의(2026-09-16)에서 분리. web 쿠키 방식 기각 사유는 D-021.
  구현 메모: `NextPath.sanitize`(상대경로 정규식, ≤200자) → `NextPathAuthorizationRequestResolver` 가 attribute 로 → `CookieOAuth2AuthorizationRequestRepository` 가 attributes 를 서명 쿠키로 왕복 →
  `OAuth2SuccessHandler` 가 콜백 요청 쿠키에서 `loadAuthorizationRequest` 로 다시 읽는다(필터의 remove 는 응답 헤더만 쓰므로 요청 쿠키는 남아 있음).

## T-018 초대 입장 페이지 + QR/링크 공유 + 주인 없는 방 모달 (web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-16, 사용자 참여 Playwright QA — 구글 next 왕복·입장·초대 시트·ORPHANED 2경로 실측)
- owner: 개발자
- milestone: M2
- spec: API.md#rooms #auth, DESIGN.md#4~6, D-021
- blocked_by: T-008, T-016, T-017, T-022
- acceptance:
  - `proxy.ts`: 미인증 보호 경로 → `/login?next=<원경로>`(`/login` 자체·`/` 는 next 없음). 로그인 화면은 `next` 를 소셜 버튼 href `?next=` 로 전달, silent refresh 성공 시에도 `next` 로 이동. 불량 `next`(상대경로 아님)는 버림.
  - `/join/{code}`: 미리보기(`alreadyMember` 로 "들어갈래"/"다시 들어가기") → 입장 → `router.replace('/rooms/{id}')`. 404/409×2/410/400 별 안내(BRAND 표) + 보조 버튼 "내 방으로". 네트워크·기타 오류는 "삐끗했다. 다시 해볼까?" + 다시.
  - 공유 시트(개설자, 방 헤더 시트 "초대" 에서 진입): 코드 4+4 표시·복사(8자), 링크 복사, QR(`uqr` 행렬 → 둥근 모듈 SVG, 라이트 토큰 고정 카드), `navigator.share` 있으면 "공유하기", 코드 재발급(확인 모달 → `POST invite/regenerate` → 시트 갱신).
  - ORPHANED 모달: 캐시 `room.status` 단일 트리거(D-021). 참여자에게만. "알았어" → `DELETE /rooms/{id}` → 목록에서 제거 → `/`. 전송 410 은 캐시 status 갱신(토스트 제거).
  - 테스트: `proxy`(next 부여/불량 무시), `LoginClient`(next 전달), `JoinClient` 상태별 렌더·입장·오류, `InviteSheet` 복사·공유 조건부·재발급, `QrCode` 행렬→rect, `OrphanedDialog`+`RoomView` 트리거·확인 호출.
- test: 신규 `lib/nextPath` 14, `lib/josa` 2, `features/rooms/joinErrorMessage` 6, `features/rooms/useInvite` 3, `(auth)/join/[code]/JoinClient` 8, `ui/QrCode` 2, `chat/InviteSheet` 6;
  수정 `proxy` +5, `LoginClient` +2, `ChatShell` +1, `RoomView` +3, `sendErrorMessage` 410→null. 전체 40 파일 219 통과, lint 0 오류(기존 경고 1), typecheck·build 통과(2026-09-16 로컬).
  브라우저(nginx :3000): 미인증 `/join/K7Q2M9XW` → `/login?next=%2Fjoin%2FK7Q2M9XW`, 소셜 링크 3개 `?next=` 부착 확인. 로그인 이후 화면은 실소셜 로그인이 필요해 QA 로.
- note: 착수 2026-09-16, 결정은 D-021. 구현 메모: `lib/nextPath.safeNextPath` 는 api `NextPath` 와 같은 정규식(양쪽 동시 수정).
  `InviteSheet` 는 `room.inviteCode` 가 있을 때만(개설자) 마운트, `memberCount < 2` 조건으로 친구가 들어오면 저절로 닫힘.
  ORPHANED 모달은 `RoomView` 가 `status === 'ORPHANED' && role === 'PARTICIPANT'` 로만 판단 — `useSendMessage` 410 은 캐시 status 만 바꾼다.
  `JoinClient` 소개문 조사(이/가)는 `lib/josa.iGa`(받침 판정, 비한글은 병기). `uqr` 0.1.3 추가(의존성 0).

## T-023 같은 두 사람은 활성 방 1개만 — 입장 거절 (api + web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-16, 사용자 참여 Playwright QA — 2계정으로 PAIR 거절·쌍 해소 후 입장 실측)
- owner: 개발자
- milestone: M2
- spec: D-022, API.md#rooms
- blocked_by: T-016, T-018
- acceptance:
  - `GET/POST /rooms/join/{code}`: 입장자와 방 개설자가 이미 다른 ACTIVE 방에서 같은 쌍이면 409 `PAIR_ROOM_EXISTS`(코드명은 D-022 확정값). 같은 방 재입장은 200.
  - 판정 순서 404 → 410 → 400 SELF → 이미 멤버 200 → 409 PAIR → 409 FULL → 409 LIMIT. 미리보기도 PAIR 까지.
  - API.md 입장 실패 표 갱신(먼저), `ErrorCode` 추가, `RoomMemberMapper` 쌍 조회 쿼리(MyBatis XML), 서비스 단위 + MockMvc 통합 테스트.
  - web: `joinErrorMessage` 에 코드 한 줄 + BRAND.md#5 문구, `JoinClient` 테스트 1건.
- test: api `ChatRoomServiceTest.Join` +3, `ChatRoomControllerIntegrationTest` jsonPath +1(243 통과) / web `joinErrorMessage` +1(221 통과). 2026-09-16 로컬.
- note: 2026-09-16 T-018 착수 대화에서 사용자 요건, 같은 날 세부 4건 제안값 그대로 확정(D-022). 구현: `RoomMemberMapper.countActiveRoomsShared`(쌍·ACTIVE·현재 방 제외) → `checkJoinable` 에 `pairExists` 인자.

## T-024 빈 방 상태가 시스템 라인을 가림 (web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-16, 단위 + 실브라우저 "빵선 등장!" 실측)
- owner: 개발자
- milestone: M2
- spec: DESIGN.md#3 빈 방, QA_REPORT.md#T-018 issues
- blocked_by: T-018
- acceptance:
  - 메시지 0개라도 시스템 라인(`notices`: 등장/퇴장/모드)이 있으면 빈 상태 대신 목록(시스템 라인)을 보여준다.
  - `RoomView` 테스트: 메시지 0 + notice 1 → "오늘은 누가 그랬어?" 없음, 라인 표시.
- test: `RoomView.test.tsx` +1. 수정은 `RoomView.tsx` `empty` 판정 한 줄(`stream.notices.length === 0` 추가).
- note: T-018 Playwright QA(2026-09-16)에서 발견. DESIGN.md#3 빈 방 문구 개정(디자이너 대행, 사용자 결정).

## T-025 UI 문구 전면 개정 — 사용자 수정안 반영 (web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-17, Playwright 390 실브라우저 + 단위 240)
- owner: 개발자
- milestone: M2
- spec: `.agent/inbox/copy-inventory.md`(수정안 열), D-025, BRAND.md#5
- blocked_by: T-008, T-018
- acceptance:
  - copy-inventory.md 의 `수정안` 이 비어 있지 않은 행은 전부 그 문구로 교체, 빈 행은 원안 유지.
  - 공용 오류 문구 "삐끗했다. 다시 해볼까?" → "시스템 오류. 다시 시도해줄래?" 전면 교체(`lib/copy.ts` 상수 한 곳).
  - 서버 메시지 그대로 노출하던 토스트(전송 400, PATCH·나가기·재발급 실패)는 web 문구로 덮는다. `MODE_NOT_ALLOWED` 는 전용 문구.
  - "주인" → "방장"(배지·ORPHANED 문구). 입장 버튼은 `alreadyMember` 무관 "들어가기". 확인 모달 제목 `\n` 줄바꿈 지원.
  - `lib/josa.ts` 는 입장 소개문이 "{닉}의 방" 으로 바뀌어 미사용 → 삭제.
  - 기존 테스트 문구 갱신 + 신규 케이스(400 매핑, MODE_NOT_ALLOWED, 두 줄 제목). `npm test` · lint · typecheck 통과.
- test: 기존 테스트 18파일 문구 갱신 + 신규 2(ConfirmDialog 두 줄 제목, RoomHeaderSheet 비-MODE 오류 → 공용 문구), `josa.test.ts` 삭제. 전체 240 통과 + lint 0 errors + typecheck + build(2026-09-17 로컬).
- note: 인박스 "T-008 구현 중 판단 4건" 의 처리. BRAND.md#5 표·DESIGN.md 문구 갱신은 to-designer.md 로 요청(디자이너 write).
  구현 메모 — JSX 속성 문자열은 `\n` 이스케이프를 안 푼다(`title="a\nb"` 는 역슬래시 n 그대로) → `title={'a\nb'}`. RTL `getByText` 는 노드 텍스트만 정규화하고 매처 문자열은 안 하므로 줄바꿈 문구는 공백으로 적어 찾는다.

## T-020 테마 수동 선택(라이트/다크/시스템) (web)
- status: DONE
- qa: PASS (QA_REPORT.md 2026-09-17, 단위 240 + 실브라우저 데스크톱·모바일 드로어)
- owner: 개발자
- milestone: M2
- spec: DESIGN.md#원칙·#2 사이드바, BRAND.md#2, D-020, D-024
- blocked_by: T-008
- acceptance:
  - 사이드바 하단 프로필 영역에 테마 선택(시스템/라이트/다크). 선택은 `localStorage` 에 저장, 첫 페인트 전 `<html data-theme>` 적용(깜빡임 없음).
  - `globals.css` 토큰이 `prefers-color-scheme` 외에 `[data-theme]` 로도 반전. `themeColor` 메타 동기화.
  - 단위 테스트: 저장/복원/시스템 추종 전환.
- test: `lib/theme.test.tsx` 13 · `ThemePicker.test.tsx` 3 · `Sidebar.test.tsx` +1. web 240 통과, lint 0 error, typecheck·build 통과.
- note: 사용자 요청 2026-09-16(T-008 착수 대화). 착수 2026-09-16, D-024(A안: 프로필 줄 아래 글자 필 3칸, 보조 라벨 없음, 고정 용어). DESIGN.md/BRAND.md 개정은 디자이너 대행(사용자 지시).
  구현: `lib/themeInit.ts`(상수 + 인라인 스크립트, 서버 안전) / `lib/theme.ts`(useSyncExternalStore 스토어, applyTheme, ThemeSync) / `components/chat/ThemePicker.tsx` / `layout.tsx`(next/script beforeInteractive + `<ThemeSync/>`, viewport.themeColor 제거) / `globals.css`(`[data-theme]` 셀렉터).
  실브라우저 2026-09-17(구글 계정 `상남자`, OS 다크, bootRun + nginx-dev): 데스크톱 1134 — 필이 로그아웃 줄 아래 우측(사이드바 280 안, 32px, 활성 600). 다크 탭 → 즉시 반전(bg #170611, surface #ff3d7f), 저장 `dark`, 메타 1개 #170611. 새로고침·방 재진입 유지. 시스템 탭 → 키 삭제, OS 다크 따라감. 방향키 이동 + 포커스 링 accent 2px. 초대 시트 QR 카드 다크에서도 #fff4f8 바탕 + 어두운 모듈. 모바일 375 드로어(폭 300) 안 같은 위치, 하단 잘림 없음, 드로어에서 라이트 탭 → 반전.
  알려진 것(범위 외, PillToggle 기존 동작): 방향키로 값은 바뀌지만 DOM 포커스는 원래 칸에 남는다(모드 토글도 동일). 원하면 별도 T.

## M3 음성

## T-009 STT/TTS Provider + 엔드포인트 (api)
- status: DONE
- owner: 개발자
- milestone: M3
- spec: API.md#speech, D-007
- blocked_by: T-002
- acceptance:
  - `speech/SttProvider`·`TtsProvider` + `omniroute/*` 구현(D-027, 원안 `openai/*`) + `clova/*` 스텁. `SpeechProperties`(app.speech.*) + provider 선택 `@ConditionalOnProperty`.
  - `/speech/stt` multipart → `app.speech.tmp-dir` 저장 → 변환 → 삭제(테스트로 확인). 길이 상한 → `AUDIO_TOO_LONG`.
  - `/speech/tts` 텍스트 상한(`max-tts-chars`) → `TEXT_TOO_LONG`, `audio/mpeg` 반환. `daily_usage.stt_seconds/tts_chars` 갱신.
- qa: PASS (QA_REPORT.md 2026-09-18, 개발자 QA 대행 — 292 테스트 재실행 + nginx 경유 STT/TTS·상한·413·502·401/403 실측)
- test: `speech/SpeechServiceTest`(14, fake 공급자·@TempDir 로 저장→삭제·상한·사용량·duration 폴백·502 매핑), `omniroute/OmniRouteSttProviderTest`(5)·`OmniRouteTtsProviderTest`(3, MockWebServer),
  `SpeechControllerIntegrationTest`(12, 실제 SecurityConfig + FakeSpeechTestConfig: 401/403/200/400×3/502·헤더·usage 행), `SpeechProviderSelectionTest`(1, clova 스텁 선택), MapperTest usage +1.
  api 전체 280 통과(2026-09-17 로컬, compose MySQL). 실제 OmniRoute 왕복은 대시보드에 STT/TTS 공급자 자격증명이 있어야 해 미실측 — QA 체크리스트.
- note: D-026·D-027·D-028. 코드 리뷰(2026-09-18) 반영: Tomcat `multipart.location`=tmp-dir(tmpfs), tmp-dir 절대경로·기동 시 생성, 파라미터 타입 불일치 400 핸들러(기존 `size` 파라미터 500 도 같이 해소), 음수 durationMs 400, `tts-voice` 빈 값 기동 실패, edge-tts digest 고정. 초안은 OpenAI 직접 호출이었으나 사용자 지적으로 OmniRoute `/v1/audio/*` 경유로 정정(로컬 3.8.50 에서 경로 동작 확인). 공급자는 무료로 확정: STT Groq(대시보드 연결 완료), TTS edge-tts 사이드카(OmniRoute OpenAI 호환 노드 `edge`, 로컬 등록 완료). OmniRoute 경유 실측 2026-09-17: STT 200 정확 전사, TTS 200 mp3. `durationMs` 는 클라이언트 힌트(공급자 호출 전 차단) + 공급자 보고 길이(호출 후 재검사) 이중 검사, 공급자가 길이를 안 주면 클라이언트 값으로 집계. 파일 확장자는 content-type 으로 정한다(OpenAI 가 확장자로 포맷 판별, iOS `audio/mp4` → `.mp4`).
  `audio` 파트 누락은 `required=false` 로 받아 서비스에서 VALIDATION_FAILED(details.audio) — required 로 두면 MissingServletRequestPart 가 500 으로 샌다.
  Clova 는 빈만 뜨는 스텁(호출 시 502). 실구현은 필요해지면 별도 T.

## T-010 듣기/말하기 버튼 + 보이스 모드 루프 (web)
- status: REVIEW
- owner: 개발자
- milestone: M3
- spec: DESIGN.md#보이스-모드, API.md#speech
- blocked_by: T-008, T-009
- acceptance:
  - `app/features/speech/useRecorder` (MediaRecorder, iOS Safari mime 분기) 훅 테스트.
  - 메시지별 듣기 → TTS 재생 큐. 마이크 → STT → `inputType: 'VOICE'`.
  - 보이스 모드 상태 머신(idle→recording→transcribing→streaming→speaking→recording) 순수 함수 + 테스트.
  - 권한 거부/네트워크 오류 시 텍스트 입력으로 복귀.
- test: 신규 web 79건(전체 `npm test` 319 passed / 52 files, lint 0 error·기존 경고 1, typecheck·build 통과).
  순수/훅: `features/speech/voiceMachine`(11, 상태 전이·turn·2인 방 replyTo 필터), `splitForTts`(6), `mime`(4), `speechApi`(3), `ttsPlayer`(7, 큐·중단·unlock),
  `useRecorder`(6, MediaRecorder fake·권한 거부·60초 자동종료), `useTts`(4), `useVoiceMode`(10, 루프·denied·빈결과·409·2인 방·exit·active off).
  컴포넌트: `components/voice/ListenButton`(3), `VoiceModeOverlay`(8, 단계별 활성·라벨 aria-live·denied/error 카드), `Composer.voice`(8, 마이크 흐름·즉시 전송·60초),
  `ChatShell`(+2, 토글 노출 조건), `RoomView`(+4, 오버레이 연결·HUMAN 전환·VOICE POST), `MessageBubble`(+1), `lib/api`(+2 apiFetchBlob).
  실측 미수행: 브라우저 pane 에 마이크 없음(getUserMedia 불가) + api 는 OAuth 쿠키 필요(T-009 와 동일 제약). STT/TTS 백엔드 왕복은 T-009 에서 실측 완료. 실기기 음성 루프는 T-013.
- note: 2026-09-18 착수(D-029: 말풍선 오브·STT 즉시 전송·CSS 모션·토글 노출 조건·2인 방 충돌·60초 상한·iOS unlock). 체감 보강(VAD 자동 종료·문장 단위 TTS 선재생)은 → T-026 참조 (D-026). 이 태스크는 DESIGN.md#7 상태 머신까지.

## T-026 보이스 모드 체감 보강 — VAD 자동 종료 + 문장 단위 TTS 선재생 (web)
- status: DONE
- owner: 개발자
- milestone: M3
- spec: D-026, D-033, DESIGN.md#7, API.md#speech
- blocked_by: ~~T-010~~ (D-033: T-010 REVIEW 상태로 두고 착수)
- acceptance:
  - VAD: `AnalyserNode` RMS 기반 무음 감지 순수 함수(`detectSilence(frames, thresholdDb, holdMs)`) + 테스트. 발화 종료 후 N ms 무음이면 녹음 자동 종료 → transcribing. 최대 길이(60초)도 자동 종료.
  - 문장 단위 TTS: SSE 델타를 문장 경계(`. ! ? …` + 개행)로 자르는 순수 함수 + 테스트. 첫 문장이 완성되면 `/speech/tts` 를 먼저 호출해 재생 큐에 넣고, 이후 문장은 순서대로 이어 재생. `done` 이후 남은 꼬리 처리.
  - 재생 큐가 비고 스트림도 끝나면 speaking → recording 자동 전환(T-010 상태 머신 확장).
  - 기존 API 변경 없음. 실패 시 T-010 의 전체 문장 TTS 로 폴백.
- test: 신규 web 41건(전체 `npm test` 360 passed / 54 files, lint 0 error·기존 경고 1, typecheck·build 통과).
  순수: `features/speech/vad`(12, rmsDb·적응형 바닥·히스테리시스·hold·minSpeech·level·detectSilence), `sentenceChunker`(9, 부호+공백 경계·개행·소수점·첫 문장 즉시·40자 버퍼·flush).
  `ttsPlayer`(+8, open() 세션: 순서·선합성 1개·end/done·played·실패 시점·stop·동시 1개; 기존 stop 테스트는 선합성 1개 허용으로 갱신).
  훅: `useRecorder`(+6, vad silence 자동 종료·발화 없으면 미종료·vad 없으면 미종료·level·미터 없음·stop 이벤트 지연 시 단일 종료), `useVoiceMode`(+5, 델타→첫 문장 선재생→done 꼬리→큐 소진→녹음, 본문 불일치, 폴백 2분기, VAD 자동 완료+토스트 없음).
  컴포넌트: `VoiceModeOverlay`(+1, `--level`). 실측(2026-09-18, 사용자 Mac Chrome 실마이크): VAD 자동 종료·선재생·진폭·회귀 전부 기대대로. iOS AudioContext suspended 는 T-013 체크리스트.
- qa: PASS (QA_REPORT.md 2026-09-18, 사용자 실측 + 로그 대조)
- note: 2026-09-18 착수·구현(D-033). 상태 머신(`voiceMachine`) 변경 없음 — 선재생은 streaming 중 세션 큐, speaking 은 큐 소진 대기. 컴포저 마이크는 미터를 만들지 않는다(vad 옵션 없음).
  VAD 한계: 바닥보다 12dB 이상 큰 꾸준한 소음은 발화로 보여 자동 종료 안 됨(60초 상한/탭). done 본문이 델타 누적과 다르면 델타 뒤 꼬리만 flush(잘린 부분은 안 읽음).

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
- status: REVIEW
- owner: 개발자
- milestone: M5
- spec: 루트 README.md#첫-배포-순서, D-002, D-009
- blocked_by: T-008
- acceptance:
  - GitHub Variables/Secrets 등록, `master` push → GHCR → NAS 기동. DSM 리버스 프록시 경유 SSE 동작.
  - NAS CPU 아키텍처 확인 → deploy.yml `platforms:`. DSM `X-Forwarded-For` 전달 확인.
  - `docker stats` 로 api 메모리 상한 내 동작. 인프라 작업이라 자동 테스트 없음 — QA 체크리스트.
- note: 2026-09-19 착수. **로컬 이미지 빌드 리허설 PASS**(`docker buildx build --platform linux/amd64`, 2b145c7 기준):
  web 80MB(Next 16.2.10 standalone, `/login` 200) · api 124MB(bootJar 61MB, `spring` 유저, `/tmp/audio` 생성). Dockerfile 수정 없음.
  사전 점검: 레포 public / omniroute·edge-tts(고정 digest) 이미지 둘 다 amd64+arm64 매니페스트 / compose `web.API_INTERNAL_URL` 은 코드 미사용(무해).
  주의: `ci.yml` 은 `pull_request` 트리거라 `--no-ff` 직접 머지 push 에는 CI 가 안 돈다 → master 머지 전 로컬 전체 테스트 필수.
  NAS `uname -m` = x86_64 → `platforms: linux/amd64` 유지. 2026-09-14~19 master push 9회 deploy 전부 실패 = GitHub Variable `APP_NAME` 미등록으로
  태그가 `ghcr.io/withbbang/-api` (invalid reference format). Variables/Secrets·NAS 준비(E) 완료 후 `workflow_dispatch` 로 재실행.
  **2026-09-20 첫 배포 성공 (master 0c6e114, https://talk-behind-my-back.o-r.kr).** 사용자 실측: 휴대폰(LTE) Google 로그인·텍스트→AI 답장·음성→STT→TTS, Mac(hosts 우회)+휴대폰 2기기 SSE 실시간 전부 PASS.
  거친 장애 순서와 해결: ① deploy scp 1회 일시 실패(재실행 OK) ② mysql 첫 초기화 >2분 → healthcheck start_period 300s ③ DSM 방화벽이 컨테이너 간 트래픽 DROP → 172.16.0.0/12 허용 규칙
  ④ OAuth 키 미설정(prod 는 기본값 없이 fail-fast, 의도) ⑤ http:80 진입 403 + 인증서 미매핑 → LE 인증서 발급·매핑, 80 규칙 추가 ⑥ tmpfs `/tmp/audio` root 755 → `uid=100,gid=101`
  ⑦ `.env` 빈 값 인라인 주석이 값으로 → Gemini 400 ⑧ `data/omniroute` 소유자 → chown 1000. OmniRoute 는 대시보드(LAN :20128)에서 Gemini·Groq·edge-tts 노드 연결 + API 키 발급(Playwright 로 조작, 키는 사용자 직접 입력).
  실측 수치: api 419MiB / mysql 529 / omniroute 649 / web 56 / nginx 6 / edge-tts 48 MiB. Flyway V1~V4 적용. `X-Forwarded-For` 로 실제 클라이언트 IP 복원, `X-Forwarded-Proto` 로 redirect_uri https 확인.
  남은 것: QA 체크리스트(to-qa), DSM 리버스 프록시 read timeout(기본 60s → SSE 재연결로 커버, 거슬리면 늘림), OmniRoute 제거 검토는 별도 백로그(메모리 ~650MiB).

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
- 방 검색
- 메시지 복사/재생성(regenerate)
- TTS 응답 스트리밍(문장 단위 선재생)
- 토큰 기준 컨텍스트 윈도우(D-006 open)
- 사용량 일일 상한 + 어드민 알림(D-007 open)
- `MapperTest` 를 `@MybatisTest` 슬라이스로 전환(속도) — Boot 4 `AutoConfigureTestDatabase` 패키지 확인 후
- TTS 폴백 콤보: OmniRoute 에서 `edge/tts-1` 실패 시 `gtts/ko` 로 넘어가는 콤보 설정 + `TTS_MODEL` 을 콤보 alias 로(D-028). 비공식 Edge API 차단 대비.
- OmniRoute `next` 이미지가 내장 edgetts 403(Sec-MS-GEC)을 고쳤는지 확인 → 고쳤으면 edge-tts 사이드카 제거(D-028).
- 로컬 api 첫 외부 호출 시 Netty `MacOSDnsServerAddressStreamProvider` ERROR 노이즈 — `io.netty:netty-resolver-dns-native-macos` 를 로컬 전용 의존성으로(배포 Linux 무관, T-035 실측 관측)
- 잘못된 percent-encoding 쿼리스트링(Tomcat `InvalidParameterException`) 500 → 400 `VALIDATION_FAILED` 매핑(T-006 QA 발견)

## T-027 로컬/배포 LLM 공급자 확정 (infra/api)
- status: DONE
- owner: 개발자
- milestone: M3
- spec: D-031, D-032, D-006, D-027
- note: 2026-09-18 착수. Gemini(AI Studio 키) 연결 + api `reasoning_effort` 옵션 추가(커밋됨).
- 확정(D-032, 2026-09-18): 무료 채팅 모델 = `gemini/gemini-flash-lite-latest`(RPD 별개라 여유), `LLM_REASONING_EFFORT` 비움(이 모델은 파라미터 400 거부). `.env.example` 기본값 반영. 실측: 비스트리밍 3/3 200·스트리밍 델타 정상·빈 응답 없음. 키 0개 스크래퍼는 전부 서버 IP 차단(418/403/502…), Groq 채팅은 Cloudflare 1010 밴(STT 전용 유지). 무료 티어 요청수 한도(RPM/RPD)는 개인/데모엔 충분, 트래픽 시 유료 키로 `LLM_MODEL`+키만 교체(코드 무변경).
- 파생: 배포용 `infra/.env` 실값 채우기·NAS 환경변수 설정은 배포 태스크에서. non-thinking Gemini 모델(gemini-2.0-flash 등) 카탈로그 등록되면 교체 검토는 선택 사항(현재 flash-lite-latest 로 충분).

## T-028 SSE 셧다운 타임아웃 ERROR 로그 노이즈 제거 (api)
- status: DONE
- owner: 개발자
- milestone: M3
- spec: API.md#에러-형식, T-026 QA 부수 발견
- acceptance:
  - `GlobalExceptionHandler` 에 `AsyncRequestTimeoutException` 전용 핸들러 — 스택 없이 debug 로그, 503 `SERVICE_UNAVAILABLE` 응답. 단위 테스트 1건.
  - 재기동/배포 시 열린 SSE 연결마다 찍히던 `unhandled exception` ERROR 스택이 사라진다. `RoomEventBus`·SSE 동작 변경 없음.
- test: `GlobalExceptionHandlerTest` +1(503 매핑). api 전체 294 통과(2026-09-18, compose MySQL). 실측: 로컬 JWT 로 SSE 를 연 채 SIGTERM → graceful 30초 뒤 핸들러 DEBUG 1건, `unhandled exception` 0건(수정 전엔 ERROR 스택).
- qa: PASS (QA_REPORT.md 2026-09-18, 개발자 QA 대행 — 단위 + 셧다운 실측)
- note: 원인 — api 종료 시 Tomcat 이 열린 async(SSE) 요청을 강제 timeout → catch-all 핸들러가 ERROR. `SseEmitter(0L)` 은 무제한이라 평시엔 안 남. 교훈: bootRun 중 `gradlew test` 로 api 가 죽는 것 이번에도 재현(기존 교훈).

## T-029 채팅 UI 정리 13건 (web) — D-034
- status: DONE
- owner: 개발자
- milestone: M3
- spec: DECISIONS.md#D-034, DESIGN.md#2·#3·#7
- acceptance:
  - 상단 바: 제목(평문) + 우측 햄버거만. 보이스 토글은 컴포저 마이크·전송 사이(AI 모드·ACTIVE 에서만).
  - 사이드바 우측(데스크톱 고정·모바일 드로어 우측). 하단 로그아웃 왼쪽 톱니 "설정" → 설정 시트(제목·멤버 줄 가운데, 모드, 테마, AI 성격). 사이드바 하단 테마 필 제거.
  - 혼자면 `유저끼리` 호버/포커스에 "친구 초대해봐!" 툴팁. 직접 쓰기 textarea 취소/저장 버튼(blur 저장 없음).
  - AI 말풍선 듣기 버튼 없음. 스트림 오류 말풍선은 문구만("다시" 없음).
  - 방 목록 … 메뉴 바깥 클릭/Escape/포커스 이탈로 닫힘.
  - 보이스 오버레이: 단일 오브 + 라벨 + 우측 상단 X("끄기") + 하단 "다시". 기존 상태 머신·훅 변경 없음.
  - 활성 버튼·링크 cursor pointer. `npm test`·lint·typecheck 통과.
- test: `VoiceModeOverlay`(9, 단일 오브·X·다시), `Composer`(+1 토글 순서 마이크→음성→전송), `ChatShell`(설정 시트 방 안/밖·드로어·우측 햄버거), `Sidebar`(톱니·테마 없음), `RoomHeaderSheet`(툴팁·가운데·테마 줄·저장 버튼), `AiPromptEditor`(취소/저장/비활성), `RoomListItem`(+2 바깥 클릭·↑↓), `MessageBubble`(듣기 없음), `MessageList`(다시 없음). web 전체 53 파일 365 통과, lint(기존 경고 1)·typecheck·build 통과(2026-09-18).
- qa: PASS (QA_REPORT.md 2026-09-18, 사용자 Chrome 실측 + 개발자 QA 대행)
- note: `ListenButton` 삭제. 사이드바 톱니는 방 밖에서도 보이며 그때 시트는 "테마" 줄만(D-034 가정). 오류 말풍선은 스트림 스토어에만 있어 새로고침하면 사라진다(서버 미저장, 기존과 동일).

## T-030 채팅 UI 정리 2차 4건 (web) — D-035
- status: DONE
- owner: 개발자
- milestone: M3
- spec: DECISIONS.md#D-035, DESIGN.md#2·#3
- blocked_by: T-029 (같은 파일, 순차)
- acceptance:
  - 드로어에 닫기 X 없음. 딤 탭·Escape 로 닫힘.
  - 사이드바 하단 우측 프로필 버튼(아바타+닉네임, `aria-haspopup="menu"`) → 메뉴 "설정"(onOpenSettings 있을 때) · "로그아웃". 바깥 클릭·Escape·포커스 이탈로 닫힘, 열리면 첫 항목 포커스.
  - 말풍선에 VOICE 마이크 아이콘 없음.
  - 컴포저: 글자가 있으면 "지우기" X 버튼, 비면 없음. 탭 → 값 비움 + 포커스 유지.
  - `npm test`·lint·typecheck 통과.
- test: `useMenu` 추출(RoomListItem 기존 2건이 회귀 커버), `Sidebar`(+3 프로필 메뉴·바깥 클릭/Escape·로그아웃 POST), `ChatShell`(드로어 X 없음·Escape·딤), `MessageBubble`(VOICE 아이콘 없음), `Composer`(+1 지우기 순서·포커스). web 전체 53 파일 368 통과, lint(기존 경고 1)·typecheck·build 통과(2026-09-18).
- qa: PASS (QA_REPORT.md 2026-09-18, 사용자 Chrome 실측 + 개발자 QA 대행)
- note: React Compiler lint(`Cannot access refs during render`)는 훅이 돌려준 객체에 `*Ref` 가 있으면 객체 전체를 ref 로 본다 → 호출부에서 구조분해. 교훈 상단에 추가.


## T-031 AI 모드 메시지 비공개화 + 유저끼리 대화 컨텍스트 제외 (api) — D-037
- status: DONE
- owner: 개발자
- milestone: M3
- spec: DECISIONS.md#D-037, API.md#messages, SCHEMA.md#messages
- acceptance:
  - V4 마이그레이션: `messages.visible_to_user_id` (NULL = 방 전원, 값 = 그 유저만) + 백필(D-037 가정 ①).
  - 전송: `AI` 모드 USER 행은 `visible_to_user_id = 발신자`, `HUMAN` 모드는 NULL. AI 응답 행은 트리거 USER 의 발신자.
  - `GET /rooms/{id}/messages` 는 `visible_to_user_id IS NULL OR = 나` 만 돌려준다 — 상대의 `AI` 모드 질문·답은 페이지에도 커서에도 안 나온다.
  - SSE: `message`·`delta`·`done`·`error` 는 대상 유저에게만(그 유저의 모든 구독). `mode`·`member` 는 방 전원 브로드캐스트. `HUMAN` 모드 `message` 는 전원.
  - AI 컨텍스트: `HUMAN` 모드 USER 행 제외, 양쪽 `AI` 모드 USER 행 + 모든 ASSISTANT 행 포함. 최근 N 창이 제외분으로 낭비되지 않게 SQL 에서 걸러진다.
  - 시스템 프롬프트: 상대 발언을 먼저 옮기지 말고 직접 물으면 알려준다는 지시 + 마지막 발신자에게 답한다는 지시(2인 방만).
  - `./gradlew test` 통과.
- test: `RoomEventBusTest`(+3 publishTo 대상·구독 없는 유저·실패 emitter 제거), `MessageServiceTest` 가시성 6건(상대 AI 대화 history 제외·HUMAN 양쪽 노출·커서·컨텍스트 포함/제외·비공개 지시·최근 N 창), `AiContextBuilderTest`(+3 HUMAN 제외·비공개 지시 유무), `MapperTest`(가시성 3행 + 뷰어 필터 + findRecentForAiContext), `MessageControllerIntegrationTest`(+1 상대 AI 대화 미노출), 실측 회귀 +1(상대 응답이 뒤에 끼어도 컨텍스트 마지막 턴은 내 질문). api 전체 308 통과(2026-09-19).
- qa: PASS (QA_REPORT.md 2026-09-19, 사용자 실측 + 개발자 QA 대행)
- note: SSE 구독 키가 `(roomId, userId)` 로 바뀌어 `bus.subscribe` 시그니처 변경(호출부 = `MessageController`, 테스트 3곳).
  `findRecentByRoomId`(가시성 무관 원본)와 `findRecentForAiContext`(HUMAN 제외) 두 개 — 서비스는 후자만 쓴다.
  V4 백필 2단계는 MySQL 이 UPDATE 대상 테이블을 서브쿼리에서 못 읽어 임시 테이블로 끊었다.
  **실측 1차 FAIL → 같은 T 안에서 수정**(to-dev 2026-09-19): 두 사람이 동시에 물으면 내 질문 뒤에 상대 응답이 쌓여
  컨텍스트가 assistant 턴으로 끝나 Gemini 400. 잡이 트리거 id 까지만 읽도록 `findRecentForAiContext(roomId, upToMessageId, limit)`.

## T-032 모드 토글 안내 툴팁 + 실측 정정 5건 (web) — D-037 4, D-038
- status: DONE
- owner: 개발자
- milestone: M3
- spec: DECISIONS.md#D-037 (4), DESIGN.md#3
- blocked_by: 없음 (T-031 과 독립 — 서버가 가시성을 필터하므로 렌더 로직 변경 없음)
- acceptance:
  - `PillToggle` 이 옵션별 `tip` 을 받아 그 칸 호버/포커스/터치 중에만 말풍선(`role="tooltip"`, 칸 `aria-describedby`).
  - `AI` 칸 "AI와 1:1, 친구는 못 봐!", `유저끼리` 칸 "친구와 1:1, AI는 못 봐!".
  - 혼자인 방: 토글 disabled + "친구 초대해봐!" 하나만(칸별 툴팁 없음) — 현행 유지.
  - `npm test`·lint·typecheck 통과.
- test: `PillToggle`(+2 안내 tooltip·aria-describedby / tip 없으면 없음), `RoomHeaderSheet`(안내 2개·혼자면 1개·참여자는 모드/AI성격 없음), **신설 `ChatShell.settings.test.tsx` 5건**(실제 Sidebar 로 프로필 메뉴 → 설정: 참여자·개설자·상세 실패 폴백·Safari focusout·me 실패), `useMessages`(+1 전송 시 오류 말풍선 정리). web 전체 54 파일 378 통과, lint(기존 경고 1)·typecheck 통과(2026-09-19).
- qa: PASS (QA_REPORT.md 2026-09-19, 사용자 실측 — Safari 재검증 + OmniRoute 중단으로 오류 말풍선 강제 재현까지 완료)
- note: `PillToggle` 옵션에 `tip?` 추가. 혼자인 방은 `MODES_ALONE`(tip 제거)을 넘겨 "친구 초대해봐!" 툴팁 하나만.
  **실측 1차 FAIL 4건 → 같은 T 안에서 수정**(D-038, to-dev 2026-09-19): 툴팁 2개 동시 표시·시트 가로 스크롤(둘 다 툴팁 방식 문제) / 참여자 시트 범위 / 오류 말풍선 영구 잔류.
  **Safari 에서 프로필 메뉴 "설정" 무반응** = `useMenu` 의 focusout 판정 — 역할 무관이었다(참여자 창이 Safari, 개설자 창이 Chrome 이라 한쪽만 재현). `ChatShell.test.tsx` 가 Sidebar 를 스텁으로 갈아끼워 이 경로에 테스트가 없었다 → 실제 Sidebar 통합 테스트 신설.

## T-033 SSE 클라이언트 끊김 ERROR 스택 제거 (api) — T-031 실측 중 발견
- status: DONE
- owner: 개발자
- milestone: M3
- spec: TASKS.md T-028(형제 케이스), `GlobalExceptionHandler`
- blocked_by: 없음
- acceptance:
  - SSE 를 연 클라이언트가 끊길 때 나는 `AsyncRequestNotUsableException`(Caused by Broken pipe)이 catch-all ERROR 스택으로 찍히지 않는다(T-028 의 `AsyncRequestTimeoutException` 과 같은 모양의 핸들러 + debug 로그).
  - catch-all `handleUnknown` 은 톰캣 `ClientAbortException` 처럼 다른 모양으로 오는 끊김도 `DisconnectedClientHelper.isClientDisconnectedException` 으로 판정해 debug 로 내린다(사용자 선택 C안, 2026-09-19). 진짜 예외는 그대로 ERROR.
  - 단위 테스트 +1. `./gradlew test` 통과.
- test: `GlobalExceptionHandlerTest` +2 — 전용 핸들러(`AsyncRequestNotUsableException` → 503 + DEBUG 1줄), catch-all 안전망(`ClientAbortException` → 503 + DEBUG). 기존 "예상 못한 예외 500" 에 ERROR 로그 단언을 추가해 안전망이 진짜 실패를 삼키지 않는 걸 고정.
  로그 레벨 단언은 logback `ListAppender` 로(응답만 보면 "ERROR 로 안 찍힌다" 가 검증되지 않는다). api 전체 310 통과(2026-09-19 로컬, compose MySQL).
- qa: PASS (QA_REPORT.md 2026-09-19, 개발자 실측 + 개발자 QA 대행)
- note: T-031 실측 중 30분에 4건 관측(탭 닫기·새로고침마다 1건). 동작 영향은 없고 로그 노이즈 — 실측 로그에서 진짜 실패를 가린다.
  경로 확인(2026-09-19 실측): 톰캣 `AsyncListenerWrapper.fireOnError` → `StandardServletAsyncWebRequest.onError` → `WebAsyncManager` 가 `AsyncRequestNotUsableException`(Caused by `Broken pipe`) 으로 감싸 에러 디스패치 → 우리 advice catch-all `handleUnknown` 에서 ERROR 스택. `RoomEventBus` 의 send 실패 경로는 원인이 아니다(이미 IOException 을 잡아 debug).
  실측 방식: 8080 의 bootRun 을 건드리지 않게 같은 클래스패스로 **:8081 두 번째 인스턴스**를 띄우고(로컬 dev JWT 쿠키 + 기존 방) `curl -N` 로 SSE 를 연 뒤 kill — 끊김은 다음 하트비트(20초) 쓰기 시점에 드러난다.
  결과: 수정 전 끊김 1건 = ERROR 스택 1건 / 수정 후 끊김 2건 = ERROR·WARN 0건 + `client disconnected during response:` DEBUG 2줄. SSE 동작(`:connected`·`:ping`)은 그대로.

## T-034 전송 후 입력창 포커스 유지 (web) — 사용자 버그 제보
- status: DONE
- owner: 개발자
- milestone: M3
- spec: DESIGN.md#3 입력창, `Composer.tsx`
- blocked_by: 없음
- acceptance:
  - Enter 로 전송해 AI 잡 대기(`lock='pending'`)로 잠겼다가 풀리면 입력창(textarea)에 포커스가 돌아온다.
  - 전송 버튼 클릭으로 보낸 뒤에도 포커스가 입력창에 있다(버튼이 disabled 되며 포커스가 날아가지 않는다).
  - 잠금이 풀릴 때 사용자가 다른 곳(시트·다이얼로그 등)에 포커스를 두고 있으면 뺏지 않는다.
  - `orphaned` 잠금, 보이스 전송(마이크·보이스 모드)은 자동 포커스 대상이 아니다.
  - `npm test`·lint·typecheck 통과.
- test: `Composer.test.tsx` +4 (잠금 해제 시 포커스 복원 / 전송 버튼 클릭 후 포커스 유지 / 다른 곳에 포커스가 있으면 안 뺏음 / orphaned 해제는 자동 포커스 없음). web 전체 54 파일 384 통과, lint(기존 경고 1)·typecheck 통과(2026-09-19).
- qa: PASS (QA_REPORT.md 2026-09-19, 사용자 실측)
- note: 원인 2개 — 둘 다 "포커스된 엘리먼트를 disabled 로 만들면 브라우저가 포커스를 뗀다".
  (1) AI 모드: `useMessages.ts` `markSending` → `RoomView` `lock='pending'` → textarea `disabled` → 포커스 소실, 잠금 해제 시 복원 코드 없음.
  (2) 전송 버튼 클릭: 값이 비면 그 버튼이 `disabled` → 포커스 소실.
  수정 방식은 "포커스 복원"(사용자 선택, 2026-09-19). 잠금 UX(disabled) 자체는 유지 — readOnly 전환안은 D-번호 결정 필요라 보류.

## T-035 2인 방 보이스 모드 동시 사용 확인 — TTS 충돌 실측 (web, 검증만)
- status: DONE
- owner: QA
- milestone: M3
- spec: D-029 (6), D-037, DESIGN.md#7, `RoomAiExecutor.java`
- blocked_by: 없음
- acceptance:
  - 2인 방에서 둘 다 보이스 모드를 켜고 동시에 말해도 각자 **자기 질문에 대한 답만** 재생된다(상대 답은 들리지도, 목록에 보이지도 않는다).
  - 늦게 말한 쪽은 409 없이 전송되고 상대 잡이 끝난 뒤 자기 답을 받아 재생한다(직렬 큐 대기).
  - 한쪽이 `유저끼리` 로 전환하면 상대 오버레이가 닫히고 토스트가 뜬다.
  - 대기 체감(라벨 없이 "답하는 중" 만 보이는 시간)이 거슬리는지 기록 → 거슬리면 별도 T(api `start` 이벤트 + `queued` 단계).
- test: 코드 변경 없음. 기존 `voiceMachine.test.ts`(STREAM_DONE replyTo 필터), `useVoiceMode.test.tsx`(2인 방 상대 done 무시) 가 클라이언트 필터를, api `MessageServiceTest`(가시성 `visibleToUserId`)·`RoomEventBusTest`(`publishTo` 유저 타겟 발행)가 서버 쪽을 이미 덮는다.
- qa: PASS (QA_REPORT.md 2026-09-19, 사용자 실측 — 대기 체감 안 거슬림, 제안 B 미개설)
- note: 백로그 "2인 방 보이스 모드 동시 사용 시 TTS 재생 충돌 처리(모두 허용 결정, M3 에서 확인)" 를 T 로 승격(2026-09-19). 조사 결과 충돌은 D-029 (6) 클라이언트 `replyTo` 필터 + D-037 서버 유저 타겟 발행으로 두 겹 차단, `ROOM_BUSY` 는 유저 단위라 동시 전송도 통과 — 남은 일은 실측 확인뿐. 실측 절차는 inbox/to-qa.md.
