# QA_REPORT — 검증 리포트

> **Write: QA | Read: 개발자, 기획자**
> TL;DR: REVIEW 상태 작업을 검증. TDD 프로젝트이므로 **테스트 존재 + 전체 통과**를 최우선 확인.
> 통과 시 TASKS.md를 DONE으로, 실패 시 inbox/to-dev.md로 이슈 전달.

## 검증 순서
1. 해당 작업에 대한 **테스트 코드가 존재**하는가? (없으면 즉시 FAIL → 개발자에게 반려. 인프라/문서 작업은 예외, 사유 기록)
2. 전체 테스트가 통과하는가?
   - 프론트: `cd apps/web && npm test`
   - 백엔드: `cd apps/api && ./gradlew test` (로컬 `docker compose -f infra/docker-compose.dev.yml up -d` 선행)
   - 에이전트가 직접 실행 못 하면 사용자 실행 결과를 출처로 명시.
3. 테스트가 PLAN.md acceptance의 핵심 동작을 실제로 덮는가? (형식적 테스트 여부)
4. API.md / SCHEMA.md 계약과 구현이 일치하는가?
5. 프로젝트 특유 체크리스트(아래) 중 해당 항목.
6. 엣지케이스 / 반응형(390px, 1024px) / 접근성(키보드·aria·포커스).

## 프로젝트 특유 체크리스트
- [ ] SSE: `delta` 순서 보장, `done` 후 DB 저장 확인, 중단 시 정책(D-008) 준수, nginx 경유 시 버퍼링 없음
- [ ] 동시성: 같은 방 재전송 409, UI 비활성
- [ ] 컨텍스트: 긴 방에서 최근 N개만 전송(요청 본문 검증)
- [ ] 음성: STT → VOICE 메시지 저장 → TTS 재생 → 자동 재녹음 루프, `/tmp/audio` 잔존 파일 없음
- [ ] 세션: 재접속 자동 로그인, refresh 회전·재사용 감지, 로그아웃 후 401
- [ ] 권한: 타인 방 404, 비관리자 `/admin` 403, 정지 회원 전송 403
- [ ] PWA: `/api/*` 캐시 안 됨, 오프라인 셸 표시, iOS 홈화면 로그인 왕복
- [ ] 보안: 로그에 본문/오디오/토큰 없음, 시크릿 하드코딩 없음
- [ ] 비용: STT 60초·TTS 1,000자·메시지 4,000자 상한 동작

## 검증 형식
### [T-xxx] 제목
- verdict: PASS / FAIL
- tests: 테스트 존재 여부 / 통과 여부 (예: 12 passed) / 출처(에이전트 실행 or 사용자 보고)
- checked: 확인한 항목 (acceptance 커버리지, 계약 일치, 체크리스트, 엣지, 반응형, 접근성)
- issues: 발견한 문제 (FAIL 시 inbox/to-dev.md에도 기록. 블록 아님이면 "블록 아님, 후속" 표시)
- date:

<!-- QA가 검증 결과를 아래에 계속 추가 -->

### T-000 레포 스캐폴드 + CI/CD 뼈대 + .agent 워크플로
- verdict: PASS
- tests: 없음(설정/문서 작업, 정당). compose·workflow YAML 문법 검증 통과(에이전트 실행).
- checked:
  - 루트 README 구조 ↔ 실제 디렉토리 일치.
  - `.env.example` 변수 ↔ compose 참조 변수 일치(APP_NAME, GH_OWNER, DATA_DIR, MYSQL_*).
  - nginx `/api/` 블록 SSE 설정(buffering off, read_timeout 300s).
  - deploy.yml 트리거 브랜치가 CONVENTIONS.md(`master`)와 일치.
- issues:
  - (블록 아님, 후속) NAS CPU 아키텍처 미확인 → deploy.yml `platforms:` T-012에서 확정.
  - (블록 아님, 후속) DSM 리버스 프록시 `X-Forwarded-For` 전달 여부 미확인 → T-012.
