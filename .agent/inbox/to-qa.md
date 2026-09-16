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
