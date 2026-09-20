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

### T-021 메시지에 발신 당시 닉네임 보존 (api + web)
- verdict: PASS (사용자 지시로 개발자 QA 대행, 2026-09-16)
- tests: 존재 / api `./gradlew test` 244 passed(신규 `MessageControllerIntegrationTest.History.나간_멤버의_메시지도_senderNickname_유지_ASSISTANT_는_null`) / web `npm test` 223 passed(40 파일, 신규 `MessageList.test` 2: senderNickname 우선·null 폴백), `npm run lint` 0 error(기존 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked:
  - acceptance 커버리지: (1) 나간 멤버 과거 메시지 실명 유지 — 통합 테스트 + 실브라우저. (2) API 계약 선갱신(API.md#messages `senderNickname`, D-023) → 코드. (3) web `buildRows` 우선순위 senderNickname → `room.members` → "나간 사람"(단위 2건, 기존 "모르는 발신자" 케이스 유지).
  - 계약 일치: `GET /rooms/{id}/messages` items 에 `senderNickname`(USER 닉 / ASSISTANT null), SSE `message` 이벤트 data 에도 동일 필드 — 둘 다 실서버 응답으로 확인. `Room.members` 는 여전히 활성 멤버만(나간 뒤 OWNER 1명) — 변경 없음 확인.
  - **실서버·실브라우저(로컬 compose nginx :3000 + `./gradlew bootRun` + 기존 `npm run dev`)**: T-008 QA 와 같은 방식으로 로컬 JWT_SECRET(코드 공개 기본값) 서명 테스트 계정 2개 `QA영선`(id 4421)/`QA영희`(id 4422) 를 DB 에 직접 생성(소셜 계정 없음, 실제 회원 자격증명 미사용).
    - API(curl): A 방 생성(5332) → B 초대코드 입장 → HUMAN 모드 → B 메시지 2 + A 1 → B 나가기 204 → A 의 `GET messages`: B 메시지 `senderUserId 4422 / senderNickname "QA영희"` 유지, `GET /rooms/5332` members 는 A 만. A 가 구독한 SSE 에서 `message` 이벤트 data 에 `"senderNickname":"QA영희"` 확인, 이어서 `member LEFT` · `mode AI` 이벤트.
    - 브라우저(내장, A 세션): `/rooms/5332` 새로 열기 → B 가 나간 뒤에도 B 말풍선 이름 "QA영희"(이전 T-008 에선 "나간 사람"). 페이지 열어 둔 채 B 재입장 → 전송 → 나가기(curl) → "QA영희 등장!" → 새 말풍선 "QA영희" → "QA영희 퇴장" + "AI 다시 귀 열었다" 뒤에도 **새로고침 없이** 모든 B 말풍선 이름 유지. 콘솔 오류는 이전 세션(만료 쿠키, 방 4987) 잔여 401 뿐, T-021 요청은 전부 200.
  - 뒷정리: A 나가기로 방 5332 ORPHANED(물리 삭제 없음, SCHEMA 규칙). 브라우저 쿠키 제거, 임시 토큰 파일 삭제, bootRun 종료(검증 전 상태로).
- issues:
  - (블록 아님, 참고) 이전 세션 잔여 로그에서 access 만료 후 `GET /rooms/{id}/events` 가 401 로 ~20회 연속 재시도(EventSource 자동 재연결) 뒤 refresh 실패 → `/login` 이동. 401 시 재연결 중단·refresh 선행은 T-021 범위 밖, 세션 만료 UX 다룰 때 함께.
  - (의도) 닉네임을 바꾸면 과거 메시지도 새 닉으로 보인다(D-023, LLM 컨텍스트와 동일 기준).
- date: 2026-09-16

### T-023 같은 두 사람은 활성 방 1개만 — 입장 거절 (api + web) / T-024 빈 방 상태가 시스템 라인을 가림 (web)
- verdict: PASS (사용자 참여 세션, 개발자 대행 기록, 2026-09-16) — T-023 실브라우저는 미수행(아래)
- tests: 존재 / api `./gradlew test` 243 passed(T-023 신규 서비스 3 + 통합 jsonPath 1) / web `npm test` 221 passed(T-023 `joinErrorMessage` +1, T-024 `RoomView` +1), lint 0 error(기존 경고 1), typecheck 통과. 에이전트 실행(로컬).
- checked:
  - T-023 acceptance: `RoomMemberMapper.countActiveRoomsShared`(두 사람 모두 활성 멤버인 ACTIVE 방, 현재 방 제외) → `checkJoinable` 순서 410 → 400 SELF → 이미 멤버 200 → **409 PAIR** → 409 FULL. 서비스 테스트로 (1) 두 번째 방 입장·미리보기 409 + 같은 방 재입장 200, (2) 쌍 기준(참여자가 만든 방에 개설자 입장도 409), (3) ORPHANED 제외 + PAIR 가 FULL 보다 우선 확인. `ErrorCode.PAIR_ROOM_EXISTS`, API.md 표·판정 순서, web 문구 "걔랑은 이미 방 있잖아"(BRAND/DESIGN 표) 일치.
  - T-024: `RoomView` 빈 방 판정에 `stream.notices` 포함. 메시지 0 + "영희 등장!" notice → 라인 표시, 빈 상태 문구 없음(단위). DESIGN.md#3 빈 방 문구 개정.
  - **실브라우저 추가 검증(같은 날, Playwright = A 상남자/구글, 내장 브라우저 = B 빵선/카카오 id 96)**:
    - T-023: A 가 방 X·Y 생성 → B 가 X 입장 → B 가 `/join/{Y}` 열면 "걔랑은 이미 방 있잖아" + "내 방으로"(409 PAIR, 미리보기 단계) → B 가 X 나가기(DELETE 204) → `/join/{Y}` 다시 열면 "들어갈래" → 입장 200(`/rooms/{Y}`). 쌍 해소까지 확인.
    - T-024: B 가 빈 방 X 에 들어오는 순간 A 화면이 빈 상태 대신 "9월 16일 수요일 / 빵선 등장!" 로 전환, B 나가면 "빵선 퇴장" 추가. 스크린샷 `qa-07-t024-notice-in-empty-room.png`.
    - 카카오 `next` 왕복(T-022 미검증분): 로그아웃 상태 `/join/{X}` → `/login?next=` → 카카오 로그인 → `/join/{X}` 복귀(B, id 96). 이제 구글·카카오 실측, 네이버만 미실측.
- issues:
  - (미검증) 네이버 `next` 왕복(메커니즘 provider 무관, 통합 테스트로 대체). 휴대폰 실기기 QR 스캔·공유 시트, 정원·50개 초과.
  - (참고) `mapper/*.xml` 안 `<>` 는 XML 파싱 오류 — `!=` 사용. bootRun 중 `gradlew test` 를 돌리면 devtools 가 재시작하는데 그때 리소스가 깨져 있으면 앱이 죽은 채 남는다(재기동 필요) → TASKS 교훈.
- date: 2026-09-16

### T-022 OAuth `next` 복귀 + `alreadyMember` (api) / T-018 초대 입장 페이지 + QR/링크 공유 + 주인 없는 방 모달 (web)
- verdict: PASS (사용자 참여 Playwright QA, 개발자 대행 기록, 2026-09-16) — 미검증 항목은 issues 에 명시
- tests: 존재 / api `./gradlew test` 240 passed / web `npm test` 219 passed(40 파일), `npm run lint` 0 error(기존 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked:
  - acceptance 커버리지: api `NextPath`·resolver·성공 핸들러·`alreadyMember` / web proxy next·로그인 링크 next·`/join` 5상태·InviteSheet(QR·코드·복사·공유·재발급)·OrphanedDialog 단일 트리거. 단위·통합 테스트로 전부 커버.
  - **실브라우저(Playwright Chromium = 계정 B `빵선이`(id 94, 네이버) / 내장 브라우저 = 계정 A `상남자`(id 95, 구글), 로컬 compose nginx + `./gradlew bootRun` + `npm run dev`, 소셜 로그인은 사용자가 직접 수행)**:
    - `next` 왕복: 로그아웃 상태 `/join/K7Q2M9XW` → `/login?next=%2Fjoin%2FK7Q2M9XW` → 소셜 링크 3개에 `?next=` 부착 확인 → 구글 로그인 → `/join/K7Q2M9XW` 복귀(콜백이 next 로 302). access 만료(15분) 후 `/join/{code}` 새 탭 → silent refresh → next 로 복귀.
    - `/join` 실패 문구: 없는 코드 "그런 코드 없는데?" / 본인 방 "이거 네 방이잖아" / 재발급 후 옛 코드 404 / 주인 나간 방 "주인이 도망간 방이야"(4317 ORPHANED 후) — 모두 시트 안 문구 + "내 방으로" → `/` → 최신 방.
    - 초대 시트(436px): 제목 "친구 데려오기", QR 200px 라이트 카드(`rgb(255,244,248)` 고정), **QR 행렬이 `uqr` 재계산과 일치**(29×29, 404 모듈, 좌표 해시 동일 → `http://localhost:3000/join/{code}` 인코딩 확인. 휴대폰 스캔은 미수행), 코드 "V829 EAR9" 4+4, "링크 복사" → 토스트 "복사했어. 이제 던져줘", "공유하기" 노출(Chromium `navigator.share` 있음), "코드 다시 만들기" → 확인 모달 → 새 코드 즉시 표시.
    - 입장(390×844): "초대장 도착" / 우측 "상남자가 부른 방 / 들어와서 같이 씹자"(조사 `가` 정확) / 말풍선 안 "새 대화 · 멤버 1/2 · 들어갈래" / 꼬리 발치 "상" 아바타 — 스크린샷 `.playwright-mcp/qa-03-join-preview-390.png`. "들어갈래" → `/rooms/4320` replace.
    - B 입장 순간 A 화면: 초대 시트 자동 닫힘(memberCount 2, SSE `member`) 확인 — 2회(4320, 4321).
    - ORPHANED 모달 경로 2/3 실브라우저 확인: (1) B 가 방 안에 있을 때 A 나가기(사이드바 … → "나가면 이 방은 끝이야. 진짜 갈래?" → 나갈래) → B 화면에 SSE 로 즉시 모달(제목·본문·버튼 1개, 입력 잠김 "주인이 도망간 방이야", 토스트 없음) → "알았어" → `/rooms/4318`(남은 방) + 목록에서 4320 제거. (2) B 가 다른 방에 있을 때 A 나가기 → B 목록에서 그 방 탭 → 상세 GET 이 ORPHANED → 같은 모달 → 알았어 → 목록 제거. 스크린샷 `qa-04-orphaned-modal-390.png`.
    - 개설자 화면엔 모달 없음(A 는 나가기 후 `/` → 3664).
- issues:
  - (미검증, 환경) 네이버·카카오 `next` 왕복 — 구글만 실측. 메커니즘은 provider 무관(state attribute)이라 통합 테스트로 대체. 휴대폰 QR 스캔·모바일 share 시트 — 미수행. 정원 초과(3번째 계정)·50개 초과 — 계정 부족.
  - **추가 검증(같은 날, Playwright)**: (a) 다크 모드 초대 시트 — 카드 `rgb(255,244,248)` 고정 / 본문 `rgb(23,6,17)`, 스크린샷 `qa-06-invite-sheet-dark.png`. (b) **둥근 모듈 QR 을 렌더 PNG(232×232) 그대로 `jsQR` 로 디코드 → `http://localhost:3000/join/{code}` 복원 성공** — 휴대폰 스캔 대체 근거. (c) 전송 410 경로 — Playwright `page.route` 로 상세 응답 role 을 PARTICIPANT 로, POST messages 를 410 으로 가로채 재현: 토스트 없음(`[role=alert]` 는 Next 라우트 어나운서 빈 DIV 뿐), 낙관 말풍선 제거, 입력 잠김 "주인이 도망간 방이야", 모달 표시. `qa-05-410-modal.png`.
  - (블록 아님, T-008 기존 동작) 메시지 0개인 방은 빈 상태 "오늘은 누가 그랬어?" 가 시스템 라인("빵선이 등장!")보다 우선해 등장 라인이 안 보인다. 메시지가 있으면 정상. 빈 방 판정에 시스템 라인을 포함할지는 디자이너 판단 → to-designer 백로그.
  - (블록 아님, 설계상) 내가 안 들어가 있는 방의 목록 `닫힘` 배지는 목록 재조회 전까지 갱신되지 않는다(그 방 SSE 미구독). 탭하면 상세 GET 으로 모달이 뜨므로 사용자 결과는 동일(D-021 단일 트리거).
  - (참고) QA 도중 4317 방이 ORPHANED 된 것은 계정 전환 과정에서 사용자가 A 로 나간 것으로 추정 — 앱 결함 아님.
- date: 2026-09-16

### T-008 채팅 셸 + 방 생성 + 모드/성격 + 스트리밍 UI (web)
- verdict: PASS (사용자 지시로 QA 대행 기록, 2026-09-16) — 실브라우저 검증 중 결함 2건 발견 → 같은 태스크에서 수정·재검증 후 PASS
- tests: 존재 / `npm test` 168 passed, 0 failed(신규 2 — 아래 결함 재현 테스트 포함) / `npm run lint` 0 error(경고 1건은 T-008 이전부터 있던 `api.ts` `_retry`, 무관) / `npm run typecheck` 통과 / `npm run build` 통과. 에이전트 실행(로컬).
- checked:
  - acceptance 커버리지: `(chat)/layout.tsx` 사이드바+메인, 방 목록 역할·ORPHANED 표시, "+ 새 방" 즉시 `POST /rooms`(draft 폐기) / 방 헤더 멤버·모드 토글(2명일 때만)·AI 성격(개설자만, 프리셋+프롬프트 편집 2,000자·초기화, `effectiveAiPrompt` 상시 표시)·초대 버튼(개설자만, onInvite 훅만 — T-018 연결 예정) / `lib/sse.ts` 6종 이벤트 리듀서+재연결 / 전송 중 본인 입력 비활성(상대는 가능)·409 토스트·상단 도달 이전 페이지.
  - API.md 계약 일치: rooms/messages 필드명·에러 코드(409/503/410/400) 그대로 사용, 커서 불투명 문자열 처리, Room `members: null`(목록)/배열(상세) 분기.
  - **실브라우저(Chromium, 로컬 compose nginx+MySQL+OmniRoute + `./gradlew bootRun` + `npm run dev`, `http://localhost:3000`)**: 모바일(436×863)·데스크톱(1280×860) 두 뷰포트로 직접 조작.
    - 로그인 화면 세션이 이미 브라우저에 있어 그대로 확인(실제 OAuth 로그인은 사람 자격증명이 필요해 에이전트가 수행하지 않음 — CLAUDE.md 안전 규칙). 추가 시나리오는 로컬 JWT_SECRET(코드 공개값, 시크릿 아님)으로 서명한 테스트 계정 2개(`영선`/`영희`, `local` 소셜 provider 없이 DB 직접 생성)로 진행 — 실제 회원(상남자, id 95)의 로그인·비밀번호는 전혀 사용하지 않았고, 그 계정에 남긴 테스트 흔적(빈 테스트 방 1개)은 검증 후 원상 삭제.
    - `/` 최신 방 자동 이동(D-020) 확인, 방 0개 계정은 빈 상태(하트 64 + "아직 방이 없네? 하나 파자." + "+ 새 방") 확인.
    - "+ 새 방" → 즉시 이동 → 빈 방 상태("오늘은 누가 그랬어?") → 전송 → 낙관적 말풍선 → (OmniRoute 에 `chat-default` 모델 미등록으로 502/400) `error` 이벤트 → "삐끗했다. 다시 해볼까?" + "다시" 재전송 확인. **AI 실제 응답 스트리밍(delta 누적)은 로컬 OmniRoute 대시보드에 모델을 등록해야 가능 — 이번 환경엔 없어 범위 외(T-007 QA 에서 fake 서버로 이미 검증됨), `error` 경로는 실제로 확인함.**
    - 초대 코드로 두 번째 계정 입장(API 직접 호출, T-018 이 아직 없어 초대 시트 UI로는 못 함) → 소유자 브라우저에 "영희 등장!" 시스템 라인·상대 말풍선(닉네임+아바타)·사이드바 아바타가 2인 아이콘으로 실시간 전환 확인(SSE `member` 라이브 반영).
    - 방 헤더 시트(데스크톱 360 다이얼로그) 열기 → 모드 `유저끼리` 전환 → 시스템 라인 "이제 유저끼리 얘기 중 (AI는 귀 막음)" + 입력 placeholder "AI 몰래 얘기하기" 즉시 반영 → HUMAN 모드 전송 시 AI 잡 없음(에러 말풍선 안 생김) 확인.
    - AI 성격 `공감형` 전환 → effectiveAiPrompt 문구 즉시 갱신 → "직접 쓰기" 입력·blur 저장 → 상단 요약 갱신 → "프리셋으로 되돌리기" → 프리셋 문구 복귀, 전 구간 새로고침 없이 실시간 확인.
    - 참여자(영희) API 로 나가기 → "영희 퇴장" + "AI 다시 귀 열었다" 시스템 라인, 입력 placeholder AI 모드로 복귀 확인. 단 **직전 메시지의 발신자 표시가 "영희" → "나간 사람" 으로 소급 변경됨을 발견(아래 issues)**.
    - 사이드바 "..." 메뉴: 제목 수정(Enter 저장), 나가기 ConfirmDialog(개설자/참여자 문구 분기, "안 갈래" 취소 동작) 확인.
    - 반응형: 436px 는 햄버거+드로어(경로 이동 시 자동 닫힘), 1280px 는 고정 사이드바+햄버거 자리 invisible, aside 는 `display:none`(JS 로 재확인) — Tailwind lg 분기 정상.
  - **발견·수정 1 (버그)**: 첫 메시지로 서버가 방 제목을 자동 생성(`autoTitle`)해도 상단 바/헤더 시트 제목이 갱신되지 않음 — `useSendMessage.onSuccess` 와 `useRoomEvents` 의 `message` 이벤트가 방 목록(`ROOMS_KEY`)만 무효화하고 방 상세(`roomKey(id)`, 헤더가 실제로 읽는 쿼리)는 무효화하지 않았다. 실브라우저에서 "새 대화" 로 고정된 헤더로 재현 → `app/features/messages/useMessages.test.tsx`/`useRoomEvents.test.tsx` 에 RED 단언 추가 → 두 지점에 `invalidateQueries({ queryKey: roomKey(roomId) })` 추가 → GREEN. 재확인: 새 방에서 첫 메시지 전송 시 새로고침 없이 헤더 제목이 즉시 바뀜.
  - **발견·수정 2 (버그)**: 사이드바 목록에서 **지금 보고 있지 않은** 다른 방을 나가면 `useLeaveRoom` 이 무조건 `router.replace('/')` 를 호출해 현재 보던 방에서 강제로 튕겨나감(`/` → `RootRedirect` 가 남은 방 중 최신으로 다시 이동하므로 최종 화면은 우연히 같아 보일 수 있어 서버 로그로 재확인: `GET /` 뒤 `GET /rooms/{다른id}` 두 번 왕복). `app/features/rooms/useRooms.test.tsx`/`Sidebar.test.tsx` 에 "보고 있지 않은 방" RED 케이스 추가 → `usePathname()` 으로 지금 보는 방을 나갈 때만 이동하도록 수정 → GREEN.
  - 접근성: 아이콘 버튼 aria-label(메뉴/닫기/방 메뉴/메시지 전송), 스트리밍 영역 `role=status aria-live=polite`, 필 토글 `radiogroup`+방향키, 모달/시트 `aria-modal`+Escape, 포커스 링 확인(키보드 탭 이동 육안 확인).
  - 보안: 로컬 JWT 서명에 쓴 `local-dev-only-secret-...` 은 이미 `application.yml` 기본값으로 공개된 로컬 전용 값(운영 비밀 아님) — CONVENTIONS 시크릿 규칙 위반 아님. 실제 회원 자격증명·비밀번호는 어디에도 입력하지 않음.
- issues:
  - (블록 아님, 후속 필요 → **T-021**) 멤버가 방을 나가면 그 사람이 보낸 과거 메시지의 발신자 표시가 "나간 사람" 으로 바뀐다. 원인은 API 계약 자체의 공백: `Message` 에 발신자 닉네임이 없고 `Room.members` 는 활성 멤버만 내려주므로, 프론트가 현재 멤버 목록으로만 과거 발신자 이름을 복원한다. 반면 서버 LLM 컨텍스트는 나간 멤버 라벨도 유지한다(API.md, D-019) — 화면과 AI 가 보는 정보가 어긋난다. "뒷담화" 앱 특성상 누가 무슨 말을 했는지가 핵심이라 사용자 체감 영향이 있음. API 변경(예: `Message.senderNickname` 추가, 또는 나간 멤버 포함 멤버 스냅샷 엔드포인트)이 필요해 T-008 범위를 넘음 → 별도 T-021 로 등록.
  - (블록 아님, 환경 제약) 로컬 OmniRoute 에 모델이 등록돼 있지 않아 실제 AI 델타 스트리밍(성공 경로)은 이번 실브라우저 세션에서 못 봤다. `error` 이벤트 처리(가장 흔한 실패 경로)는 확인했고, 성공 경로 파서·리듀서는 `lib/sse.test.ts`(단위)와 T-007 QA(fake 서버로 실서버 확인)에서 이미 검증됨.
  - (블록 아님, 디자이너 확인 대기) to-designer.md 에 남긴 5건(초대받은 방 문구, 2인 아이콘, "AI 다시 귀 열었다", 하단 페이징, 잡카피 5개) — 임의 문구라 디자이너 확정 전까지 바뀔 수 있음.
- date: 2026-09-16


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

### T-007 방 이벤트 SSE + 직렬 큐 + 4:1 컨텍스트 + OmniRoute 클라이언트 (api)
- verdict: PASS (사용자 지시로 개발자 대행 기록, 2026-09-16) — 실서버 검증 중 결함 2건 발견 → 같은 태스크에서 수정·재검증 후 PASS
- tests: 존재 / `./gradlew test` 217 passed, 0 failed (신규 44: `llm/OmniRouteClientTest` 6, `message/{AiContextBuilderTest 5, RoomEventBusTest 6, RoomAiExecutorTest 5, MessageServiceTest 12, MessageControllerIntegrationTest 10}`, `MapperTest` +3, `ChatRoomServiceTest.Events` 5) / 에이전트 실행(로컬 compose MySQL). 각 파일 RED(컴파일 실패·404·401) → GREEN 확인.
- checked:
  - acceptance 커버리지: OmniRouteClient(MockWebServer 델타·usage·[DONE]·비JSON 무시·5xx·타임아웃·연결 거부) / `GET events` 멤버만·SseEmitter·6종 이벤트 / POST 202 → USER 저장 → touch → `message` → HUMAN 종료 / 직렬 큐(같은 방 순차·다른 방 병렬·같은 유저 409·포화 503·start 거부 되돌림·예외 잡 비차단) / 컨텍스트(유효 프롬프트 + D-019 문구 + 라벨 + 나간 멤버 닉 + HUMAN 포함 + 최근 30 시간순) / 스트림 중 tx 없음(TransactionTemplate 2회 분리) / `daily_usage` 발신자 귀속 / `GET messages` 커서 / 자동 제목 / API.md 확정.
  - API.md 계약 일치: 이벤트 6종 payload·`replyTo`, 판정 순서 400→401→404→410→409/503, 503 `AI_BUSY` 에러 표, Message JSON(ASSISTANT 는 senderUserId/inputType/mode null), CONVENTIONS SSE 규칙.
  - **실서버 수동(bootRun + fake OmniRoute(SSE 3델타+usage, 1초 지연) + HS256 직접 서명 쿠키, DB 직접 삽입 유저 2명, 29 스텝 스크립트)**: 미인증 401 / 비멤버 events·messages 404 / `Content-Type: text/event-stream` / 입장 → `member JOINED`(닉 UTF-8 정상) / 공백·4,001자·`AUDIO` 400(값 미노출) / AI POST 202 → 0.3초 뒤 같은 유저 409 `ROOM_BUSY`, 참여자 202 /
    개설자 수신 순서 `message,message,delta×3,done,delta×3,done`(USER 는 즉시, AI 는 직렬) / `replyTo` 매칭·`promptTokens 111`·ASSISTANT `안녕하세요!` / 참여자도 동일 수신 / 제목 30자 / fake 요청 body `stream:true`·`include_usage`·system 에 D-019 문구·`[개설자 QA철수]`/`[참여자 QA영희]` 라벨 /
    DB messages 4행(ASSISTANT 2, model fake-gpt, prompt_tokens 합 222)·`daily_usage` 각 1건 111/7·`chat_rooms.message_count 4` / history size=3 → 커서 → 1건·next null / 잘못된 커서 400 / PATCH HUMAN → `mode` / HUMAN VOICE 전송 → `message` 만 / 참여자 나가기 → `member LEFT`,`mode AI` / 개설자 나가기 → `member LEFT roomStatus ORPHANED` / 20초 내 `: ping`. 검증 후 QA 데이터 삭제(잔여 0).
  - **발견·수정 1 (결함)**: SSE 클라이언트 끊김 시 톰캣 ASYNC/ERROR 재디스패치가 시큐리티 체인을 다시 타고 `JwtAuthFilter`(async 건너뜀) 없이 익명 → `AuthorizationDeniedException` + "response already committed" ERROR 스택 2건/끊김. `SecurityConfig` 에 `dispatcherTypeMatchers(ASYNC, ERROR).permitAll()` 추가, RED(ERROR 디스패치 401) → GREEN(404) 테스트 `MessageControllerIntegrationTest.Events.ASYNC_ERROR_디스패치는_시큐리티가_막지_않는다`. 재실행 시 ERROR 0.
  - **발견·수정 2 (UX)**: 구독 직후 헤더가 첫 이벤트/하트비트까지 커밋되지 않는 경우 있음(curl 1초 내 헤더 미수신 2/3회) → `EventSource.onopen` 지연. `RoomEventBus.subscribe` 가 `: connected` 주석을 즉시 보낸다(RED→GREEN `RoomEventBusTest`). 재실행 시 1초 내 헤더 수신.
  - 보안: 서버 로그 토큰(`eyJ`) 0, 요청 본문 값(`AUDIO`/`연타`) 0, WARN 0(`ExceptionHandlerExceptionResolver` 억제 확인), 시크릿 없음 ✓.
- issues:
  - (블록 아님, 백로그) 동시 잡 시 컨텍스트 순서: 참여자가 AI 답변 중에 보낸 USER 메시지가 그 답변(ASSISTANT) 보다 먼저 저장되므로 두 번째 잡의 컨텍스트가 `[개설자] Q1, [참여자] Q2, A1` 순이 된다. id 순(실제 시간순)이라 사양 위반은 아니나 LLM 이 A1 을 Q2 의 답으로 오해할 수 있음. 필요 시 `messages.reply_to_message_id` 컬럼 추가 후 Q/A 쌍으로 정렬 — CEO 판단.
  - (블록 아님, 환경) macOS 로컬에서 netty `MacOSDnsServerAddressStreamProvider` 미탑재 ERROR 1줄(첫 WebClient 호출). NAS(linux) 컨테이너에는 해당 없음. 거슬리면 `netty-resolver-dns-native-macos` 테스트 의존성.
  - (후속 T-008) `lib/sse.ts`: `replyTo` 로 델타 매칭, `: connected`/`: ping` 무시, 재연결 시 `GET messages` 보충. (후속 T-011) admin stats 는 `daily_usage` 조회.
- date: 2026-09-16

### T-020 테마 수동 선택(시스템/라이트/다크) (web)
- verdict: PASS (사용자 QA 판정 2026-09-17, 개발자 대행 기록)
- tests: 존재 / web `npm test` 240 passed(42 파일, 신규 `lib/theme.test.tsx` 13 · `ThemePicker.test.tsx` 3 · `Sidebar.test.tsx` +1), `npm run lint` 0 error(기존 `api.ts` 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked:
  - acceptance 커버리지: (1) 사이드바 하단 프로필 영역 테마 선택 3칸 — 단위 + 실브라우저. (2) `localStorage` 저장(system 은 키 삭제) + 첫 페인트 전 `<html data-theme>`(`next/script beforeInteractive` 인라인) — 단위(스크립트 문자열 실행) + 실브라우저 새로고침. (3) `globals.css` `[data-theme]` 반전 + `theme-color` 메타 동기화 — 실브라우저 computed 값. (4) 단위: 저장/복원/시스템 추종 전환/OS 변경 리스너/storage 이벤트/저장 불가 환경.
  - D-024 일치: A안(프로필 줄 아래 글자 필, 보조 라벨 없음, 우측 정렬), 고정 용어 `시스템 | 라이트 | 다크`, `aria-label` "테마 선택". DESIGN.md #원칙·§2, BRAND.md #2·#5 개정 반영.
  - **실브라우저(2026-09-17, 내장 브라우저 구글 계정 `상남자`, OS 다크, compose nginx :3000 + `./gradlew bootRun` + `npm run dev`)**: 데스크톱 1134 — 필이 로그아웃 줄 아래 우측(사이드바 280 안, 높이 32, 활성 칸 600). 다크 탭 → 즉시 반전(`--bg #170611`, `--surface #ff3d7f`), 저장 `dark`, 메타 1개 `#170611`. 새로고침·방 재진입 유지. 시스템 탭 → 키 삭제, OS 다크 따라감(속성 없음). 라이트 강제(OS 다크) → 라이트 토큰. 방향키 이동 + 포커스 링 accent 2px. 초대 시트 QR 카드 다크에서도 `#fff4f8` 바탕 + 어두운 모듈(D-021 E3). 모바일 375 드로어(폭 300) 안 같은 위치, 하단 잘림 없음, 드로어에서 라이트 탭 → 반전. 콘솔 오류 없음(api 꺼진 동안의 502 잔여 제외).
  - 개발 중 잡은 결함 2건(커밋 전 수정): hydration 전 인라인 스크립트가 `theme-color` 메타를 바꾸면 React 19 가 메타를 하나 더 꽂음 → 스크립트는 `data-theme` 만, 메타는 마운트 후 `ThemeSync`. `'use client'` 모듈 상수를 layout 에서 import 하면 클라이언트 참조 → `lib/themeInit.ts` 분리. TASKS 교훈 기록.
- issues:
  - (미검증) OS 라이트 + 다크 강제 첫 페인트 깜빡임(검증 환경이 다크), iOS 홈화면 PWA 상태바 색, 다른 탭 동기화(단위 테스트만).
  - (범위 외, 기존 동작) PillToggle 방향키로 값은 바뀌지만 DOM 포커스가 원래 칸에 남는다 — 모드 토글도 동일. 별도 T 후보.
- date: 2026-09-17

### T-025 UI 문구 전면 개정 — 사용자 수정안 52건 반영 (web)
- verdict: PASS (Playwright QA 2026-09-17, 사용자 지시로 개발자 대행 수행·기록) — 미검증 1건은 issues
- tests: 존재 / web `npm test` 240 passed(41 파일, 문구 갱신 18 + 신규 `ConfirmDialog` 두 줄 제목 · `RoomHeaderSheet` 비-MODE 오류 공용 문구, `josa.test.ts` 삭제), `lint` 0 error(기존 `api.ts` 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked:
  - acceptance 커버리지: copy-inventory.md 수정안 열 전량 교체 + 빈 칸 원안 유지 — 소스 grep 으로 옛 문구 0건. 공용 오류 `lib/copy.ts` 상수 1곳. 서버 메시지 패스스루 제거 3곳 + `MODE_NOT_ALLOWED` 매핑. "주인"→"방장", 입장 버튼 "들어가기" 통일, `\n` 제목, `josa` 삭제 — 각각 단위 + 실브라우저.
  - **실브라우저(2026-09-17, Playwright Chromium 390×844, 구글 계정 `상남자`(id 95), compose nginx :3000 + `./gradlew bootRun` + `npm run dev`)** — to-qa 확인 포인트 (1)~(9) 전부 일치:
    (1) 사이드바 `방장` 배지, 나가기 확인 제목 2줄(`white-space: pre-line`, 줄 수 2) "나가면 이 방은 끝이야. / 진짜 나갈거야?" + "나갈래 / 안 나갈래" — `qa25-01`, `qa25-02`.
    (2) 새 방 빈 상태 "오늘은 누가 짜증나게 했어?", 플레이스홀더 AI "무슨 얘기 하고싶어?" / HUMAN "AI 몰래 얘기하기", 전송 버튼 aria "전송" — `qa25-03`.
    (3) 방 헤더 시트: 혼자일 때 토글 `aria-disabled` + "친구 초대해봐!", "직접 쓰기" → 플레이스홀더 "AI 성격 어떻게 설정하고 싶어?", 커스텀 저장 후 "되돌리기" 노출 → 클릭 시 사라짐 — `qa25-04`.
    (4) 초대 시트: 코드 복사 → 토스트 "복사 완료"(클립보드 실값 확인), "코드 다시 만들기" → 2줄 제목 "이전 코드는 사용할 수 없어. / 새로 만들까?" + "새로 만들기 / 취소" — `qa25-05`, `qa25-06`.
    (5) **실 SSE**: 계정 B(id 94)를 DB 로 멤버 삽입 후 모드 토글 `유저끼리` → 시스템 라인 "유저끼리 대화 가능!" + 플레이스홀더 전환, `AI` → "AI랑 대화 가능!" — `qa25-12`, `qa25-13`. PATCH 를 400 `MODE_NOT_ALLOWED` 로 가로채면 토스트 "혼자서는 유저끼리 대화할 수 없어!" + 토글 되돌림.
    (6) `/join`: 실서버 본인 방 → "네 방 아니야? / 내 방 가기"(`qa25-07`), 없는 코드 → "그런 방 없는데?". 미리보기 응답 가로채기(ownerNickname `빵선이`) → "빵선이의 방 / 같이 뒷담화하자!" + "팀장 얘기 · 멤버 1/2 · 들어가기", `alreadyMember` 도 "들어가기" — `qa25-10`. FULL/ORPHANED/LIMIT/PAIR 4종 문구 + "내 방 가기", 500 → "시스템 오류. 다시 시도해줄래? / 다시".
    (7) 상세 응답 PARTICIPANT+ORPHANED 가로채기 → 모달 "이용할 수 없는 채팅방이야. / 방장이 도망간 방이야! / 나가기", 입력 잠김 "방장이 도망간 방이야!" — `qa25-09`.
    (8) POST messages 가로채기 400/409/503/500 → "불가능한 요청이야!" / "아직 답 쓰는 중. 좀만 기다려줘!" / "지금 바쁘니깐 잠깐 뒤에 다시 해봐!" / "시스템 오류. 다시 시도해줄래?" — 서버 존댓말 문구 노출 없음 — `qa25-08`.
    (9) 새 컨텍스트(쿠키 없음) `/login?error=access_denied|authorization_request_not_found|server_error` → "로그인 취소했네? 다시 시도해봐!" / "로그인 시간이 지났네? 처음부터 다시 해봐!" / "로그인에 실패했네? 잠시 후 다시 시도해봐!" — `qa25-14`.
    추가: 목록 응답 비우기 → `/` 와 사이드바 둘 다 "아직 방이 없네? 하나 만들자!" — `qa25-11`. 콘솔 오류는 의도한 4xx/5xx 응답뿐.
  - 스크린샷 14장 `.playwright-mcp/qa25-*.png`. 테스트 데이터: 방 5333(상남자 소유, 초대 코드 4SNWR8QP) 생성 유지, 삽입한 멤버 행은 삭제.
- issues:
  - (미검증) "{닉} 퇴장!" 실브라우저 — 두 번째 계정 로그인 세션이 없어 실제 나가기 이벤트를 못 냈다. 단위(`sse.test.ts`)로만 확인. 계정 B 로그인 시 1분 확인 가능.
  - (처리됨 2026-09-17) BRAND.md#5 표·DESIGN.md 인라인 문구 동기화 — 디자이너 대행(사용자 지시).
- date: 2026-09-17

### T-009 STT/TTS Provider + 엔드포인트 (api)
- verdict: PASS (사용자 지시로 개발자 QA 대행, 2026-09-18 — 이전 세션에서 실측 후 기록 누락분 재실측)
- tests: 존재 / api `./gradlew cleanTest test` **292 passed**(강제 재실행, compose MySQL. 첫 `gradlew test` 는 캐시로 "BUILD SUCCESSFUL in 1s" 라 무효 처리하고 cleanTest 로 다시 돌림). speech: `SpeechControllerIntegrationTest` 14(stt 8·tts 6), `SpeechServiceTest` 16(stt 11·tts 5), `SpeechPropertiesTest` 2, `SpeechProviderSelectionTest` 1, `extensionOf` 3, `startup` 1, `OmniRouteClientTest` 6, `OmniRouteSttProviderTest` 5, `OmniRouteTtsProviderTest` 4. 에이전트 실행(로컬).
- checked:
  - **실서버**: compose(nginx :3000 · MySQL · OmniRoute Groq/edge 노드 · edge-tts) + `./gradlew bootRun` 기본 설정(`groq/whisper-large-v3`, `edge/tts-1`, SunHi). 로컬 JWT_SECRET(코드 공개 기본값) 서명 토큰 user 1/2(소셜 자격증명 미사용). 마이크 없이 edge-tts 로 만든 한국어 음성 "진짜 짜증나. 부장이 또 회의에 30분 늦게 왔어." 를 `afconvert` 로 wav 16kHz / m4a(aac) 변환해 사용. 호스트에 ffmpeg 가 없어 webm/opus 는 미생성(확장자 매핑은 `extensionOf` 단위 테스트).
  - (2) STT wav 5.9초 → 200 `{"text":" 진짜 짜증나. 부장이 또 회의에 30분 늦게 왔어.","durationMs":5880,"provider":"omniroute"}` 1.06초, 전사 정확(non-turbo). m4a `audio/mp4`(iOS 경로) → 같은 텍스트 200 0.37초. `daily_usage.stt_seconds` 6 → 12 → 18(올림 초).
  - (2) TTS `{"text":"안녕, 반가워"}` → 200 `Content-Type: audio/mpeg`, `Cache-Control: private, max-age=3600`, 본문 MPEG layer III 24kHz 15,120B, 0.63초. `voice:"ko-KR-InJoonNeural"` 200 20,448B(다른 음성으로 생성됨 — 크기·바이트 상이). `tts_chars` 0 → 7 → 14. 청취는 미수행.
  - (5-1) 52.9초 wav(`durationMs=54000`) → 200 3.6초(타임아웃 30초 여유), 반복 문장 정확 전사, `stt_seconds` +53 → 71.
  - (3) 모든 호출 뒤 `/tmp/audio` 0개(성공·400·413·502 전부).
  - (4)(5-2) `durationMs=60001` 400 `AUDIO_TOO_LONG` / `abc` 400 `VALIDATION_FAILED` details.durationMs / `-5` 400 details.durationMs / audio 파트 없음 400 details.audio / 1,001자 400 `TEXT_TOO_LONG` / 공백 400 details.text. 사용량 미증가.
  - (5) 27,000,000B: nginx 경유 **413 HTML**(프론트는 상태코드만 볼 것), :8080 직행 413 JSON `PAYLOAD_TOO_LARGE`.
  - (1) 502 매핑: 잘못된 `voice`(edge 500) 와 무효 오디오(Groq 400) 모두 502 `SPEECH_UPSTREAM_ERROR` JSON, 상류 본문 미노출. api 로그는 `stt upstream failed: omniroute stt responded 400` 처럼 상태코드만(본문·오디오·토큰 없음). `STT_MODEL=nope/x` 재기동은 미수행(같은 502 경로, 단위 테스트 커버).
  - (6) 쿠키 없음 401. user 2 를 잠시 SUSPENDED 로 바꿔 403 `USER_SUSPENDED` 확인 후 ACTIVE 복구.
  - (7) `STT_PROVIDER=clova` 기동은 미수행(`SpeechProviderSelectionTest` 커버).
  - 계약 일치: API.md#speech 응답 필드·헤더·에러 코드(AUDIO_TOO_LONG·TEXT_TOO_LONG·VALIDATION_FAILED·SPEECH_UPSTREAM_ERROR·401·403) 전부 실측과 일치.
- issues:
  - (교훈, TASKS 반영) 체크리스트의 "26MB" 를 26,000,000B 로 만들면 25MiB(26,214,400B) **미만**이라 nginx·Boot 를 통과해 Groq 까지 갔다가 502 가 난다. 상한 실측은 26,214,401B 이상으로.
  - (블록 아님, 참고) 24.8MiB 의 무효 오디오도 상한 안이라 공급자까지 간다. Groq 무료 티어라 비용 무시. 서버측 최소 포맷 검증(매직 넘버)은 필요해지면 별도 T.
  - (블록 아님, 참고) bootRun 로그에 netty `MacOSDnsServerAddressStreamProvider` 로드 실패 ERROR 1회 — macOS 로컬 전용(`netty-resolver-dns-native-macos` 미포함), Linux 컨테이너 무관.
  - 뒷정리: user 2 ACTIVE 복구, 임시 토큰·오디오 파일 삭제, bootRun 종료. `daily_usage` user 1 오늘 행은 실측값(71/14) 그대로.
- date: 2026-09-18

### T-010 듣기/말하기 버튼 + 보이스 모드 루프 (web)
- verdict: PASS (기능) — 문구는 D-029 초안이라 사용자 확정 대기(REVIEW 유지). 개발자 QA 대행, 2026-09-18. Playwright 실브라우저 + 실백엔드.
- tests: 존재 / web `npm test` 319 passed(52 files, 신규 79), `lint` 0 error(기존 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked (실측: compose + api bootRun + web dev, nginx :3000, Playwright Chromium — fake mic + `context.addCookies`(로컬 JWT_SECRET 서명 user 1) + `grantPermissions(microphone)`):
  - 렌더: AI·ACTIVE 방(3668) 상단 바 "음성" 토글, AI 말풍선 "듣기" 버튼, 컴포저 "마이크" 버튼 모두 표시(스크린샷 `t010-room.png`).
  - 보이스 오버레이(D-029 1=2B): 토글 → dialog "보이스 모드" 열림, 내 쪽 말풍선 활성("녹음 완료" + `m:ss` 타이머 진행) + AI 쪽 45% + `status`(aria-live) "듣는 중". getUserMedia 성공(fake mic) → 실제 녹음. 신선 로드 시 자동 안 열림(오작동 아님 확인).
  - STT 왕복 실측: "녹음 완료" → 실제 MediaRecorder webm/opus(약 31KB) → nginx → api → OmniRoute → **Groq 200** `{text,durationMs,provider:"omniroute"}`(fake tone 이 영어로 전사됨). 전사 텍스트가 `inputType:VOICE` 로 전송돼 목록에 남고 **마이크 마커(`음성` 아이콘)** 표시.
  - 스트림 오류 경로: 전송 후 AI 응답이 error(이 로컬 OmniRoute 에 chat LLM 노드 미구성 — T-010 무관, 백엔드 범위) → 오버레이 error 카드 "시스템 오류. 다시 시도해줄래?" + "다시"/"끄기", 배경 blur(스크린샷 `t010-overlay-error.png`). "다시" → recording 복귀, "끄기" → 오버레이 닫힘 + 토글 해제.
  - 듣기(TTS) 실측: AI 말풍선 "듣기" → **`/speech/tts` 200 `audio/mpeg`**(실제 edge-tts) → 버튼 "정지"(aria-pressed) 유지하며 재생 → 오디오 자연 종료 시 "듣기"로 복귀(재생 큐·상태 정상).
  - 컴포저 마이크: "마이크" → 캡슐이 녹음 줄("듣는 중" + `m:ss` + 녹음 취소/완료)로 전환, "녹음 취소" → 입력창 복귀(스크린샷 `t010-composer-recording.png`).
  - 계약: STT/TTS 응답·헤더 API.md#speech 와 일치. VOICE 메시지 persist·표시 정상.
- issues:
  - (블록 아님, 범위 밖) 로컬 OmniRoute 에 chat LLM 노드가 없어 AI 응답이 error → 보이스 모드의 **speaking/TTS 재생 레그(성공 done → 합성)**는 오버레이 경유로는 미실측. 단, 같은 TTS 합성·재생 경로를 ListenButton 으로 200·재생·종료까지 실측했고, `useVoiceMode` speaking→TTS 전이는 단위 테스트가 덮는다. chat LLM 구성은 T-007/T-008 backend.
  - (참고) 실기기(iOS/Android) 마이크·PWA 왕복은 미실측 → T-013. HUMAN 전환 종료(2인 방 필요)는 단위 테스트로 대체.
  - (뒷정리) 테스트로 room 3668 에 남은 메시지 삭제(빈 방 복원), 임시 토큰·쿠키 파일 삭제. user 1 `daily_usage` 오늘 stt/tts 사용량은 실측값 그대로.
- date: 2026-09-18

### T-026 보이스 모드 체감 보강 — VAD 자동 종료 + 문장 단위 TTS 선재생 (web)
- verdict: PASS — 사용자 실브라우저 실측("전부 기대대로 잘 됐음") + 개발자 로그 대조, 2026-09-18. 개발자 QA 대행(사용자 지시).
- tests: 존재 / web `npm test` 360 passed(54 files, 신규 41), `lint` 0 error(기존 경고 1), `typecheck`·`build` 통과. 에이전트 실행(로컬).
- checked (실측: compose + api bootRun + web dev, nginx :3000, Mac Chrome 실마이크·실 OAuth 로그인, 방 5333, 보이스 루프 2회):
  - VAD(D-033 A1·A2): 말 끝나고 ~1초 뒤 탭 없이 transcribing 으로 자동 전환, 말 안 하면 유지 — 사용자 확인. 로그: 1회차 TTS 종료 후 탭 없이 2회차 `POST /speech/stt 200` 이 이어짐.
  - 선재생(B1~B4): done 전에 첫 문장 소리 시작, 문장 사이 끊김·중복·순서 꼬임 없음 — 사용자 확인. 로그: 응답당 `POST /speech/tts 200` 6회가 **+0s, +1s, +5s, +8s, +8s, +9s** 간격 — 첫 문장 즉시 + 선합성 1개 + 이후 재생 속도에 맞춘 순차 호출(설계대로).
  - 진폭(A4): 녹음 말풍선 바가 목소리 크기에 반응 — 사용자 확인.
  - 회귀: 듣기 버튼 정상, "다시"/"끄기" 시 재생 즉시 정지 — 사용자 확인. STT 200·메시지 202·TTS 전부 200(api WARN/ERROR 없음).
  - 계약: API 변경 없음(API.md#speech 그대로).
- issues:
  - (블록 아님, 범위 밖) SSE emitter 타임아웃 `AsyncRequestTimeoutException` 이 `GlobalExceptionHandler` 에 ERROR 스택으로 찍힘(재접속 `GET /rooms/{id}/events 200` 정상, 기능 영향 없음). 로그 노이즈 — 별도 T 후보(api).
  - (참고) 로컬 api 는 `LLM_MODEL` env 없이 뜨면 기본값 `chat-default` alias 로 OmniRoute 400 → 로컬은 gitignore 된 `application-secret.yml` 에 `app.llm.model` 을 둠(운영은 infra/.env). 실기기(iOS AudioContext suspended)·소음 환경은 미실측 → T-013 체크리스트.
- date: 2026-09-18

### T-028 SSE 셧다운 타임아웃 ERROR 로그 노이즈 제거 (api)
- verdict: PASS — 개발자 QA 대행(사용자 지시 "ㄱㄱ"), 2026-09-18.
- tests: 존재 / api `./gradlew test` 294 통과(compose MySQL), `GlobalExceptionHandlerTest` +1(`AsyncRequestTimeoutException` → 503 `SERVICE_UNAVAILABLE`, details null).
- checked (실측: bootRun + nginx :3000, 로컬 기본 JWT_SECRET 으로 user 95 access 토큰 서명 → `curl -N` 으로 room 5333 SSE 를 연 채 api SIGTERM):
  - 수정 전(15:24): 종료 ~27초 뒤 `GlobalExceptionHandler : unhandled exception` + `AsyncRequestTimeoutException` 스택 + `Ignoring exception, response committed` WARN.
  - 수정 후: graceful 30초 대기 → "Graceful shutdown aborted with one or more requests still active" 직전에 핸들러 DEBUG `async request timed out` 1건, ERROR 0건, 스택 없음(`--logging.level.com.example.chat.global.error=DEBUG` 로 호출 확인).
  - SSE 동작 회귀 없음: 구독 즉시 `:connected`, 브라우저 재접속 정상. `RoomEventBus` 무변경.
- issues: 없음. 로컬 재현 시 lsof 가 Docker 경유 커넥션을 못 세므로 SSE 열림 여부는 `:connected` 수신으로 확인할 것.
- date: 2026-09-18

### T-029 채팅 UI 정리 13건 (web)
- verdict: PASS — 사용자 Chrome 실측(:3000) + 개발자 QA 대행(사용자 지시 "태스크 종료"), 2026-09-18.
- tests: 존재 / web `npm test` 53 파일 365→368 통과, lint 0 error(기존 경고 1), typecheck, build 통과. 신규·수정: `VoiceModeOverlay`(단일 오브·X·다시), `Composer`(토글 순서), `ChatShell`(설정 시트 방 안/밖·드로어·우측 햄버거), `Sidebar`, `RoomHeaderSheet`(툴팁·가운데·테마 줄·저장), `AiPromptEditor`(취소/저장), `RoomListItem`(바깥 클릭·↑↓), `MessageBubble`, `MessageList`.
- checked: to-qa 9개 포인트(컴포저 [마이크][음성][전송], 우측 사이드바·드로어, 설정 시트 순서·가운데 정렬, 유저끼리 툴팁, 직접 쓰기 취소/저장, 듣기·"다시" 제거, cursor pointer, … 메뉴 닫힘, 보이스 단일 오브 + X) 사용자 실측 승인. 컴포저 지우기 X 는 5줄 입력에서도 세로 가운데 확인.
- issues: 없음. 브라우저 자동화는 소셜 로그인 쿠키 부재로 미사용(로컬 토큰 발급은 권한 정책 차단) — 실측은 사용자.
- date: 2026-09-18

### T-030 채팅 UI 정리 2차 4건 (web)
- verdict: PASS — 사용자 Chrome 실측 + 개발자 QA 대행(사용자 지시 "태스크 종료"), 2026-09-18.
- tests: 존재 / T-029 와 같은 실행에 포함(368 통과). `useMenu` 추출은 `RoomListItem` 기존 2건이 회귀 커버, `Sidebar` +3(프로필 메뉴·바깥 클릭/Escape·로그아웃 POST), `ChatShell`(드로어 X 없음·Escape·딤), `MessageBubble`(VOICE 아이콘 없음), `Composer` +1(지우기 순서·포커스).
- checked: 드로어 X 없음·딤/Escape 닫힘, 하단 우측 프로필 버튼 → 메뉴 "설정/로그아웃", 말풍선 VOICE 아이콘 없음, 입력창 지우기 X 노출/삭제/포커스 유지 — 사용자 실측 승인.
- issues: 없음. 보이스 오버레이 "다시" 버튼은 D-036 으로 보류(현행 유지).
- date: 2026-09-18


### T-031 AI 모드 메시지 비공개화 + 유저끼리 대화 컨텍스트 제외 (api) — D-037
- verdict: PASS — 사용자 실측(Chrome=개설자 / Safari·Firefox=참여자, :3000) + 개발자 QA 대행, 2026-09-19.
- tests: 존재 / api `./gradlew test` 307→308 통과(compose MySQL, cleanTest 강제 재실행 포함 실패 0).
  `RoomEventBusTest` +3(publishTo 대상·구독 없는 유저·실패 emitter 제거), `MessageServiceTest` 가시성 7건, `AiContextBuilderTest` +3, `MapperTest`(가시성 3행·뷰어 필터·컨텍스트 절단), `MessageControllerIntegrationTest` +1.
- checked (실측):
  - `AI` 모드에서 상대의 질문·AI 답이 내 화면에 안 뜨고 새로고침 후에도 안 보인다.
  - `유저끼리` 대화는 양쪽 다 보이고, `AI` 로 돌아온 뒤에도 남는다(과거 가시성 불변).
  - `유저끼리` 대화를 AI 가 모른다. 상대가 뭐라 했는지 **직접 물으면** 알려준다(D-037 2).
  - 두 사람이 연달아 물어도 각자 자기 답을 받는다(실측 1차 FAIL 수정분 재검증).
  - V4 백필: 더미 데이터로 귀속 결과 확인(AI 질문·답 → 발신자, 유저끼리 → 전원).
- issues: 실측 1차에서 FAIL 1건 → 같은 T 안에서 수정(to-dev 2026-09-19). 두 잡이 겹치면 컨텍스트가 assistant 턴으로 끝나
  Gemini 400 (`Requests ending with a model turn are not supported`). 잡이 트리거 id 까지만 읽도록 절단 + 회귀 테스트.
  남은 관측: SSE 클라이언트 끊김 ERROR 스택(동작 무해, 로그 노이즈) → T-033 으로 분리.
- date: 2026-09-19

### T-032 모드 토글 안내 툴팁 + 실측 정정 5건 (web) — D-037 4, D-038
- verdict: PASS — 사용자 실측(Safari 재검증 + 오류 말풍선 강제 재현 포함) + 개발자 QA 대행, 2026-09-19.
- tests: 존재 / web `npm test` 53 파일 371 → **54 파일 378** 통과, lint 0 error(기존 경고 1), typecheck 통과.
  `PillToggle` +2, `RoomHeaderSheet`(안내 2개·혼자 1개·참여자 제외), **`ChatShell.settings.test.tsx` 신설 5건**(실제 Sidebar 로 프로필 메뉴 → 설정: 참여자·개설자·상세 실패 폴백·Safari focusout·me 실패), `useMessages` +1(전송 시 오류 말풍선 정리), `RoomView` +2(**화면에서 사라지는지** + **오류 → 전송 → delta → done 전 구간에서 미복귀** — 스토어만 보던 빈틈 메움). 최종 web 54 파일 380 통과.
- checked (실측, Safari·Firefox·Chrome):
  - 프로필 메뉴 → 설정 열림(Safari 포함), 방 목록 … 메뉴도 동작.
  - 설정 시트 가로 스크롤바 없음, 모드 안내는 호버한 칸 것만 하나.
  - 참여자 시트에 모드·AI 성격 줄 없음(제목·멤버·테마만).
  - **오류 말풍선 소멸(D-038 2)**: OmniRoute 컨테이너를 내려 강제 재현(잡 실패 4건 `reply_to=2319~2322` 로그 대조) → 연달아 전송해도 화면에 오류 말풍선은 **항상 1개**. 참여자 창에는 오류 말풍선이 **하나도 안 뜬다**(error 이벤트도 대화 주인에게만, D-037).
  - **오류 → 정상 대화 재개**(사용자 지적으로 추가 검증): 상류를 내려 오류 1건(`reply_to=2323`) → OmniRoute 복구 → 다시 전송 →
    (1) 오류 말풍선 사라짐 (2) 점 3개 → 델타 → 정상 답변 (3) 답변 완료 후에도 오류 말풍선 미복귀. 이번 잡은 `AI job failed` 로그 없음(성공 경로 확인).
- issues: 강제 재현 1차에서 "안 사라짐" 으로 보였으나 **HMR 산물**이었다 — Fast Refresh 가 zustand 스토어 모듈(`streamStore.ts`)을 다시 평가해 스토어 인스턴스가 새로 생기고, 마운트된 화면은 옛 인스턴스를 구독하고 있었다. **하드 리로드 후 정상.** 스토어를 건드린 변경은 실측 전에 하드 리로드할 것.
  실측 1차 FAIL 5건은 같은 T 안에서 수정(to-dev 2026-09-19) — Safari focusout, 툴팁 중복·오버플로, 참여자 시트 범위, 오류 말풍선 잔류.
- date: 2026-09-19

### T-034 전송 후 입력창 포커스 유지 (web) — 사용자 버그 제보
- verdict: PASS — 사용자 실측 통과 + 개발자 QA 대행 기록, 2026-09-19.
- tests: 존재 / web `npm test` 54 파일 **384** 통과, lint 0 error(기존 경고 1), typecheck 통과.
  `Composer.test.tsx` +4 — 잠금 해제 시 포커스 복원 / 전송 버튼 클릭 후 포커스 유지 / 대기 중 다른 곳에 포커스가 있으면 안 뺏음 / `orphaned` 해제는 자동 포커스 없음.
  앞의 2건은 수정 전 RED 확인, 가드 2건은 `activeElement` 검사를 빼면 실패하는 것까지 확인(뮤테이션 체크).
- checked (실측): to-qa 2026-09-19 검증 포인트 (1)~(5) 통과 — AI 답 완료 후 입력창에 커서 복귀, 버튼 클릭 전송도 동일, `유저끼리` 모드 동일, 대기 중 다른 곳에 포커스를 두면 안 뺏음, `orphaned` 해제 시 자동 포커스 없음.
- issues: 없음. (6) 모바일/터치에서 잠금 해제 시 키보드 재등장 여부는 이번 실측 보고 없음 — 거슬리면 pointer:coarse 예외를 별도 T 로 분리.
- date: 2026-09-19

### T-033 SSE 클라이언트 끊김 ERROR 스택 제거 (api) — T-031 실측 중 발견
- verdict: PASS — 개발자 실측(:8081 별도 인스턴스 + `curl -N` SSE 끊김, 수정 전/후 로그 대조) + 개발자 QA 대행(사용자 지시 "태스크 종료"), 2026-09-19.
- tests: 존재 / api `./gradlew test` **310 통과**(68 클래스, 실패·스킵 0, compose MySQL).
  `GlobalExceptionHandlerTest` +2 — `AsyncRequestNotUsableException` → 503 + DEBUG 1줄 / catch-all 안전망 `ClientAbortException` → 503 + DEBUG 1줄.
  기존 "예상 못한 예외 500" 에 `ERROR` 로그 단언 추가(안전망이 진짜 실패를 삼키지 않는지 고정). 로그 레벨은 logback `ListAppender` 로 단언 — 응답 단언만으로는 "ERROR 로 안 찍힌다" 가 검증되지 않는다.
  전용 핸들러 부재 상태에서 컴파일 실패(RED) 확인 후 구현(GREEN).
- checked (실측):
  - 원인 경로 확정: 톰캣 `AsyncListenerWrapper.fireOnError` → `StandardServletAsyncWebRequest.onError` → `WebAsyncManager` 가 `AsyncRequestNotUsableException`(Caused by `java.io.IOException: Broken pipe`)으로 감싸 에러 디스패치 → advice catch-all `handleUnknown` 이 ERROR 스택. `RoomEventBus` send 실패 경로는 원인이 아니다(이미 IOException 을 잡아 debug).
  - 수정 전: 끊김 1건 = ERROR 스택 1건. 수정 후: 끊김 2건 = ERROR·WARN **0건** + `client disconnected during response:` DEBUG 2줄.
  - SSE 정상 동작 회귀: 구독 직후 `:connected`, 20초 하트비트 `:ping` 수신 그대로.
- issues: 없음. 한계 — 실브라우저(탭 닫기·새로고침·nginx 경유)가 아니라 `curl -N` 강제 종료로 재현했다(같은 예외·같은 스택). 실브라우저 확인은 to-qa T-033 (1)~(4) 로 남겨 다음 실측 때 곁눈질로 볼 것.
  관측 사실: 끊김은 **다음 하트비트(20초) 쓰기 시점**에야 예외로 드러난다 — 끊고 바로 로그를 보면 아직 없다(교훈 등재).
- date: 2026-09-19

### T-035 2인 방 보이스 모드 동시 사용 확인 — TTS 충돌 실측 (web, 검증만)
- verdict: PASS — 사용자 실측("전부 기대대로 잘 됐음, 대기는 안 거슬림") + 개발자 로그 대조, 개발자 QA 대행, 2026-09-19.
- tests: 코드 변경 없음. 기존 테스트가 경로를 덮는다 — web `voiceMachine.test.ts`(STREAM_DONE 은 추적 중인 replyTo 만), `useVoiceMode.test.tsx`(2인 방 상대 done 무시),
  api `MessageServiceTest`(AI 모드 `visibleToUserId` 기록)·`RoomEventBusTest`(`publishTo` 유저 타겟 발행).
- checked (실측, Chrome 개설자 + Safari 참여자, `AI` 모드, 둘 다 보이스 토글 ON): to-qa 2026-09-19 검증 포인트 (1)~(4) 통과.
  (1) 동시 발화 → 각자 자기 질문의 답만 재생, 상대 질문·답은 목록에도 안 뜸(D-037 유저 타겟 발행 + D-029 (6) replyTo 필터).
  (2) 늦은 쪽은 409 없이 "답하는 중" 으로 대기 후 자기 답 재생(`ROOM_BUSY` 유저 단위, 방 큐 직렬). **대기 체감 안 거슬림** — api `start` 이벤트 + `queued` 단계(제안 B)는 열지 않음.
  (3) 한쪽 speaking 중 상대 발화해도 재생 안 끊김. (4) 한쪽 `유저끼리` 전환 → 상대 오버레이 닫힘 + 토스트.
  로그 대조: api `bootRun` 로그 WARN 0 · ERROR 1 — 유일한 ERROR 는 첫 외부 호출 시 Netty `MacOSDnsServerAddressStreamProvider` 미로드 안내(시스템 DNS 폴백, T-035 무관·기능 영향 없음). `ROOM_BUSY`/`AI_BUSY`/예외 없음.
- issues: 없음. 관측 — 로컬 api 는 요청·AI 잡을 INFO 로 남기지 않아 "두 잡이 순서대로" 는 사용자 관찰(늦은 쪽이 상대 답 뒤에 재생)로만 확인. dev nginx 는 access_log 미설정.
  Netty macOS DNS ERROR 노이즈는 `io.netty:netty-resolver-dns-native-macos` 의존성(로컬 전용) 추가로 없앨 수 있음 — 배포(Linux)엔 안 뜨므로 백로그.
- date: 2026-09-19


### T-012 NAS 첫 배포 리허설 (infra)
- verdict: PASS — 사용자 실측("텍스트, 음성 성공", 2기기 SSE "전부 성공") + 개발자 NAS/외부 대조, 개발자 QA 대행(사용자 지시 "태스크 종료"), 2026-09-20.
- tests: 인프라 작업이라 자동 테스트 없음. 로컬 이미지 빌드 리허설(web 80MB·api 124MB, amd64) + `docker compose config` 파싱 확인.
- checked (운영 https://talk-behind-my-back.o-r.kr, master 4022782):
  acceptance ① GitHub Variables/Secrets → master push → GHCR → NAS 기동: deploy 3회 연속 성공(0c6e114·ab6f39d·4022782), `IMAGE_TAG` 자동 반영.
  acceptance ② DSM 리버스 프록시 경유 SSE: 휴대폰(LTE)+Mac(hosts 우회) 같은 방에서 메시지·AI 답장 실시간 도착 — 사용자 실측 PASS.
  acceptance ③ NAS x86_64 → `platforms: linux/amd64`. `X-Forwarded-For` → nginx 로그에 실제 클라이언트 IP(39.7.x.x) 복원, `X-Forwarded-Proto` → OAuth redirect_uri `https://…/api/login/oauth2/code/{provider}` 3사 확인.
  acceptance ④ `docker stats`: api 419MiB(상한 내) / mysql 529 / omniroute 649 / web 56 / nginx 6 / edge-tts 48.
  추가: Google 로그인 왕복, 음성 → Groq STT → Gemini → edge-tts TTS 왕복(사용자 실측), Flyway V1~V4 적용, Let's Encrypt 인증서(2026-12-19 만료, DSM 자동갱신), http:80 → `/login` 307.
  OmniRoute 대시보드 설정이 `data/omniroute/storage.sqlite` 에 저장됨(권한 수정 후 확인) — 재시작 시 유지.
- issues: to-qa 체크리스트 중 미실측 — Naver·Kakao 운영 로그인 왕복, SSE 2분 이상 방치 후 재연결, 세션 15분 후 silent refresh, PWA 홈화면(T-013 로), 이는 사용 중 자연 확인 대상으로 남김.
  관측 — DSM 리버스 프록시 `proxy_read_timeout` 기본 60s 는 SSE 재연결로 커버(끊김 체감 시 고급 설정에서 조정). OmniRoute 상주 메모리 ~650MiB 는 제거 검토 백로그.
- date: 2026-09-20