- date: 2026-09-13

### T-001 web 프로젝트 초기화
- verdict: PASS
- tests: `app/lib/api.test.ts` 8케이스. 출처: 사용자 로컬 `npm test` 통과 보고(2026-09-13).
- checked:
  - acceptance: standalone 출력, Vitest+RTL, `lib/api.ts` 401→refresh 1회→재시도/실패 시 `/login`, 204/raw body/에러 매핑 — 테스트로 덮음.
  - 동시 401 시 refresh 1회만(in-flight 공유) — 구현 확인(테스트는 후속).
  - `/api` rewrite 없음(D-004 보완) — `next.config.ts` 확인. 로컬 nginx-dev 경로 문서화.
  - alias `@/*`→`./app/*` tsconfig/vitest 일치.
- issues:
  - (범위 변경) Serwist 서비스워커는 Next 16 호환 미확인으로 T-014 분리. manifest.ts 는 있음.
  - (블록 아님, 후속) `public/icons/*.png` 없음 — manifest 가 참조. DESIGN.md 아이콘 확정 후 추가.
  - (블록 아님, 후속) 동시 401 refresh 단일화 테스트 케이스 추가 권장.
- date: 2026-09-13

### T-002 api 프로젝트 초기화
- verdict: PASS
- tests: `ChatApplicationTests.contextLoads`(Flyway V1 적용 포함), `GlobalExceptionHandlerTest` 6케이스. 출처: 사용자 로컬 `./gradlew test` 통과 보고(2026-09-13).
- checked:
  - acceptance: Boot 4.1 + MyBatis + Flyway + Validation + Security + OAuth2 Client + WebClient, context-path `/api`, `${ENV}` 시크릿, 에러 형식 — 충족.
  - 첫 실행에서 3회 실패 후 통과: (1) mockwebserver 버전 누락(BOM 미관리) (2) `@WebMvcTest` Boot 4 패키지 (3) `characterEncoding=utf8mb4`. 전부 TASKS.md 교훈에 기록.
  - `SecurityConfig` 401 진입점이 JSON 에러 형식을 쓰는지 — `ErrorResponse.toJson` 이스케이프 테스트로 간접 확인.
- issues:
  - (블록 아님, T-004) OAuth2 AuthorizationRequestRepository 를 cookie 기반으로 교체해야 stateless 와 맞는다(SecurityConfig 주석).
  - (블록 아님, T-004) csrf off 의 근거(SameSite=Lax + JSON only)를 T-004 에서 재검토.
- date: 2026-09-13

### T-003 DB 스키마 확정 + 초기 SQL + 매퍼
- verdict: PASS
- tests: `MapperTest` @SpringBootTest+@Transactional, User 3 / ChatRoom 5 / Message 1 / Persona 4 케이스. 출처: 사용자 로컬 `./gradlew test` 통과 보고(2026-09-13, contextLoads · GlobalExceptionHandlerTest 포함 전수 GREEN).
- checked (에이전트 사전 점검):
  - SCHEMA.md ↔ `V1__init.sql` 컬럼·인덱스·제약 일치. 기본 페르소나 시드 1건.
  - 매퍼 XML resultMap 이 도메인 프로퍼티와 1:1. soft delete 필터, 소유자 조건, 커서 필터, 활성 페르소나 삭제 금지 — 테스트로 덮음.
  - `01-schema.sql` 에 DDL 없음(Flyway 단독, D-009 보완).
- issues:
  - (블록 아님, T-006) `ChatRoomMapper.findByUserId` 커서가 id 기준이라 `last_message_at` 정렬과 엄밀히 맞지 않음 — 테스트에 명시.
  - (블록 아님, 후속) `MapperTest` 는 전체 컨텍스트라 느림 — 백로그(`@MybatisTest` 전환).
- date: 2026-09-13

