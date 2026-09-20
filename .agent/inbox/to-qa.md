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

### [개발자 → QA] T-016 초대 코드 입장 + 재발급 (api) 검증 요청 [처리됨 2026-09-15]
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
- 결과: QA_REPORT.md#T-016 PASS (2026-09-15, 사용자 지시로 개발자 대행 기록)
- date: 2026-09-15

### [개발자 → QA] T-017 나가기 분기 + 모드 토글 + AI 성격 (api) 검증 요청 [처리됨 2026-09-15]
- 요청/이슈: `cd infra && docker compose -f docker-compose.dev.yml up -d mysql` 후 `cd apps/api && ./gradlew test` 통과 확인(161 케이스, T-017 신규 16).
  수동(선택): 사용자 2명 쿠키로 `POST /api/rooms` → 손님 `POST /api/rooms/join/{code}` → `PATCH /api/rooms/{id}` `{"mode":"HUMAN"}` 200 → 손님 `DELETE` 204 → 주인 `GET` 에서 `mode` `AI`.
- 근거 파일: API.md#rooms(T-017 확정 문단 + 변경 이력), TASKS.md#T-017 note, `apps/api/src/main/java/com/example/chat/chatroom/{AiPersonality,RoomUpdate,ChatRoomService}.java`,
  `global/error/GlobalExceptionHandler.java`, `apps/api/src/test/java/com/example/chat/chatroom/{AiPersonalityTest,ChatRoomServiceTest,ChatRoomControllerIntegrationTest}.java`
- 확인 포인트:
  (1) PATCH 판정 순서 404 → 400 검증(`{}`·공백 title·잘못된 enum) → 410 ORPHANED → 403(참여자가 title/aiPersonality) → 400 `MODE_NOT_ALLOWED`(혼자인데 HUMAN).
  (2) 복합 요청 전부-아니면-전무: 참여자 `{"title":"x","mode":"HUMAN"}` 403 이고 mode 도 안 바뀜.
  (3) 참여자 나가기 → `mode=AI` 복귀. ORPHANED 방 참여자 나가기 → 204, 방 행 유지, 이후 404. 개설자 나가기 분기는 T-006 그대로.
  (4) `"mode":"FOO"` / 깨진 JSON → 400 `VALIDATION_FAILED`, 메시지에 본문 값 미노출(이전엔 500).
  (5) `AiPersonality.systemPrompt()` 두 값 비어 있지 않고 서로 다름 — 문구는 초안, T-007 컨텍스트에서 사용.
- 범위 외: `mode`/`member` SSE 브로드캐스트(T-007), web 화면(T-008/T-018).
- 결과: QA_REPORT.md#T-017 PASS (2026-09-15, 사용자 지시로 개발자 대행 기록)
- date: 2026-09-15

### [개발자 → QA] T-019 어드민 페르소나 폐지 + 방 AI 프롬프트 편집 (api) 검증 요청 [처리됨 2026-09-16]
- 요청/이슈: `cd infra && docker compose -f docker-compose.dev.yml up -d mysql` 후 `cd apps/api && ./gradlew test` 통과 확인(166 케이스, T-019 신규 9, Persona 4 삭제). Flyway V3 가 기존 로컬 DB 의 `personas` 를 DROP 한다.
  수동(선택): 개설자 쿠키로 `PATCH /api/rooms/{id}` `{"aiPrompt":" 반말로 짧게 "}` 200 → `aiPrompt` "반말로 짧게", `effectiveAiPrompt` 동일 → `{"aiPersonality":"EMOTIONAL"}` 200 → `aiPrompt` null, `effectiveAiPrompt` 감성 프리셋 문구.
- 근거 파일: DECISIONS.md#D-017, API.md#rooms(변경 이력 2026-09-16), SCHEMA.md #4/#6, `apps/api/src/main/resources/db/migration/V3__room_ai_prompt.sql`,
  `apps/api/src/main/java/com/example/chat/chatroom/{ChatRoom,RoomUpdate,RoomResponse,ChatRoomService}.java`, `apps/api/src/test/java/com/example/chat/{MapperTest,chatroom/ChatRoomServiceTest,chatroom/ChatRoomControllerIntegrationTest}.java`
- 확인 포인트:
  (1) `aiPrompt` 는 개설자만(참여자 403), 조회는 멤버 전원(`effectiveAiPrompt` 목록·상세 둘 다).
  (2) `""`/공백 → null 초기화, 2,001자 → 400 `details.aiPrompt`, 필드 없음 → 변경 없음. `{}` 는 여전히 400.
  (3) `aiPersonality` 재선택 시 `aiPrompt` null. 둘 다 한 요청이면 커스텀이 남는다.
  (4) `persona/*`·`PersonaMapper.xml`·`ErrorCode.PERSONA_*` 삭제, `/admin/personas` API.md 에서 폐기 표시.
- 범위 외: T-007 컨텍스트 조립(`effectiveAiPrompt()` 사용), web 편집 UI(T-008).
- 결과: QA_REPORT.md#T-019 PASS (2026-09-16, 사용자 지시로 개발자 대행 기록)
- date: 2026-09-16

### [개발자 → QA] T-007 방 이벤트 SSE + 직렬 큐 + 컨텍스트 + OmniRoute 클라이언트 (api) 검증 요청 [처리됨 2026-09-16]
- 요청/이슈: `cd infra && docker compose -f docker-compose.dev.yml up -d mysql` 후 `cd apps/api && ./gradlew test` 통과 확인(215 케이스, T-007 신규 42).
  수동(선택, OmniRoute 기동 필요): 터미널 A `curl -N -b access=<jwt> localhost:8080/api/rooms/{id}/events` → 터미널 B `curl -b access=<jwt> -H 'Content-Type: application/json' -d '{"content":"안녕"}' localhost:8080/api/rooms/{id}/messages` → A 에 `message` → `delta`… → `done` 순서, 20초 간격 `: ping`. nginx(:3000) 경유도 동일하게 버퍼링 없이 도착하는지.
- 근거 파일: DECISIONS.md#D-018/#D-019, API.md#messages(확정)·#공통(503), CONVENTIONS.md#백엔드(SSE 규칙),
  `apps/api/src/main/java/com/example/chat/llm/{LlmClient,OmniRouteClient,LlmException}.java`,
  `apps/api/src/main/java/com/example/chat/message/{RoomEventBus,RoomAiExecutor,AiExecutorConfig,AiExecutorProperties,AiContextBuilder,MessageService,MessageController,MessageResponse,DailyUsage,DailyUsageMapper}.java`,
  `apps/api/src/main/resources/mapper/{DailyUsageMapper,MessageMapper,RoomMemberMapper}.xml`, `application.yml`(app.ai.*, logging), `chatroom/ChatRoomService.java`(mode/member 발행),
  테스트 `src/test/java/com/example/chat/{llm/OmniRouteClientTest, message/*, MapperTest, chatroom/ChatRoomServiceTest#Events}.java`
