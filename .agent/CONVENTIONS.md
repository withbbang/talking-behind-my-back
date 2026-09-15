# CONVENTIONS — 브랜치·커밋·코딩·테스트·툴 규칙

> **Write: CEO | Read: 전원**
> TL;DR: Homepage 프로젝트 규칙을 그대로 잇는다. 브랜치 `feature_YYYYMMDD → dev → master`, 커밋은 `.gitmessage.txt`,
> TDD 필수, 시크릿은 환경변수만. 툴 주의사항(맨 아래)은 비싸게 배운 것이니 반드시 읽는다.

## 브랜치·머지
- `feature_YYYYMMDD` (하루 단위 작업 브랜치) → `dev` → `master`. 각각 `git merge --no-ff`.
- `master` push = 운영 배포(deploy.yml). `dev`에서 CI 통과 후에만 올린다.
- PR 대상은 `dev`. `ci.yml`이 `dev`/`master` PR에서 돈다.

## 커밋
- `.gitmessage.txt` 템플릿. `git config --local commit.template .gitmessage.txt`.
- `<Type>(<scope>) : <subject>` — scope는 `web` | `api` | `infra` | `agent`.
- footer에 `Task: T-xxx`.

## 공통
- 시크릿은 코드·문서·커밋 어디에도 쓰지 않는다. `infra/.env`(gitignore), 로컬은 `apps/api/src/main/resources/application-secret.yml`(gitignore) 또는 환경변수.
- 외부 API(OmniRoute, OpenAI/Clova, OAuth)는 반드시 인터페이스 뒤에. 테스트는 fake/mock.
- 시간은 저장·전송 UTC, 표시만 KST.
- 로그에 메시지 본문·오디오·토큰을 남기지 않는다. ID와 길이만.

## 프론트 (apps/web)
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4. 패키지 매니저 npm(`package-lock.json` 커밋). 버전은 Homepage 와 동일하게 유지.
- 경로 alias `@/*` → `./app/*` (Homepage 와 동일). components/features/lib 도 `app/` 아래에 둔다. vitest alias 도 `./app` 으로 맞춘다.
- **로컬 실행은 `next dev --port 3001`, 브라우저는 nginx-dev `http://localhost:3000`.** `next.config.ts` 에 `/api` rewrite 를 넣지 않는다(D-004 보완 — SSE 0바이트).
- 상태: 서버 상태는 React Query(요청별 새 QueryClient, Homepage B-6b), 클라이언트 UI 상태는 zustand 최소. Redux 미사용.
- API 호출은 `app/lib/api.ts`만 경유. 컴포넌트에서 `fetch` 직접 호출 금지. SSE 는 `app/lib/sse.ts`(T-008).
- 서버 컴포넌트에서 API 호출 시 `process.env.API_INTERNAL_URL`(compose 내부 주소) 사용, 클라이언트는 상대 경로 `/api`.
- 서비스워커(T-014): `/api/*`, `/admin/*`는 NetworkOnly. 앱 셸·정적 자원만 캐시.
- 테스트: Vitest + RTL. 파일은 대상 옆에 `*.test.ts(x)`. 훅은 `renderHook`. SSE 파서·상태 머신은 순수 함수로 분리해 단위 테스트.
- 린트: `npm run lint` 0 errors, `npm run typecheck` 통과.