### T-004 소셜 로그인 3사 + JWT 쿠키 + refresh 회전 (api)
- verdict: PASS
- tests: 68케이스 신규(단위 51 + MockMvc 통합 14 + 매퍼 7 등), 전체 88 통과. 출처: 에이전트 로컬 `./gradlew test`(2026-09-14, compose MySQL).
- checked:
  - acceptance 전항목 테스트로 덮음: registration 3사·provider URI, `OAuth2UserInfo` 3사 파싱(이메일/프로필 null 케이스), `SocialAccount`/`RefreshToken` 매퍼,
    cookie 기반 `AuthorizationRequestRepository`(서명·state 불일치·변조), 성공/실패 핸들러, refresh 회전·재사용·만료, logout, `/auth/me` 401 JSON, 정지 회원 분기, `JwtAuthFilter`.
  - 계약: API.md#auth 갱신본과 응답 일치(`/auth/me` 필드, 쿠키 Path/HttpOnly/SameSite, 에러 코드).
  - 실왕복(nginx-dev :3000 경유, Playwright + curl, 사용자 로그인): **네이버 PASS**(로그인→쿠키 2개→me 200→refresh 204 회전→구 토큰 401 `TOKEN_REUSED`→logout 204→me 401),
    **구글 PASS**(로그인→me 200, 프로필·이메일 수신, 네이버와 별도 계정=D-015). JSESSIONID 미생성. 콜백 redirect_uri 가 콘솔 등록값과 일치. PKCE 자동 부여 3사 모두 수용.
  - 카카오: 콘솔 동의항목 미설정으로 KOE205 → 비즈 앱 전환·이메일 켬·프로필 사진 "사용 안함" 결정 → scope 조정 후 authorize 302 확인. 로그인 왕복 자체는 미실행.
  - 체크리스트 세션: refresh 회전·재사용 감지·로그아웃 후 401 — 통과. 권한: 비관리자 `/admin` 403 — 통합 테스트.
  - 보안: 로그에 토큰 없음(실패 로그는 error code 만). 시크릿은 `application-secret.yml`(gitignore) — `git check-ignore` 확인.
- issues:
  - (수정됨, 리뷰 중) authorization request 쿠키 TTL 5분 → 구글 로그인 15분 소요로 `authorization_request_not_found` → 10분으로 상향(`c161666`).
  - (수정됨, 파생 T-015) nginx location 헤더 상속으로 /api 경유 전부 400.
  - (블록 아님, 후속 T-013) 카카오 실제 로그인 왕복, iOS 홈화면 PWA 왕복.
  - (블록 아님, 후속 T-005) `/auth/me` `status` 추가·`provider` 대문자 — 기획자 acceptance 갱신 필요.
- date: 2026-09-14

### T-015 nginx location 헤더 상속 버그
- verdict: PASS
- tests: 없음(인프라 설정, 정당). `nginx -t` 통과 + curl 로 확인(에이전트 실행, 2026-09-14).
- checked:
  - 수정 전: `/api/actuator/health` 400 `The character [_] is never valid in a domain name`(Host=api_dev). 수정 후 200.
  - `/api/oauth2/authorization/kakao` 302 의 `redirect_uri=http://localhost:3000/api/login/oauth2/code/kakao`(포트 포함) — `$http_host` 반영 확인.
  - `default.conf` 도 같은 구조로 수정(X-Forwarded-Proto https 가 location 안에 있음).
- issues:
  - (블록 아님, 후속 T-012) 운영 DSM 뒤에서 `X-Forwarded-Proto/Host` 실제 전달 확인.
- date: 2026-09-14


### T-005 로그인 페이지 + 세션 유지 + 라우트 가드 (web)
- verdict: PASS
- tests: `cd apps/web && npm test` 41 케이스 통과(에이전트 실행, 2026-09-15). lint 0 errors, typecheck, build 통과.
  `proxy.test.ts` 6, `features/auth/*` 13, `SocialLoginButton` 4, `Toast` 3, `LoginClient` 4, `HomeClient` 3, `api.test.ts` 8.