- 확인 포인트:
  (1) POST 202 `{messageId}`; 비멤버·나간 멤버 404, ORPHANED 410, 공백/4,001자/잘못된 inputType 400(저장 없음).
  (2) 이벤트 순서 `message` → `delta`* → `done`(ASSISTANT 저장·토큰 발신자 귀속) / 실패 시 `error`(미저장·토큰 0). HUMAN 모드는 `message` 만.
  (3) 큐: 같은 방 순차·다른 방 병렬, 같은 유저 진행·대기 중 409 `ROOM_BUSY`(저장 전 판정), 풀 포화 503 `AI_BUSY`, 잡 시작 시 HUMAN 이면 skip, 예외 잡이 큐를 막지 않음.
  (4) 컨텍스트: system = 유효 프롬프트 + D-019 가중 문구(참여자 있던 방만), USER `[개설자 닉]`/`[참여자 닉]`(나간 멤버·HUMAN 대화 포함), 최근 30 시간순, 방금 보낸 메시지 포함.
  (5) `mode`/`member` 이벤트: PATCH mode, join(JOINED, 재입장 중복 없음), 참여자 leave(LEFT → mode AI), 개설자 leave(LEFT, roomStatus ORPHANED).
  (6) 제목 자동: "새 대화" + 첫 메시지 → 앞 30자, 이후·직접 정한 제목은 불변.
  (7) 하트비트: mock 구독자 전원에 `:ping`; 끊긴 emitter 는 send 실패/완료/타임아웃 시 제거.
  (8) 로그: `ExceptionHandlerExceptionResolver` WARN 억제(잘못된 enum 값 미노출), 시크릿·본문 로그 없음.
- 범위 외: web(T-008/T-018), STT/TTS(T-009), admin stats(daily_usage 조회, T-011), 수평 확장(Redis).
- 결과: QA_REPORT.md#T-007 PASS (2026-09-16, 사용자 지시로 개발자 대행 기록). 실서버 검증 중 발견 2건(시큐리티 ASYNC/ERROR 디스패치, `: connected`) 수정 후 217 통과.
- date: 2026-09-16

### [개발자 → QA] T-008 채팅 셸 + 방 생성 + 모드/성격 + 스트리밍 UI (web) 검증 요청 [처리됨 2026-09-16, QA_REPORT.md#T-008]
- 요청/이슈: `cd apps/web && npm test && npm run lint && npm run typecheck && npm run build` 통과 확인(33 파일 166 케이스, lint 경고 1건은 기존 `api.ts` `_retry`).
  수동(compose dev + api + `npm run dev`, 브라우저 `http://localhost:3000`): 로그인 → `/` 가 최신 방으로 이동(방 없으면 빈 상태 + "+ 새 방") → 새 방 → 메시지 전송 → 점 3개 → 델타 → 완료 말풍선. 두 계정으로 2인 방(T-016 join 은 curl/API 로) 후 모드 토글·시스템 라인·상대 말풍선.
- 근거 파일: DECISIONS.md#D-020, DESIGN.md#2~3, BRAND.md#5, API.md#rooms/#messages,
  `apps/web/app/(chat)/{layout,page,RootRedirect}.tsx`, `apps/web/app/(chat)/rooms/[id]/page.tsx`,
  `apps/web/app/components/ui/{PillToggle,Badge,Avatar,Sheet,ConfirmDialog,Skeleton,Input,Toast}.tsx`,
  `apps/web/app/components/chat/{ChatShell,Sidebar,RoomListItem,RoomHeaderSheet,AiPromptEditor,MessageList,MessageBubble,RoomView,Composer}.tsx`,
  `apps/web/app/features/rooms/{types,useRooms}.ts`, `apps/web/app/features/messages/{types,cache,streamStore,useMessages,useRoomEvents,sendErrorMessage}.ts`, `apps/web/app/lib/{sse,time}.ts`
- 확인 포인트:
  (1) 셸: 모바일 390 상단 바 56 + 햄버거 드로어(경로 바뀌면 닫힘), 데스크톱 ≥1024 사이드바 280 고정. 제목 탭 → 방 헤더 시트(모바일 바텀/데스크톱 중앙 360).
  (2) 사이드바: "+ 새 방" → `POST /rooms` → 이동. 항목 `주인`/`닫힘` 배지·상대 시간(방금/n분 전/n시간 전/어제/M.D)·활성 표시. … 메뉴 제목 수정(개설자만, Enter/Escape)·나가기 ConfirmDialog(개설자/참여자 문구 다름) → `DELETE` → `/`.
  (3) 방 헤더: 혼자면 모드 토글 비활성 + "둘이 되면 켜져", 2명이면 `PATCH mode` 즉시, 실패 시 토스트 + 되돌림. AI 성격: 개설자만 프리셋·직접 쓰기(2,000자 카운터, blur 저장, 되돌리기 → `aiPrompt ""`), 참여자는 읽기 전용 + `effectiveAiPrompt`.
  (4) 메시지: 나/상대/AI 3종 구분, 연속 발신자 아바타·닉네임 생략, 날짜 칩(KST), VOICE 마이크, 시스템 라인(mode/member). 상단 "이전 대화"/IO 로 과거 페이지, 스크롤 위치 유지.
  (5) 스트리밍: `message` → 점 3개(reduced-motion 시 정적) → `delta` 누적 + ▍ → `done` 저장. `error` → "삐끗했다. 다시 해볼까?" + "다시"(같은 content 재전송). `replyTo` 별 분리(2인 동시 잡).
  (6) 입력창: 내 잡 대기 중 잠금("답 쓰는 중… 잠깐만"), 상대는 가능. 409 → "아직 답 쓰는 중. 좀만 기다려", 503 → "지금 너무 바빠…", 낙관 말풍선 롤백. ORPHANED 방은 "주인이 도망간 방이야" 잠금.
  (7) 토스트: 필·그림자 없음·3초, 오류 danger-bg/danger. 로그인 화면 오류 토스트도 같은 스펙.
  (8) 접근성: 아이콘 버튼 aria-label, 스트리밍 `aria-live=polite`, 필 토글 radiogroup·방향키, 포커스 링 accent, 모달 Escape.
  (9) nginx 경유 SSE: 델타가 버퍼링 없이 순서대로, 재연결 시 놓친 메시지 보충(`GET messages` 무효화).
- 범위 외: 초대 공유 시트·`/join`·ORPHANED 확인 모달(T-018), 보이스(T-010), 테마 수동 선택(T-020), PWA 서비스워커(T-014).
- date: 2026-09-16

### [개발자 → QA] T-022 OAuth `next` 복귀 + `alreadyMember` (api) / T-018 초대 입장·공유·ORPHANED 모달 (web) 검증 요청 [처리됨 2026-09-16, QA_REPORT.md#T-022/T-018]
- 요청/이슈: api `cd apps/api && ./gradlew test`(240 통과), web `cd apps/web && npm test && npm run lint && npm run typecheck && npm run build`(219 통과) 확인.
  수동(compose dev + api + `npm run dev`, 브라우저 `http://localhost:3000`, 계정 2개 — 개설자 A / 참여자 B):
  A 로그인 → 방 생성 → 상단 제목 탭 → 방 정보 시트 "초대" → 초대 시트(QR·코드·링크 복사·공유·재발급) → 링크를 B 의 **로그아웃 상태** 브라우저에 붙여넣기 → `/login?next=/join/{code}` → 소셜 로그인 → `/join/{code}` 로 복귀 → "들어갈래" → 방 입장 → A 화면에 "B 등장!" + 초대 시트 자동 닫힘.
  A 나가기 → B 화면에 "이용할 수 없는 채팅방입니다." 모달 → "알았어" → B 목록에서 방 제거.