## 백엔드 (apps/api)
- Java 17, Spring Boot 4.1.0, Gradle 9.5.1(Groovy DSL), mybatis-spring-boot 4.0.1 — Homepage/Admin 과 동일. 패키지 `com.example.chat`(프로젝트명 확정 시 변경).
- **Boot 4 import 는 Homepage/Admin 기존 코드에서 확인 후 사용.** 패키지가 대거 이동했다(예: `@WebMvcTest` → `org.springframework.boot.webmvc.test.autoconfigure`, Jackson → `tools.jackson`). BOM 미관리 라이브러리(okhttp, mybatis, jjwt, springdoc)는 버전 명시.
- JDBC URL 은 `characterEncoding=UTF-8`(Java charset 이름). `utf8mb4` 를 넣으면 기동 시 죽는다.
- 패키지는 기능 단위(`auth`, `user`, `chatroom`, `message`, `llm`, `speech`, `persona`, `admin`, `global`). 계층 폴더(`controller/`, `service/`)를 최상위에 두지 않는다.
- 도메인은 Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`, enum 은 도메인 클래스 안에 nested. MyBatis 는 enum 을 name() 문자열로 저장한다.
- MyBatis: 매퍼 XML은 `resources/mapper/<Domain>Mapper.xml`, 인터페이스와 1:1. `resultMap` 명시, `SELECT *` 금지, 컬럼 목록은 `<sql id="columns">`. 동적 SQL은 `<where>`/`<if>`만. 복수 파라미터는 `@Param`. 단건은 `Optional<T>`.
- Flyway: `V{n}__{snake_desc}.sql`. Flyway 가 DDL 을 단독 소유(D-009). 운영 DDL 수동 실행 금지. init SQL 에 테이블 생성 금지.
- 예외: 비즈니스 예외는 `BusinessException(ErrorCode)` 하나. `GlobalExceptionHandler`가 API.md 에러 형식으로 변환. 새 코드는 API.md 에 먼저.
- SSE: **`SseEmitter`** 로 통일(D-018, T-007). 방 단위 브로드캐스트는 `message/RoomEventBus`(구독·발행·하트비트 `: ping` 20초·끊김 제거) 하나만 거친다. 컨트롤러가 emitter 를 직접 만들지 않는다. emitter 타임아웃은 0(무제한).
- 외부 LLM 호출은 `llm/LlmClient` 인터페이스 뒤에(구현 `OmniRouteClient`). 테스트는 `message/SyncAiTestConfig`(FakeLlm + 동기 실행기)를 `@Import`.
- 트랜잭션: 스트리밍 중 DB 트랜잭션을 열어두지 않는다. USER 저장 → 커밋 → 스트림 → ASSISTANT 저장 → 커밋.
- 테스트: JUnit5 + AssertJ. 매퍼는 `@SpringBootTest + @Transactional`(로컬 compose MySQL / CI MySQL 서비스, 롤백). 예외핸들러 같은 순수 로직은 직접 호출 단위 테스트(Homepage 방식). HTTP 레벨은 실제 컨트롤러 `@WebMvcTest` — 테스트 클래스 안의 nested 컨트롤러는 Boot 4 에서 등록되지 않는다. 외부 HTTP는 MockWebServer(4.12.0).
- 설정: `application.yml`(공통, `${ENV:기본값}` — 기본값은 로컬 compose 기준) / `-prod`(비밀은 기본값 없이 `${ENV}` 만) / `-test`. 프로파일별 시크릿 파일은 gitignore.

## 인프라 (infra, .github)
- compose 서비스 이름은 `nginx`, `web`, `api`, `mysql`, `omniroute` 고정(nginx upstream이 참조).
- NAS의 `.env`는 GitHub에 없다. 새 환경변수를 추가하면 `.env.example`과 deploy.yml 상단 주석을 같이 갱신하고 TASKS.md에 "NAS .env 수동 반영 필요" 표시.
- 이미지 태그는 커밋 SHA. `latest`는 편의용.
- 로컬 `docker-compose.dev.yml` 은 nginx(:3000) + mysql + omniroute 만. web/api 는 호스트에서 직접 실행.

## 문서
- 각 `.agent/*.md` 상단 3~5줄 TL;DR 유지.
- 결정은 DECISIONS.md에만. 다른 파일에서는 `(D-00x)`로 참조.
- 계약 변경(API.md, SCHEMA.md)은 먼저 문서, 그다음 코드.
- 교훈(같은 데서 두 번 넘어질 만한 것)은 TASKS.md 상단 "진행 중 얻은 교훈"에 한 줄씩.

## 툴 주의사항 (비싸게 배운 것 — 반복 금지)
- **Claude 실행 환경의 `create_file`/bash는 사용자 디스크에 쓰지 않는다.** 사용자 파일시스템 쓰기는 `filesystem:write_file` / `filesystem:edit_file` / `filesystem:move_file`만 유효하다.
- 파일 존재 확인은 `filesystem:list_directory`. `filesystem:search_files`(glob)는 존재하는 파일도 못 찾는 경우가 있다.
- **`filesystem:edit_file`의 `oldText`에 한글이 포함되면 매칭이 실패하거나 깨진 문자가 들어간다**(2026-09-13 이 파일에서 재현: "어긋나"→"어궸나"). 한글 포함 편집은 영문 앵커(코드·키워드)로 잡거나, 파일 전체를 `write_file`로 다시 쓴다.
- `./gradlew`·`npm test`는 사용자 로컬에서만 실행 가능. 에이전트가 직접 못 돌리면 QA_REPORT.md에 "사용자 실행 결과 근거"로 출처를 명시한다.
- 바이너리(gradle-wrapper.jar, 아이콘 png)는 에이전트가 못 쓴다 — Homepage 에서 복사하거나 사용자가 넣는다.
- 작업 하나 끝나면 `/clear`. 상태는 파일에 있다.