- checked (로컬 compose nginx+MySQL, api bootRun, next dev, Playwright headed — 2026-09-15):
  - 쿠키 없이 `/` → `/login` 307. `/login` 버튼 3개 a 태그, 각 `/api/oauth2/authorization/{provider}` 302.
  - 신규 로그인 왕복: 네이버(빵선이) PASS, 카카오 2회 PASS, 구글은 silent refresh 복원으로 확인. 콜백 → `/` → `/auth/me` 200, 닉네임·공급자 표시.
  - 로그인 상태 `/login` 직접 접근 → `/` 307. 클라이언트 뒤로가기로 `/login` 복귀 시 LoginClient silent refresh 204 → `/` 복귀.
  - 세션 유지: 15분 access 만료 후 `/` 재요청 → 307 → `/login` → refresh 204 → `/`(사용자 조작 없음). 새 브라우저 컨텍스트에서도 refresh 쿠키로 복원.
  - 로그아웃 → `/login`, 이후 refresh 401. 카카오 콜백 뒤로가기 재전송 → `authorization_request_not_found` → `/login?error=` 정상.
  - `?error=access_denied` → 상단 토스트(role=alert, 5초 자동 닫힘·닫기 버튼), silent refresh 미실행. 공급자 화면에 취소 버튼이 없어 직접 URL 로 검증.
  - 390×844 라이트/다크: 제목 중앙, 소개 우측 2줄, 하단 말풍선 안 버튼 3개. 대비 제목 16.8:1, 보조문 약 5:1(AA).
  - 접근성: Tab 순서 구글→네이버→카카오, 포커스 링 3px accent, `region "로그인"`, svg aria-hidden, `lang=ko`.
  - PWA 자원: `icon.svg`/`apple-icon.png`/`icons/*.png`/manifest 200.
- issues:
  - (블록 아님) `127.0.0.1:3000` 으로 접근하면 Next dev cross-origin 차단으로 hydration 안 됨 — dev 전용, 운영 무관. 로컬은 `localhost` 사용.
  - (블록 아님) nginx dev.conf 가 `/_next/webpack-hmr` 웹소켓 업그레이드 헤더 없음 → 콘솔 HMR 오류(dev 전용, 기능 영향 없음). 원하면 별도 T 로.
  - (후속 T-013) iOS 홈화면 PWA 소셜 왕복. (후속 T-008) 토스트 zustand 스토어 승격.
- date: 2026-09-15

### T-006 채팅방 기본 CRUD + 멤버십 스키마 + 키셋 커서 (api)
- verdict: PASS (사용자 지시로 개발자 대행 기록, 2026-09-15)
- tests: 존재 / `./gradlew clean test` 128 passed, 0 failed (신규 40: `CursorCodecTest` 5, `InviteCodeTest` 3, `ChatRoomServiceTest` 15, `ChatRoomControllerIntegrationTest` 13, `MapperTest` Rooms 6·Members 3·Messages 1) / 에이전트 실행(로컬 compose MySQL).
- checked:
  - acceptance 커버리지: V2 마이그레이션 컬럼·인덱스·백필(스크래치 DB 에 V1 데이터 넣고 V2 적용 — deleted 방 ORPHANED+left_at, invite_code 8자, sender_user_id=owner, deleted_at 컬럼 제거 확인),
    도메인 5종 + `Message.senderUserId/mode`, `(last_message_at, id)` 키셋(같은 시각 강제 후 size=2 순회 중복 없음 — 서비스·통합·매퍼 3중), 50개 상한 409, 비멤버 404, 참여자 초대코드 null, PATCH 검증·권한, DELETE 분기, UTC `Z`.
  - API.md 계약 일치: 상태 코드 201/200/204/400/401/403/404/409, 에러 형식 `{code,message,details}`, Room 필드명 camelCase, 목록 `members:null`+`memberCount`.
  - SCHEMA.md 일치: `room_members` UNIQUE(room_id,user_id)·INDEX(user_id,left_at), `chat_rooms` UNIQUE(invite_code)·(owner_id)·(last_message_at DESC,id DESC) — information_schema 로 확인.
  - **실서버 수동(bootRun + HS256 직접 서명 쿠키, DB 직접 삽입 유저 2명)**: 미인증 401 `UNAUTHENTICATED` / POST 201(`inviteUrl` `http://localhost:3000/join/{8자}`, 시각 `…Z`) / title trim / size=2 순회 3페이지 5개 중복 없음·`members:null` /
    잘못된 커서(`***`, `YWJj`, `AAAA`, `x`) 400 `VALIDATION_FAILED` / PATCH 공백 400 `details.title` / 타인 GET 404 / 참여자 GET `PARTICIPANT`·`inviteCode:null`·members 2 / 참여자 PATCH 403 / OWNER DELETE 204 → owner 404, 참여자 200 `ORPHANED` memberCount 1 / 참여자 DELETE 204.
    DB: 방 `ORPHANED`, 멤버십 둘 다 `left_at` 세팅. 검증 후 QA 데이터 삭제.
  - 체크리스트 — 권한: 타인 방 404 ✓. 보안: 로그에 토큰·제목 본문 없음 ✓, 시크릿 없음 ✓(`app.time-zone` 기본값만 추가).
