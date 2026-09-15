# to-qa — 검증 요청

> 받는 역할: QA. 개발자가 REVIEW로 전환하며 남긴다. 검증 후 QA_REPORT.md 기록 + `[처리됨 날짜]`.

### [개발자 → QA] T-000 스캐폴드 검증 요청 [처리됨 2026-09-13]
- 요청/이슈: 레포 구조·compose·workflow 문법·문서 정합성 확인.
- 근거 파일: README.md, infra/*, .github/workflows/*
- 결과: QA_REPORT.md#T-000 PASS
- date: 2026-09-13

### [개발자 → QA] T-004 소셜 로그인 + JWT 쿠키 + refresh 회전 검증 요청 [처리됨 2026-09-14]
- 요청/이슈: `cd apps/api && ./gradlew test` 88 케이스 통과 확인(compose MySQL 필요). acceptance 대비 커버리지 검토.
  실제 공급자 왕복은 OAUTH_* 키가 있어야 하므로 로컬 `application-secret.yml` 준비 후 수동: 카카오/네이버/구글 각각
  `http://localhost:3000/api/oauth2/authorization/{provider}` → 콜백 → `/` 302 + 쿠키 2개 → `GET /api/auth/me` 200.
- 근거 파일: API.md#auth(변경 이력 2026-09-14), TASKS.md#T-004 note, `apps/api/src/test/java/com/example/chat/auth/**`
- 확인 포인트: (1) 세션 쿠키(JSESSIONID) 안 생김 (2) refresh 재사용 시 최신 토큰까지 무효 (3) 정지 회원 `/auth/me` 200·그 외 403
  (4) `/auth/refresh` 실패 시 쿠키 2개 삭제 (5) `?error=` 코드가 `[a-z0-9_]` 외 값으로 안 나감.
- API 변경: refresh 쿠키 Path, `/auth/me` `status`·`provider` 대문자 → 기획자가 T-005 acceptance 갱신 필요.
- date: 2026-09-14

### [개발자 → QA] T-005 로그인 페이지 + 세션 유지 + 라우트 가드 검증 요청 [처리됨 2026-09-15]
- 요청/이슈: `cd apps/web && npm test && npm run lint && npm run typecheck && npm run build` 통과 확인(38 케이스).
  수동: compose dev + api + `npm run dev` 띄우고 `http://localhost:3000` 접속.
- 근거 파일: TASKS.md#T-005 note, `apps/web/proxy.ts`, `apps/web/app/(auth)/login/*`, `apps/web/app/features/auth/*`
- 확인 포인트:
  (1) 쿠키 없이 `/` → `/login` 302. `/login` 에서 버튼 3개 → 각 `/api/oauth2/authorization/{provider}` 로 **전체 페이지 이동**(a 태그).
  (2) 로그인 왕복 후 `/` 에 닉네임·공급자 표시. 로그인 상태에서 `/login` 직접 접근 → `/` 302.
  (3) **세션 유지**: 로그인 후 15분 이상 지나 새 탭에서 `/` 열기 → `/login` 스켈레톤 잠깐 → 자동으로 `/` 복귀(silent refresh). DevTools 에서 `access_token` 쿠키만 지우고 새로고침해도 같은 동작.
  (4) 로그아웃 버튼 → `/login`, 이후 `/` 접근 시 다시 `/login`. refresh 쿠키도 사라졌는지.
  (5) 공급자 동의 화면에서 취소 → `/login?error=access_denied` 인라인 알림(빨간 박스) + 버튼 노출, silent refresh 없음(네트워크 탭에 `/auth/refresh` 안 나감).
  (6) 390×844 뷰포트: 제목 2줄·소개문 단어 단위 줄바꿈, 버튼 하단 고정, 다크 모드 대비(시스템 설정 전환).
  (7) 키보드 Tab 으로 버튼 3개 포커스 링 보임. 알림 `role="alert"`, 확인 중 `role="status"`.
- 범위 외(기존 미결): `icons/*.png` 404 (T-001 note, DESIGN.md 아이콘 미결), 약관/개인정보 링크 없음(v1 결정).
- 추가(2026-09-15): 개발자가 (1)(2)(3)(4) 를 로컬 실왕복으로 확인함(TASKS.md#T-005 note). 남은 확인: (5) 취소 경로 실왕복, (6)(7) 반응형·접근성, 카카오 왕복.
  표시명 "뒷담 친구" + 핑크 테마 적용됨 — 라이트/다크 대비 확인 포함.
- 결과: QA_REPORT.md#T-005 PASS (2026-09-15, 사용자 지시로 개발자 대행 기록)
- date: 2026-09-14

### [개발자 → QA] T-006 채팅방 CRUD + 멤버십 스키마 + 키셋 커서 (api) 검증 요청 [처리됨 2026-09-15]
- 요청/이슈: `cd infra && docker compose -f docker-compose.dev.yml up -d mysql` 후 `cd apps/api && ./gradlew test` 통과 확인(128 케이스, T-006 신규 40).
  Flyway V2 가 로컬 DB 에 적용된다(되돌리려면 volume 삭제).
- 근거 파일: TASKS.md#T-006, API.md#rooms(2026-09-15 구현 이력), SCHEMA.md #4 #4-1 #5, `apps/api/src/main/resources/db/migration/V2__rooms_members.sql`,
  `apps/api/src/main/java/com/example/chat/chatroom/*`, `global/{AppProperties,CursorCodec,CursorPage}`
- 확인 포인트:
  (1) 테스트 존재: `CursorCodecTest` 5, `InviteCodeTest` 3, `ChatRoomServiceTest` 15, `ChatRoomControllerIntegrationTest` 13, `MapperTest` Rooms 6·Members 3·Messages 1.
  (2) 수동(curl, 로그인 쿠키 필요 — 브라우저 로그인 후 DevTools 쿠키 복사): `POST /api/rooms` 201 에 `inviteCode` 8자·`inviteUrl` `http://localhost:3000/join/{code}`, 시간 `...Z`.
      `GET /api/rooms?size=2` → `nextCursor` 로 끝까지 순회 시 중복 없음. `PATCH` 공백 title 400 `details.title`. `DELETE` 204 후 `GET` 404.
  (3) 다른 계정으로 `GET /api/rooms/{id}` → 404 `ROOM_NOT_FOUND`(403 아님, API.md 통일 규칙).
  (4) V2 백필: 로컬 DB 에 V1 방이 있었다면 `chat_rooms.invite_code` 채워짐·`room_members` OWNER 행 있음·`deleted_at` 컬럼 없음. (개발자는 스크래치 DB 에서 V1→V2 왕복 확인함)
  (5) 참여자 경로(입장 API 없음 — T-016)는 통합 테스트로만 커버: 참여자 `PATCH title` 403, `inviteCode` null, ORPHANED 방 200.
- 범위 외: 초대 입장/재발급(T-016), 참여자 나가기 시 mode 복귀·mode/aiPersonality PATCH(T-017).
- 결과: QA_REPORT.md#T-006 PASS (2026-09-15, 사용자 지시로 개발자 대행 기록)
- date: 2026-09-15

### [개발자 → QA] T-016 초대 코드 입장 + 재발급 (api) 검증 요청
- 요청/이슈: `cd infra && docker compose -f docker-compose.dev.yml up -d mysql` 후 `cd apps/api && ./gradlew test` 통과 확인(145 케이스, T-016 신규 17).
  수동(선택): api 기동 후 사용자 2명 쿠키로 `POST /api/rooms` → `GET/POST /api/rooms/join/{code}` → `POST /api/rooms/{id}/invite/regenerate` → 구 코드 404.
- 근거 파일: API.md#rooms(판정 순서 추가), TASKS.md#T-016 note, `apps/api/src/test/java/com/example/chat/chatroom/{ChatRoomServiceTest,ChatRoomControllerIntegrationTest,ChatRoomJoinConcurrencyTest}.java`
- 확인 포인트:
  (1) 판정 순서 404 → 410 → 400 SELF → 이미 멤버 200 → 409 FULL → 409 LIMIT. 개설자가 본인 코드로 입장 시 400(200 아님).
  (2) 재입장: `left_at` NULL 복구 + `joined_at` 갱신, `room_members` 행은 방당 유저 1개 유지.
  (3) 동시 입장 2명 → 1명 성공·1명 `ROOM_FULL`, 활성 멤버 2명(`ChatRoomJoinConcurrencyTest`). 이 테스트는 실제 커밋 후 `@AfterEach` 삭제 — 실패 시 `users`/`chat_rooms` 에 "주인/손님A/손님B" 잔여 행 가능.
  (4) 재발급: 개설자 200 `{inviteCode, inviteUrl}`, 참여자 403, 비멤버 404, 구 코드 즉시 404.
  (5) 미리보기 응답 `{ roomId, title, ownerNickname, memberCount }` 만 — 초대 코드·멤버 목록 미노출.
- 범위 외: 참여자 나가기 시 mode 복귀·mode/aiPersonality PATCH(T-017), web 입장 화면(T-018).
- date: 2026-09-15