- 근거 파일: DECISIONS.md#D-021, API.md#auth/#rooms, DESIGN.md#4~6, BRAND.md#5,
  api `auth/oauth2/{NextPath,NextPathAuthorizationRequestResolver,OAuth2SuccessHandler}.java`, `global/config/SecurityConfig.java`, `chatroom/JoinPreviewResponse.java`,
  web `proxy.ts`, `app/lib/{nextPath,josa}.ts`, `app/(auth)/login/{page,LoginClient}.tsx`, `app/(auth)/join/[code]/{page,JoinClient}.tsx`,
  `app/components/ui/QrCode.tsx`, `app/components/chat/{InviteSheet,OrphanedDialog,ChatShell,RoomView}.tsx`, `app/features/rooms/{useInvite,joinErrorMessage,types}.ts`, `app/features/messages/{useMessages,sendErrorMessage}.ts`, `app/globals.css`(--qr-*)
- 확인 포인트:
  (1) **next 왕복(핵심, 개발자 미검증)**: 로그아웃 상태에서 `/join/{code}` → `/login?next=` → 소셜 로그인(구글·네이버·카카오 각 1회) → `/join/{code}` 복귀. 실패 시 `/login?error=` 로 가고 next 는 사라져도 됨. `next=https://evil` 같은 값은 `/` 로.
  (2) 이미 로그인된 채 `/login?next=/join/{code}` 직접 입력 → proxy 가 바로 `/join/{code}`. 이미 멤버가 링크 재방문 → 버튼 "다시 들어가기".
  (3) `/join` 실패 5종 문구(BRAND 표) + "내 방으로": 없는 코드 / 꽉 찬 방(3번째 계정) / 주인 나간 방 / 본인 방(A 가 자기 링크) / 50개 초과(가능하면). api 껐을 때 "삐끗했다. 다시 해볼까?" + "다시".
  (4) 초대 시트: **휴대폰 카메라로 QR 스캔**(라이트·다크 모드 둘 다 — 카드는 항상 밝은 배경) → `/join/{code}` 열림. 코드 "XXXX XXXX" 표시·복사값은 8자 연속·토스트. 링크 복사. "공유하기" 는 share 지원 브라우저(모바일 Safari/Chrome, 데스크톱 Safari)에만 노출. 재발급 → 확인 모달 → 새 코드, 옛 링크는 404.
  (5) ORPHANED 모달 3경로: B 가 방 안에 있을 때 A 나가기(SSE) / B 가 목록에서 `닫힘` 방 탭 / B 가 옛 화면에서 전송(410). 모두 같은 모달, 토스트 없음, 뒤 대화 딤 + 입력 잠김, 닫기 없음. "알았어" → `DELETE` → `/`(남은 방 또는 빈 상태). A(개설자) 화면엔 모달 없음.
  (6) 초대 시트가 열린 채 B 입장 → 시트 자동 닫힘 + "B 등장!". B 나가기 → A 방 정보 시트에 "초대" 다시 노출.
  (7) 입장 화면 레이아웃(390): 제목 "초대장 도착", 우측 소개 2줄("{닉}이(가) 부른 방" 조사 맞는지 — 받침 유무), 말풍선 꼬리 발치 개설자 아바타, 하단 safe-area 잘림 없음. 다크 모드 반전.
  (8) 접근성: 시트 dialog 라벨 "친구 데려오기", 복사 버튼 aria-label "코드 복사", QR `role=img` "초대 QR", 모달 포커스 "알았어".
- 범위 외: 쌍당 방 1개 규칙(미등록, 별도 T), 보이스(T-010), 테마 수동 선택(T-020), PWA(T-013/T-014).
- date: 2026-09-16

### [개발자 → QA] T-023 쌍당 방 1개 입장 거절 (api+web) / T-024 빈 방 vs 시스템 라인 (web) 검증 요청 [처리됨 2026-09-16, QA_REPORT.md#T-023/T-024]
- 요청/이슈: api 243 · web 221 통과 확인. 실브라우저(2계정): A 방 X 에 B 입장 후 A 가 방 Y 를 만들어 링크를 B 가 열면 "걔랑은 이미 방 있잖아" + 내 방으로. B 가 X 를 나가면 Y 입장 가능. 빈 방에 친구가 들어오면 "등장!" 라인이 보이는지.
- 근거 파일: D-022, API.md#rooms, `apps/api/.../ChatRoomService.checkJoinable`, `mapper/RoomMemberMapper.xml`, `apps/web/app/features/rooms/joinErrorMessage.ts`, `apps/web/app/components/chat/RoomView.tsx`
- date: 2026-09-16

### [개발자 → QA] T-021 메시지 발신자 닉네임 보존 (api+web) 검증 요청 [처리됨 2026-09-16, QA_REPORT.md#T-021]
- 요청/이슈: api `cd apps/api && ./gradlew test`(244 통과), web `cd apps/web && npm test && npm run lint && npm run typecheck && npm run build`(223 통과) 확인.
  실브라우저(2계정): A 방에 B 입장 → B 가 메시지 2~3개 전송 → B 나가기 → **A 화면에서 B 의 과거 메시지 발신자 이름이 "B 닉" 그대로**(이전엔 "나간 사람"). 새로고침 후에도 같음. B 재입장 후에도 같음.
  `GET /rooms/{id}/messages` 응답 `items[].senderNickname` — USER 는 닉, ASSISTANT 는 null. SSE `message` 이벤트에도 `senderNickname` 포함.
- 근거 파일: D-023, API.md#messages, `apps/api/.../message/{Message,MessageResponse}.java`, `mapper/MessageMapper.xml`, `apps/web/app/components/chat/MessageList.tsx`, `app/features/messages/types.ts`
- 범위 외: 닉네임 변경 시 과거 메시지도 새 닉으로 보임(D-023 의도). 방 상세 `members` 는 그대로 활성 멤버만.
- date: 2026-09-16