- issues:
  - (블록 아님, 후속) 잘못된 percent-encoding 쿼리(`?cursor=%%%25`)는 Tomcat `InvalidParameterException` 이 `GlobalExceptionHandler` 까지 와서 **500 `INTERNAL_ERROR`**. T-006 무관(전 엔드포인트 공통, T-002 핸들러). 400 매핑은 백로그.
  - (후속 T-016) 참여자 입장 경로가 없어 참여자 케이스는 DB 직접 삽입으로 검증. (후속 T-017) 참여자 나가기 시 `mode=AI` 복귀 미구현(설계대로).
- date: 2026-09-15

### T-016 초대 코드 입장 + 재발급 (api)
- verdict: PASS (사용자 지시로 개발자 대행 기록, 2026-09-15)
- tests: 존재 / `./gradlew test --rerun` 145 passed, 0 failed (신규 17: `ChatRoomServiceTest` Preview 3·Join 8·Regenerate 2, `ChatRoomControllerIntegrationTest` JoinByCode 2·Regenerate 1, `ChatRoomJoinConcurrencyTest` 1) / 에이전트 실행(로컬 compose MySQL).
- checked:
  - acceptance 커버리지: 미리보기 필드 4개, 입장 → PARTICIPANT Room(초대코드 null), 404/409 FULL/410/400 SELF/409 LIMIT(입장자 50개), 재입장 `left_at=NULL`+`joined_at` 갱신·행 1개, 이미 멤버 200, 재발급 개설자만·참여자 403·비멤버 404·구 코드 즉시 404.
  - 동시 입장: 스레드 2개 동시 → 1명 성공·1명 `ROOM_FULL`·활성 멤버 2. **`FOR UPDATE` 를 빼면 3/3 실패** 확인 — 잠금이 실제로 정원을 지킨다.
  - API.md 계약 일치: 판정 순서 404→410→400 SELF→이미 멤버 200→409 FULL→409 LIMIT(API.md 에 명시됨), 응답 JSON 필드명, `inviteUrl` = `APP_BASE_URL/join/{code}`.
  - **실서버 수동(bootRun + HS256 직접 서명 쿠키, DB 직접 삽입 유저 3명, 22 스텝)**: 미인증 401 / 미리보기 200 `{roomId,title,ownerNickname,memberCount:1}` / 잘못된 코드 404 / 본인 입장 400 `SELF_INVITE` / 손님 입장 200 `PARTICIPANT` `inviteCode:null` members 2 / 재입장 200 중복 없음 /
    3번째 미리보기·입장 409 `ROOM_FULL` / 손님 나가기 204 → DB `left_at` 세팅 → 재입장 200 → DB 행 1개·`left_at NULL`·`joined_at` 갱신 / 재발급 참여자 403·비멤버 404·개설자 200 새 8자 / 구 코드 404·새 코드 미리보기 정상·`GET /rooms/{id}` 새 코드 반영 /
    개설자 나가기 204 → 미리보기·입장(개설자 본인 포함) 410 `ROOM_ORPHANED`. 검증 후 QA 데이터 삭제.
  - 소문자 코드 입력은 DB collation(ci) 으로 200 매칭 — API.md 에 명시됨.
  - 보안: 서버 로그에 토큰·초대 코드 없음 ✓(grep 0건). WARN 은 전부 4xx `BusinessException` 해석 로그. 시크릿 없음 ✓.
- issues:
  - (블록 아님, QA 절차) `docker exec mysql` 로 한글 닉네임 삽입 시 `--default-character-set=utf8mb4` 없으면 이중 인코딩 → `ownerNickname` 깨져 보임. api 무관(HEX 로 확인). 수동 검증 시 플래그 필수.
  - (블록 아님, 후속 T-017) 참여자 나가기 시 `mode=AI` 복귀 미구현(설계대로). (후속 T-018) web 입장 화면.
- date: 2026-09-15

### T-017 나가기 분기 + 모드 토글 + AI 성격 (api)
- verdict: PASS (사용자 지시로 개발자 대행 기록, 2026-09-15)
- tests: 존재 / `./gradlew test --rerun` 161 passed, 0 failed (신규 16: `AiPersonalityTest` 2, `ChatRoomServiceTest` Update 7·Leave 2, `ChatRoomControllerIntegrationTest` PATCH 4·DELETE 1, `GlobalExceptionHandlerTest` 1) / 에이전트 실행(로컬 compose MySQL). RED(컴파일 실패) → GREEN 확인.
- checked:
  - acceptance 커버리지: 참여자 DELETE → `left_at` + `mode=AI` 복귀 / ORPHANED 방 참여자 DELETE = 멤버십 종료·방 행 유지 / `PATCH mode` 멤버 누구나, 혼자 HUMAN 400 `MODE_NOT_ALLOWED` / `PATCH aiPersonality` 개설자만·참여자 403, 기본 RATIONAL / `AiPersonality.systemPrompt()` 두 값 non-blank·상이.
  - API.md 계약 일치: 판정 순서 404 → 400 검증 → 410 ORPHANED → 403 → 400 MODE(API.md T-017 확정 문단), 빈 body `{}` 400, 잘못된 enum·깨진 JSON 400 `VALIDATION_FAILED`, 전부-아니면-전무.
  - **실서버 수동(bootRun + HS256 직접 서명 쿠키, DB 직접 삽입 유저 2명, 19 스텝 스크립트)**: 생성 201 `AI/RATIONAL` / 혼자 HUMAN 400 / `{}` 400 / `mode=FOO` 400 + 응답 메시지에 `FOO` 없음 / 깨진 JSON 400 / 공백 title 400 `details.title` /
    개설자 aiPersonality 200 / 손님 입장 → 참여자 aiPersonality 403 / 참여자 `{title,mode}` 복합 403 후 DB `mode=AI`·title 불변 / 참여자 mode HUMAN 200 / 개설자 3필드 복합 200 /
    HUMAN 상태에서 손님 나가기 204 → 개설자 GET `mode=AI`·memberCount 1 / 재입장 200 / 개설자 나가기 204 → 손님 PATCH 410 `ROOM_ORPHANED` / 손님 나가기 204 → GET 404·DB status ORPHANED 행 유지 / 나간 뒤 PATCH 404. 검증 후 QA 데이터 삭제(잔여 0).
  - 잠금: `update`·`leave` 모두 `findByIdForUpdate` 로 방 행을 잠근 뒤 멤버 수 판정 — T-016 과 같은 패턴. 별도 동시성 테스트는 없음(개발자 note 명시).
  - 보안: 서버 로그에 토큰·쿠키 없음 ✓, ERROR·스택트레이스 0 ✓, 시크릿 없음 ✓. 잘못된 enum 500 → 400 으로 개선 확인(이전 T-006 백로그 "잘못된 percent-encoding 쿼리 500" 과는 별개).