### [개발자 → QA] T-020 테마 수동 선택(시스템/라이트/다크) (web) 검증 요청 [처리됨 2026-09-17, QA_REPORT.md#T-020]
- 요청/이슈: web `cd apps/web && npm test && npm run lint && npm run typecheck && npm run build`(240 통과) 확인.
  실브라우저(로그인 필요, 데스크톱 + 모바일 390):
  (1) 사이드바 하단 프로필·로그아웃 줄 **아래** 우측에 필 토글 `시스템 | 라이트 | 다크`. 좌측 라벨 없음. 모바일 드로어에서도 같은 위치, safe-area 잘림 없음.
  (2) 라이트/다크 탭 → 즉시 전체 반전(surface 반전 포함), 새로고침·다른 방 이동·로그인 화면·`/join` 에서도 유지, **첫 페인트 깜빡임 없음**(다크 강제 + OS 라이트에서 새로고침 여러 번).
  (3) 시스템 탭 → `localStorage.theme` 키 삭제, OS 설정 따라감. OS 를 바꾸면(맥 시스템 설정) 시스템 모드에서만 따라오고 고정 모드에선 무시.
  (4) `<meta name="theme-color">` 가 **항상 1개**이고 content 가 적용 모드의 `--bg`(#fff4f8 / #170611). iOS 홈화면 PWA 상태바 색이 선택 모드를 따르는지(가능하면).
  (5) 초대 QR 카드는 다크 강제에서도 밝은 바탕(D-021 E3 유지).
  (6) 접근성: `radiogroup` "테마 선택", 방향키 이동, 포커스 링. 활성 칸은 색 + 굵기.
  (7) 다른 탭에서 바꾸면 이 탭도 따라옴(storage 이벤트).
- 근거 파일: D-024, DESIGN.md#원칙·#2, BRAND.md#2·#5, `apps/web/app/lib/{theme,themeInit}.ts`, `components/chat/ThemePicker.tsx`, `Sidebar.tsx`, `app/layout.tsx`, `globals.css`
- 개발자 실측(2026-09-17, 구글 계정, OS 다크): (1)(2)(3)(4)(5)(6) 통과 — TASKS.md T-020 note. 미실측: (2) OS 라이트 + 다크 강제 첫 페인트 깜빡임(내 맥은 다크), (4) iOS PWA 상태바, (7) 다른 탭 동기화(단위 테스트만).
- 범위 외: 어드민(M4) 테마, 서버 저장(기기별 localStorage 가 스펙). PillToggle 방향키 시 DOM 포커스가 원래 칸에 남는 건 기존 동작(모드 토글 동일).
- date: 2026-09-16 (실측 추가 2026-09-17)

### [개발자 → QA] T-025 UI 문구 전면 개정 검증 요청 [처리됨 2026-09-17, QA_REPORT PASS]
- 요청/이슈: `inbox/copy-inventory.md` 수정안 52건 + 공용 오류 문구 교체 + 서버 메시지 토스트 폐지(D-025). 단위 240 통과.
  실브라우저(로그인 필요, 모바일 390 우선):
  (1) 사이드바 빈 상태 "아직 방이 없네? 하나 만들자!", OWNER 배지 "방장", 나가기 확인이 **두 줄**("나가면 이 방은 끝이야." / "진짜 나갈거야?") + 버튼 "나갈래 / 안 나갈래".
  (2) 방: 빈 방 "오늘은 누가 짜증나게 했어?", 입력 플레이스홀더 "무슨 얘기 하고싶어?" / HUMAN "AI 몰래 얘기하기", 내 답 대기 잠김 "뒷담 친구 기다리는 중...".
  (3) 방 헤더 시트: 혼자일 때 토글 밑 "친구 초대해봐!", 성격 편집 "직접 쓰기 / 되돌리기", 플레이스홀더 "AI 성격 어떻게 설정하고 싶어?".
  (4) 초대 시트: 복사 토스트 "복사 완료", 재발급 확인 두 줄("이전 코드는 사용할 수 없어." / "새로 만들까?").
  (5) 모드 전환 시스템 라인 "유저끼리 대화 가능!" ↔ "AI랑 대화 가능!", 퇴장 "{닉} 퇴장!".
  (6) `/join/{code}`: 소개문 "{닉}의 방 / 같이 뒷담화하자!", 버튼 "들어가기"(이미 멤버여도 동일), 실패 문구 6종(copy-inventory §2-9), 보조 버튼 "내 방 가기".
  (7) 참여자 ORPHANED 모달 "이용할 수 없는 채팅방이야." / "방장이 도망간 방이야!" / 버튼 "나가기" → `/`.
  (8) 오류 토스트가 **서버 존댓말 문구를 그대로 보이지 않는지**: 4,001자 전송 → "불가능한 요청이야!", 그 외 실패 → "시스템 오류. 다시 시도해줄래?".
  (9) `/login?error=access_denied` → "로그인 취소했네? 다시 시도해봐!".
- 근거 파일: D-025, `inbox/copy-inventory.md`, TASKS.md T-025
- 범위 외: BRAND.md/DESIGN.md 문서 동기화(to-designer.md), api `ErrorCode` 메시지(변경 없음).
- date: 2026-09-17

### [개발자 → QA] T-009 STT/TTS Provider + 엔드포인트 (api) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-009 PASS]
- 요청/이슈: `cd apps/api && ./gradlew test`(280 통과, compose MySQL 필요) 확인. 신규 35건은 `src/test/java/com/example/chat/speech/**` + MapperTest usage.
  로컬 실측(compose + bootRun, 로그인 쿠키 필요, nginx :3000 경유). STT/TTS 는 OmniRoute `/v1/audio/*` 경유(D-027):
  (1) 로컬 OmniRoute 에는 Groq(STT)·edge 노드(TTS)가 연결돼 있다(D-028). `STT_MODEL=nope/x` 처럼 없는 모델로 bootRun 하면 `POST /api/speech/stt` → 502 `SPEECH_UPSTREAM_ERROR`(OmniRoute 400 본문을 그대로 흘리지 않는지), TTS 도 동일.
  (2) 기본 설정으로: 5초 webm/opus 녹음(한국어) → 200 `{text, durationMs, provider:"omniroute"}` 에 말한 내용이 그대로, `daily_usage.stt_seconds` 가 올림 초로 증가. `POST /api/speech/tts` `{"text":"안녕, 반가워"}` → 200 `Content-Type: audio/mpeg`, `Cache-Control: private, max-age=3600`, 재생하면 한국어 여성 음성(SunHi), `tts_chars` 증가. `voice:"ko-KR-InJoonNeural"` 이면 남성.
      개발자 OmniRoute 레벨 실측(2026-09-17): STT "오늘 날씨 어때? 나 좀 심심해." 정확, 0.6초. TTS 0.4초, 1,000자 10초. api 경유는 로그인 쿠키가 필요해 미실측.
  (2-1) `docker compose -f docker-compose.dev.yml ps` 에 `edge-tts` 가 떠 있어야 TTS 가 된다. 내려가 있으면 502.
  (2-2) STT 기본 모델은 `groq/whisper-large-v3`(non-turbo). QA 중 turbo 가 "진짜 짜증나"를 "진짜 찾았나"로 적어 교체(2026-09-18).
  (3) 처리 중·후 `/tmp/audio`(로컬은 `app.speech.tmp-dir`) 에 파일이 남지 않는지(성공·실패 모두).
  (4) `durationMs=60001` → 400 `AUDIO_TOO_LONG`(공급자 미호출). 1,001자 텍스트 → 400 `TEXT_TOO_LONG`. 공백 텍스트 → 400 `VALIDATION_FAILED` `details.text`. `audio` 파트 없음 → 400 `details.audio`(500 아님).
  (5) 26MB 파일 → HTTP 413. nginx(25m) 가 먼저 자르므로 본문은 **nginx HTML** 이지 JSON `PAYLOAD_TOO_LARGE` 가 아니다 — 프론트(T-010)는 상태코드만 보고 처리. Boot 직행(:8080)이면 JSON 또는 연결 리셋.
  (5-1) 60초 최대 길이 녹음(webm/opus, 수 MB) → 200 이 `SPEECH_TIMEOUT_SECONDS`(30초) 안에 오는지. 넘기면 기본값 상향.
  (5-2) `durationMs=abc` → 400 `VALIDATION_FAILED` `details.durationMs`(500 아님). 음수 → 400 `details.durationMs`.
  (6) 미인증 401, 정지 회원 403 `USER_SUSPENDED`.
  (7) `STT_PROVIDER=clova` 로 기동하면 부팅은 되고 호출은 502(스텁).
- 근거 파일: D-007, D-026, D-027, API.md#speech, TASKS.md T-009, `apps/api/src/main/java/com/example/chat/speech/**`, `mapper/DailyUsageMapper.xml`
- 범위 외: 프론트 버튼·보이스 모드(T-010), VAD·문장 단위 TTS(T-026), Clova 실구현, 일일 호출 상한(D-007 open).
- date: 2026-09-17



### [개발자 → QA] T-010 듣기/말하기 버튼 + 보이스 모드 루프 (web) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-010 PASS(기능) — 문구 확정 대기]
- 요청/이슈: `cd apps/web && npm test`(319 passed / 52 files), `npm run lint`(0 error, 기존 경고 1: api.ts `_retry`), `npm run typecheck`, `npm run build` 통과 확인.
  신규 79건은 `app/features/speech/**` + `app/components/voice/**` + Composer/ChatShell/RoomView/MessageBubble/api 추가분.
  설계 근거 D-029(사용자 결정 1=2B·3=b, 나머지 승인) — DESIGN.md#7, BRAND.md#5 신규 문구 행 반영됨.
- 검증 포인트(코드/테스트 리뷰 + 가능하면 실기기):
  (1) 상태 머신 `voiceMachine`: idle→recording→transcribing→streaming→speaking→recording. RETRY("다시")·EXIT("끄기")·PERMISSION_DENIED 전이, 단계 안 맞는 이벤트 무시, 2인 방에서 내 `replyTo` 응답만 speaking 으로.
  (2) 컴포저 마이크(D-029 3=b): 탭 → "듣는 중"+m:ss+취소/완료 → 완료 시 STT 결과를 **확인 없이** VOICE 로 즉시 전송. 빈 결과 "아무 말도 안 들렸는데?", 실패 공용 오류, 권한 거부 "마이크 좀 열어줘…", 60초 자동 완료 "60초까지만 들을 수 있어!".
  (3) 오버레이(D-029 1=2B): 말하는 쪽으로 뒤집히는 말풍선 2개(내 쪽 우측 surface / AI 쪽 좌측 테두리+하트). recording 말풍선 탭=녹음 완료. 상태 라벨 `aria-live=polite`. denied/error 는 카드. "다시"/"끄기".
  (4) 듣기 버튼: AI 말풍선에만, 재생 중 "정지", 동시 재생 1개(다른 버튼 누르면 이전 중단). 1,000자 초과는 문장 경계 분할 순차 재생.
  (5) 상단 바 토글: **AI 모드·ORPHANED 아님**일 때만. 오버레이 중 HUMAN 전환 시 닫힘 + "AI 모드에서만 돼!".
  (6) iOS 자동재생: 토글·듣기·마이크 탭 제스처에서 `Audio` 1개 unlock 후 재사용.
  (7) reduced-motion: `voice-bars`·`orb-pulse`·`typing-dots` 정지.
- 미수행(사유): 브라우저 자동화 pane 에 마이크 없음(getUserMedia 불가), api 는 OAuth 쿠키 필요(T-009 와 동일) → 실기기/실브라우저 음성 루프는 미실측. STT/TTS 백엔드 왕복은 T-009 QA(2026-09-18)에서 실측 완료(Groq STT·edge-tts). 실기기 검증은 T-013.
- 신규 문구는 **초안**(D-029): 60초 "60초까지만 들을 수 있어!", 빈 결과 "아무 말도 안 들렸는데?", HUMAN 전환 "AI 모드에서만 돼!". 사용자가 REVIEW 이후 직접 수정 예정 — QA 는 동작만, 문구 확정은 대기.
- 근거 파일: D-029, DESIGN.md#7, BRAND.md#5, TASKS.md T-010, `apps/web/app/features/speech/**`, `apps/web/app/components/voice/**`.
- 범위 외: VAD·문장 단위 선재생(T-026), 실기기 PWA 음성(T-013).
- date: 2026-09-18

### [개발자 → QA] T-026 보이스 모드 체감 보강 — VAD 자동 종료 + 문장 단위 TTS 선재생 (web) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-026 PASS — 사용자 실측]
- 요청/이슈: `cd apps/web && npm test`(360 passed / 54 files), `npm run lint`(0 error, 기존 경고 1: api.ts `_retry`), `npm run typecheck`, `npm run build` 통과 확인.
  신규 41건은 `app/features/speech/{vad,sentenceChunker,ttsPlayer,useRecorder,useVoiceMode}` + `components/voice/VoiceModeOverlay`. 설계 근거 D-033(사용자 결정 "추천대로"). API 변경 없음.
- 검증 포인트(코드/테스트 리뷰 + 가능하면 실브라우저):
  (1) VAD(`vad.ts`): 적응형 바닥(내려갈 땐 즉시, 올라갈 땐 4dB/s, 말하는 동안 고정), 발화 = 바닥+12dB 초과·무음 = 바닥+6dB 미만(히스테리시스), 누적 발화 200ms 이상이어야 spoke, 그 뒤 무음 1,000ms → 자동 종료. 발화 없으면 절대 자동 종료 안 함(60초 상한).
  (2) `useRecorder` `vad: true` 일 때만 AnalyserNode 미터 생성(컴포저 마이크는 미생성). `onAutoStop(rec, 'limit' | 'silence')`. silence 는 토스트 없음, limit 는 "60초까지만 들을 수 있어!". stop 이벤트가 늦어도 `recorder.stop()` 1회.
  (3) 선재생: streaming 진입 시 `player.open()`, 델타를 `sentenceChunker` 로 잘라(첫 문장 즉시, 이후 40자 버퍼, 부호 뒤 공백/개행만 경계, `3.14` 미분할) `enqueue`. done 시 델타로 못 받은 나머지 + 꼬리 enqueue 후 `end()`. speaking 은 `session.done` 대기 → recording.
  (4) 폴백(B3): 첫 오디오 전 실패 → `player.play(전체)`; 재생 후 실패 → error "시스템 오류. 다시 시도해줄래?". 2인 방은 내 `replyTo` 델타만 큐에.
  (5) `ttsPlayer` 세션: 합성은 재생보다 1개만 앞서(호출 수 억제), 새 open/play/stop 은 이전 세션 abort(done resolve). 듣기 버튼(`useTts.play`)은 `play()` 그대로 — 회귀 확인.
  (6) 오브 진폭: recording 바 `--level`(0~1) → `scaleY(0.4 + 0.6·level)` + keyframes 숨쉬기. reduced-motion 은 transition 도 끔.
- 미수행(사유): 브라우저 자동화 pane 에 마이크 없음 + api OAuth 쿠키(T-010 과 동일) → 실브라우저 VAD/선재생 체감 미실측. iOS 에서 AudioContext 가 suspended 로 시작할 수 있어 `resume()` 만 걸어 둠 — T-013 체크리스트에 "보이스 모드 자동 종료 동작" 추가 요망.
- 근거 파일: D-033, TASKS.md T-026, `apps/web/app/features/speech/**`, `apps/web/app/components/voice/VoiceModeOverlay.tsx`, `apps/web/app/globals.css`.
- 범위 외: barge-in(백로그), DESIGN.md#7 문서 갱신(to-designer), 실기기 PWA 음성(T-013).
- date: 2026-09-18

### [개발자 → QA] T-028 SSE 셧다운 타임아웃 ERROR 로그 노이즈 제거 (api) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-028 PASS — 개발자 QA 대행]
- 요청/이슈: `GlobalExceptionHandler.handleAsyncTimeout` 추가(503, debug 로그). api 294 테스트 통과. 셧다운 실측은 QA_REPORT 참조.
- 근거 파일: TASKS.md T-028, API.md#에러-형식(503 행), `apps/api/.../global/error/GlobalExceptionHandler.java`
- date: 2026-09-18

### [개발자 → QA] T-029 채팅 UI 정리 13건 (web) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-029 PASS — 사용자 실측]
- 요청/이슈: D-034(사용자 지시 13건) 구현. `cd apps/web && npm test`(365 passed / 53 files), `npm run lint`(0 error, 기존 경고 1), `npm run typecheck`, `npm run build` 통과.
- 검증 포인트(실브라우저 http://localhost:3000, 라이트/다크 둘 다):
  (1) 컴포저: [마이크][음성][전송] 순서. AI 모드·ACTIVE 에서만 "음성" 보임, HUMAN·잠김(pending/orphaned) 에선 없음. 상단 바에는 제목만.
  (2) 사이드바가 우측(데스크톱 고정 / 모바일 우측 드로어). 햄버거 우상단, 드로어 X 가 같은 자리, "+ 새 방" 과 안 겹침.
  (3) 사이드바 하단 [아바타 닉네임 … ⚙ 로그아웃]. ⚙ → 설정 시트: 제목 가운데(개설자 탭 → 가운데 정렬 Input), 멤버 줄 가운데, 모드 → 테마 → AI 성격 순. 방 밖(`/`)에선 테마 줄만. 드로어에서 ⚙ 누르면 드로어 닫힘.
  (4) 혼자인 방: `유저끼리` 에 마우스 올리면 "친구 초대해봐!" 말풍선. 둘이면 없음. 상시 문구는 사라졌는지.
  (5) 직접 쓰기: 취소(초안 버리고 접힘) / 저장(비었거나 그대로면 비활성). blur 만으로는 저장되지 않음. 되돌리기는 커스텀 있을 때만.
  (6) AI 말풍선에 듣기 버튼 없음. 스트림 오류 말풍선은 문구만, "다시" 없음(재전송은 입력창).
  (7) 모든 활성 버튼·링크 hover 시 손가락 커서, 비활성 전송 버튼은 기본 커서.
  (8) 방 목록 … 메뉴: 바깥 클릭·Escape·탭 이탈로 닫힘. 열리면 "제목 수정" 에 포커스, ↑↓ 이동.
  (9) 보이스 모드: 중앙 오브 1개(듣는 중엔 목소리 크기에 따라 커짐, 말하는 중 펄스), 아래 라벨, 우상단 X 로 종료, 하단 "다시" 원 버튼. 오브 탭 = 녹음 완료. 권한 거부/오류는 카드. reduced-motion 이면 정지.
- 미수행(사유): 브라우저 자동화는 소셜 로그인 쿠키가 없어 미실측(로컬 토큰 발급은 권한 정책으로 차단). 위 9개는 사용자 Chrome 실측 요망.
- 근거 파일: D-034, TASKS.md T-029, DESIGN.md §2·§3·§7, BRAND.md §5, `apps/web/app/components/{chat,voice}/**`, `apps/web/app/globals.css`.
- date: 2026-09-18

### [개발자 → QA] T-030 채팅 UI 정리 2차 4건 (web) 검증 요청 [처리됨 2026-09-18, QA_REPORT.md#T-030 PASS — 사용자 실측]
- 요청/이슈: D-035(사용자 지시 4건 + "이름은 우측") 구현. `npm test`(368 passed / 53 files), lint(0 error, 기존 경고 1), typecheck, build 통과.
- 검증 포인트(실브라우저, 모바일 폭 포함):
  (1) 드로어에 X 없음. 딤 탭·Escape 로 닫힘, 방 이동 시 자동 닫힘.
  (2) 사이드바 하단 우측 [아바타 닉네임 ^] 버튼 → 위로 메뉴 "설정 / 로그아웃". 바깥 클릭·Escape 로 닫힘, 열리면 "설정"에 포커스, ↑↓ 이동. 드로어에서도 동일. 로그아웃 → /login.
  (3) 내가 음성으로 보낸 말풍선에 마이크 아이콘 없음(시간만).
  (4) 입력창에 한 글자라도 치면 textarea 오른쪽에 작은 X. 탭 → 전부 지워지고 커서 유지. 비면 X 사라짐. 잠김 상태에선 X 없음.
- 근거 파일: D-035, TASKS.md T-030, DESIGN.md §2·§3, `apps/web/app/components/ui/useMenu.ts`, `components/chat/{Sidebar,ChatShell,RoomListItem,MessageBubble,Composer}.tsx`.
- date: 2026-09-18


### [개발자 → QA] T-031·T-032 AI 모드 대화 비공개화 (api+web) 검증 요청 [처리됨 2026-09-19, QA_REPORT.md#T-031·T-032 PASS — 사용자 실측, 오류 말풍선 1건 미검증]
- 요청/이슈: D-037(사용자 결정 4건) 구현. api `./gradlew test` 307 통과, web `npm test` 371/53 파일 + lint(기존 경고 1)·typecheck·build 통과.
- 필요한 환경: 계정 2개(개설자 A · 참여자 B)로 같은 방에 동시 접속. 브라우저 2개(또는 시크릿 창) + 각자 SSE 연결.
- 검증 포인트(실브라우저):
  (1) `AI` 모드에서 A 가 보낸 질문·AI 답이 **B 화면에 전혀 안 뜬다**(말풍선도 점 3개 스트리밍도 시스템 라인도 없음). B 도 반대로.
  (2) 새로고침(= `GET /messages` 재조회) 후에도 상대 대화가 안 보인다. 스크롤을 위로 올려 과거 페이지도 확인 — 커서 페이징에 빈 페이지가 끼지 않는지.
  (3) `유저끼리` 모드로 바꾸고 주고받은 말풍선은 **양쪽 다** 보인다. 다시 `AI` 로 돌아와도 그 대화는 계속 보인다(과거 가시성 불변).
  (4) `유저끼리` 에서 한 얘기를 AI 가 모른다 — `AI` 로 바꾼 뒤 "우리가 방금 무슨 얘기했어?" 물어보면 그 내용을 모른다.
  (5) AI 가 상대 얘기를 **먼저 옮기지는 않되, 직접 물으면 알려준다** — A 가 "영희가 뭐라고 했어?" 라고 물으면 대답하고, 평범한 질문에는 상대 발언을 꺼내지 않는다(LLM 이라 100% 보장은 아님 — 경향 확인).
  (6) 한 계정 탭 2개: 한쪽에서 보낸 메시지·델타가 **같은 계정의 다른 탭에도** 실시간으로 뜬다.
  (7) 방 목록: 상대가 AI 와 대화하면 내 목록의 그 방 순서·메시지 수는 올라간다(내용은 안 보임) — 의도된 동작(D-037 부수 확정).
  (8) 모드 토글 칸 호버/포커스: `AI` → "AI와 1:1, 친구는 못 봐!", `유저끼리` → "친구와 1:1, AI는 못 봐!". 혼자인 방은 칸별 문구 없이 "친구 초대해봐!" 하나만.
  (9) 입력 잠금은 그대로 유저 단위 — A 가 AI 답 기다리는 중에도 B 는 바로 보낼 수 있다.
- 기존 데이터: V4 백필로 예전 방의 AI 대화는 발신자(대개 개설자) 것으로 귀속된다. 2인 방에서 예전 상대 대화가 갑자기 사라져 보일 수 있다 — 의도된 결과.
- 근거 파일: D-037, TASKS.md T-031·T-032, API.md#messages, SCHEMA.md#5, DESIGN.md §3,
  `apps/api/src/main/resources/db/migration/V4__message_visibility.sql`, `apps/api/src/main/java/com/example/chat/message/{RoomEventBus,MessageService,AiContextBuilder,Message,MessageMapper}.java`,
  `apps/api/src/main/resources/mapper/MessageMapper.xml`, `apps/web/app/components/ui/PillToggle.tsx`, `apps/web/app/components/chat/RoomHeaderSheet.tsx`.
- date: 2026-09-19

### [개발자 → QA] T-032 오류 말풍선 소멸 — 강제 재현 절차 [처리됨 2026-09-19, PASS — 말풍선 항상 1개, 참여자엔 미노출]
- 왜: api 수정 후 AI 잡이 정상 응답해 오류 말풍선을 만들 수 없어 실측이 안 됐다(QA_REPORT T-032 issues). 단위 테스트만 통과.
- 재현 (2분, 되돌리기 쉬움):
  1. `docker stop chat-app-dev-omniroute-1` — 상류를 끊는다.
  2. `AI` 모드에서 아무 메시지 전송 → 점 3개 뒤 "시스템 오류. 다시 시도해줄래?" 말풍선이 뜬다.
  3. 그 상태로 메시지를 **한 번 더** 전송 → 오류 말풍선이 사라지고 내 말풍선 + 새 대기 표시만 남아야 한다(D-038 2).
  4. `docker start chat-app-dev-omniroute-1` — 복구. 3에서 보낸 메시지의 답은 안 온다(그 잡은 이미 실패) — 정상.
- 같이 볼 것: 2인 방이면 상대 화면에는 이 오류 말풍선이 **안 보여야** 한다(error 이벤트도 대화 주인에게만, D-037).
- date: 2026-09-19

### [개발자 → QA] T-034 전송 후 입력창 포커스 유지 — 실측 요청 [처리됨 2026-09-19, PASS — 잠금 해제·버튼 클릭 모두 포커스 복귀]
- 무엇: 메시지를 보내면 입력창 포커스가 풀리던 문제(사용자 제보). 원인은 둘 다 "포커스된 엘리먼트가 `disabled` 되면 브라우저가 포커스를 뗀다" — (1) AI 모드 전송 즉시 `lock='pending'` 으로 textarea 가 disabled, (2) 전송 버튼 클릭 시 값이 비면 그 버튼이 disabled.
- 고친 방식: 잠금 UX(disabled)는 유지하고 포커스만 복원 — 전송 시 textarea 로 되돌리고, 잠금이 풀릴 때 포커스가 비어 있으면(body) 다시 준다.
- 검증 포인트(실브라우저, Chrome + Safari):
  (1) `AI` 모드에서 Enter 로 전송 → 대기 중엔 입력창이 잠기고, AI 답이 끝나 잠금이 풀리면 **커서가 입력창에 돌아와 바로 이어 칠 수 있다**.
  (2) 전송 버튼을 마우스로 클릭해 보낸 경우에도 같다(클릭 직후 바로 타이핑 가능).
  (3) `유저끼리` 모드(잠금 없음)에서도 Enter·버튼 클릭 둘 다 포커스 유지.
  (4) 대기 중에 다른 곳(방 목록·헤더 시트·설정)을 눌러 포커스를 옮겨두면, 잠금이 풀려도 **포커스를 뺏지 않는다**.
  (5) 방장이 나간 방(`orphaned`)에서 잠금이 풀리는 경우 자동 포커스가 뜨지 않는다.
  (6) 모바일/터치(있으면): 잠금 해제 시 키보드가 다시 올라오는 게 거슬리는지 — 거슬리면 pointer:coarse 예외를 별도 T 로 뺀다.
- 근거 파일: `apps/web/app/components/chat/Composer.tsx`, `apps/web/app/components/chat/Composer.test.tsx`, TASKS.md T-034.
- date: 2026-09-19

### [개발자 → QA] T-033 SSE 끊김 ERROR 스택 제거 — 검증 요청 [처리됨 2026-09-19, PASS — 끊김 2건에 ERROR 0건·DEBUG 2줄, 실브라우저 확인은 다음 실측에 곁눈질]
- 무엇: SSE 를 연 탭을 닫거나 새로고침할 때마다 api 로그에 찍히던 `AsyncRequestNotUsableException`(Caused by Broken pipe) ERROR 스택 제거. 전용 `@ExceptionHandler` + catch-all 안전망(`DisconnectedClientHelper`)으로 debug 한 줄로 내렸다. 응답/이벤트 계약 변경 없음.
- 테스트: api `./gradlew test` 310 통과(로그 레벨 단언 포함 +2).
- 개발자 실측(2026-09-19): :8081 별도 인스턴스 + `curl -N` SSE 끊김 — 수정 전 ERROR 1건/끊김 1건 → 수정 후 끊김 2건에 ERROR·WARN 0건, DEBUG 2줄.
- 남은 검증 포인트(실브라우저, bootRun 로그를 보며):
  (1) 방에 들어가 SSE 가 붙은 뒤 **탭 닫기 / 새로고침 / 방 나가기**를 각각 해본다 → 로그에 `unhandled exception` 스택이 더는 없다(최대 20초 뒤 판정 — 하트비트 시점에 드러난다).
  (2) 스트리밍 도중(점 3개 나오는 중) 탭을 닫아도 같다. 남은 AI 잡은 조용히 끝난다.
  (3) 진짜 서버 오류는 여전히 ERROR 로 보인다 — 예: OmniRoute 를 내린 뒤 전송(T-032 재현 절차)하면 그 실패 로그는 그대로 남는다.
  (4) 2인 방에서 한쪽만 탭을 닫아도 남은 쪽 SSE 는 계속 살아 있다(메시지·델타 수신 정상).
- 근거 파일: `apps/api/src/main/java/com/example/chat/global/error/GlobalExceptionHandler.java`, `apps/api/src/test/java/com/example/chat/global/error/GlobalExceptionHandlerTest.java`, TASKS.md T-033(T-028 형제).
- date: 2026-09-19

### [개발자 → QA] T-035 2인 방 보이스 모드 동시 사용 — TTS 충돌 실측 요청 [처리됨 2026-09-19, QA_REPORT.md#T-035 PASS — 사용자 실측, 대기 체감 안 거슬림]
- 무엇: 백로그 "2인 방 보이스 동시 사용 TTS 충돌" 확인. 코드 변경 없음 — 조사 결과 (1) 클라이언트는 `replyTo` 가 내 messageId 인 스트림만 읽고(D-029 6, `voiceMachine.ts`), (2) 서버는 AI 모드 delta/done 을 그 유저 탭에만 보내며(D-037, `MessageService.publishTo`), (3) `ROOM_BUSY` 는 유저 단위라 상대가 답 받는 중이어도 내 전송은 통과해 방 큐 뒤에 대기한다(`RoomAiExecutor`). 실측으로 이 셋이 실제 마이크 루프에서도 성립하는지만 본다.
- 준비: 2인 방, Chrome + Safari 각각 다른 계정, 방 모드 `AI`. 마이크 실측이라 사용자 Mac 필요. 두 브라우저 모두 보이스 모드 토글 ON.
- 검증 포인트:
  (1) **동시 발화**: 두 브라우저에서 거의 동시에 서로 다른 질문을 말한다(예: Chrome "오늘 뭐 먹지", Safari "내일 날씨 어때") → 각 브라우저가 **자기 질문의 답만** 읽는다. 상대 질문·답은 목록에도 안 뜬다.
  (2) **직렬 대기**: 늦게 말한 쪽이 409 오류 카드 없이 "답하는 중" 으로 넘어가고, 먼저 말한 쪽 답이 끝난 뒤 자기 답이 재생된다. 그 대기 시간이 얼마나 되는지, 라벨 없이 기다리는 게 거슬리는지 한 줄 기록(거슬리면 별도 T).
  (3) **재생 중 상대 발화**: 한쪽이 답을 듣는 중(speaking)에 다른 쪽이 말해도 듣던 쪽 재생이 끊기거나 섞이지 않는다.
  (4) **모드 전환**: 한쪽이 보이스 모드 중에 헤더 시트에서 `유저끼리` 로 바꾸면 상대 오버레이가 닫히고 토스트가 뜬다. 다시 `AI` 로 돌리면 토글이 다시 보인다.
  (5) **참여자만 안 되면 Safari 의심**(기존 실측 교훈): 한쪽만 실패하면 브라우저를 바꿔 한 번 더.
- 로그 대조: bootRun 로그에서 두 잡이 순서대로 시작·종료되는지(같은 방 id, user id 둘), ERROR 없음.
- 근거 파일: `apps/web/app/features/speech/voiceMachine.ts:67`, `useVoiceMode.ts:133-138`, `apps/web/app/components/chat/RoomView.tsx:50-59`, `apps/api/src/main/java/com/example/chat/message/RoomAiExecutor.java`, `MessageService.java:127·149`, TASKS.md T-035.
- date: 2026-09-19


### [개발자 → QA] T-012 NAS 첫 배포 — 운영 환경 검증 요청 [처리됨 2026-09-20, QA_REPORT.md#T-012 PASS — 사용자 실측, 미실측 항목은 사용 중 확인]
- 무엇: master 0c6e114 가 https://talk-behind-my-back.o-r.kr 에 떠 있음. 인프라 작업이라 자동 테스트 없음 — 운영 환경에서 체크리스트 실측.
  개발자 실측(사용자 기기, 2026-09-20): Google 로그인, 텍스트→AI 답장, 음성→STT→TTS, 2기기 SSE 실시간 — PASS. 자세한 경위 TASKS.md#T-012 note.
- 준비: 휴대폰(LTE) + Mac. Mac 은 같은 사설망이라 공인 IP 로 못 들어감 → `/etc/hosts` 에 `192.168.55.71 talk-behind-my-back.o-r.kr` 한 줄(hairpin NAT 우회).
- 검증 포인트:
  (1) **http 진입**: 주소창에 도메인만 입력(http) → 403 없이 `/login` 으로. https 자물쇠 정상(Let's Encrypt, `talk-behind-my-back.o-r.kr`).
  (2) **Naver·Kakao 로그인**: Google 은 확인됨. 나머지 둘 각각 왕복 → `/` 에 닉네임·공급자. redirect_uri mismatch 나오면 콘솔 등록 URI 확인.
  (3) **SSE 장시간**: 방을 열어두고 2분 이상 아무것도 안 함 → 이후 상대 메시지가 도착하는지(DSM `proxy_read_timeout` 60s 로 끊겨도 재연결돼야 함). 재연결 지연이 거슬리면 리버스 프록시 고급 설정 타임아웃 조정 후보로 기록.
  (4) **세션 유지**: 로그인 후 15분 이상 뒤 새 탭 `/` → silent refresh 로 복귀(T-005 (3) 과 동일, 운영 쿠키 Secure/Domain 확인).
  (5) **PWA**: 휴대폰 홈화면 추가 → 실행 → 로그인 왕복(T-013 과 겹치면 거기서).
  (6) **메모리**: NAS `sudo -n /usr/local/bin/docker stats --no-stream` 에서 api 가 512MiB 안(현재 ~420MiB), omniroute ~650MiB 기록.
- 근거 파일: `.github/workflows/deploy.yml`, `infra/docker-compose.yml`, `infra/.env.example`, `apps/api/Dockerfile`, TASKS.md#T-012 note·교훈 3줄
- 범위 외: OmniRoute 제거 검토(백로그), DSM 타임아웃 튜닝(별도 T 후보).
- date: 2026-09-20

### [개발자 → QA] T-014 서비스워커(PWA 오프라인 셸) — 검증 요청
- 무엇: `@serwist/turbopack` 로 `/serwist/sw.js` 등록(production 만). `/api`·`/admin` NetworkOnly, 앱 셸·아이콘 프리캐시, 오프라인 콜드 오픈 시 `/~offline` "연결 없음". 상세 TASKS.md#T-014 test·D-039.
- 개발자 실측(Playwright, `next start` 직접 접속): SW 활성·프리캐시 29건·api 캐시 0건·오프라인 폴백·복귀 PASS.
- 검증 포인트 (dev 에선 SW 가 꺼져 있으니 **배포본 또는 `npm run build && node .next/standalone/server.js`** 로):
  (1) Chrome DevTools → Application → Manifest: "installable" 경고 없음(아이콘 192/512/maskable, start_url, display standalone).
  (2) Application → Service workers: `/serwist/sw.js` activated, scope `/`. Cache Storage 에 `serwist-precache-*`·`pages`·`shell-assets`·`next-static` 만, `/api/` 경로 항목 없음.
  (3) 로그인 후 방 하나 열고 DevTools Network → Offline → 새 탭에서 `/` 콜드 오픈 → "연결 없음" 페이지. Online 으로 되돌리고 "다시 시도" → 방 목록 복귀.
  (4) 채팅 중 SSE 가 SW 를 안 거치는지: Network 에서 `/api/rooms/{id}/events` 의 Size 가 "(ServiceWorker)" 가 아님. 메시지 전송·AI 스트리밍 기존과 동일.
  (5) 운영(nginx 경유, https): 배포 후 (1)(2) 반복 — `Service-Worker-Allowed: /` 헤더가 nginx 를 통과하는지(응답 헤더 확인).
- 근거 파일: `apps/web/app/sw.ts`, `app/serwist/[path]/route.ts`, `app/~offline/page.tsx`, `app/features/pwa/*`, `proxy.ts`, `next.config.ts`
- 범위 외: 앱 사용 중 끊김 인앱 배너(D-039 3), iOS 실기기 → T-013.
- date: 2026-09-20