- issues:
  - (블록 아님, 백로그) Spring `ExceptionHandlerExceptionResolver` 의 WARN 이 Jackson 메시지를 그대로 남겨 잘못된 enum 값(예: `"FOO"`)이 로그에 찍힌다. 우리 핸들러 응답·로그는 깨끗함. 필요 시 해당 로거 레벨 조정 또는 `warnLogCategory` 비활성화 — CONVENTIONS "본문 로그 금지" 관점에서 T-007 착수 전 CEO 판단.
  - (후속 T-007) `mode` 변경·멤버 이탈 SSE 브로드캐스트. (후속 T-008/T-018) web 토글·나가기 UI.
- date: 2026-09-15

### T-019 어드민 페르소나 폐지 + 방 AI 프롬프트 편집 (api)
- verdict: PASS (사용자 지시로 개발자 대행 기록, 2026-09-16)
- tests: 존재 / `./gradlew test` 166 passed, 0 failed (신규 9: `ChatRoomServiceTest` Update 6, `ChatRoomControllerIntegrationTest` PATCH 2, `MapperTest` Rooms 1; `MapperTest.Personas` 4 삭제) / 에이전트 실행(로컬 compose MySQL). RED(컴파일 실패) → GREEN 확인.
- checked:
  - Flyway V3 로컬 적용: `flyway_schema_history` 1/2/3 success, `personas` 테이블 없음, `chat_rooms.ai_prompt TEXT NULL` 존재.
  - acceptance 커버리지: `aiPrompt` 개설자만(참여자 403), trim 저장, `""`/공백 → null 초기화, 2,001자 400 `details.aiPrompt`, 필드 없음 = 변경 없음, `{}` 400 유지 / `aiPersonality` 재선택 시 `aiPrompt` null, 둘 다 한 요청이면 커스텀 / `effectiveAiPrompt` 목록·상세 멤버 전원 / ORPHANED 410.
  - API.md 계약 일치: Room JSON `aiPrompt`/`effectiveAiPrompt` 필드명, PATCH 규칙 문단, 변경 이력, `/admin/personas` 폐기 표시. `ErrorCode.PERSONA_*` 삭제 ↔ API.md 에러 표에 해당 코드 없음.
  - **실서버 수동(bootRun, secret 파일 제외 기본 설정 + HS256 직접 서명 쿠키, DB 직접 삽입 유저 2명, 14 스텝)**: 미인증 401 / 생성 201 `RATIONAL`·`aiPrompt null`·`effectiveAiPrompt` 프리셋 문구 / 손님 입장 200 / 개설자 `"  반말로 짧게  "` → 200 trim / 참여자 403 / 참여자 상세·목록에 `effectiveAiPrompt` 노출·`inviteCode null` /
    2,001자 400 `details.aiPrompt` / `EMOTIONAL` 재선택 → `aiPrompt null`·감성 문구 / `{RATIONAL, "둘 다"}` → 커스텀 유지 / `""` → null·DB `ai_prompt IS NULL` / `{}` 400 / 개설자 나가기 204 → 참여자 PATCH 410. 검증 후 QA 데이터 삭제(잔여 0).
  - 보안: 서버 로그 ERROR 0, 토큰(`eyJ`) 0, WARN 4 는 전부 4xx 해석 로그(T-017 백로그와 동일 유형, 본문 값 없음). 시크릿 없음 ✓.
- issues:
  - (블록 아님) `@Size` 메시지가 한글 로케일 기본 문구("크기가 0에서 2000 사이여야 합니다") — 프론트는 `details` 키만 쓰므로 영향 없음. 필요 시 T-008 에서 문구 통일.
  - (후속 T-007) `effectiveAiPrompt()` 컨텍스트 조립. (후속 T-008) 프롬프트 편집 UI. (후속 T-011) 어드민 persona 화면 제거 반영.
- date: 2026-09-16

