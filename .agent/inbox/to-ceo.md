# to-ceo — 결정 요청

> 받는 역할: CEO. 처리 결과는 DECISIONS.md에 D-번호로 기록하고 여기 항목에 `[처리됨 날짜, D-xxx]` 표시.

### [개발자 → CEO] 프로젝트/서비스 이름 확정 (T-000) [처리됨 2026-09-13, D-011]
- 요청/이슈: 디렉토리명 `chat-app`, compose `APP_NAME`, Java 패키지 `com.example.chat`이 모두 임시.
- 근거 파일: infra/.env.example, CONVENTIONS.md#백엔드
- 원하는 결과: 이름 확정 → T-001/T-002 초기화 시 반영.
- date: 2026-09-13

### [개발자 → CEO] 같은 이메일로 다른 공급자 로그인 시 정책 (T-004) [처리됨 2026-09-14, D-015]
- 요청/이슈: 카카오로 가입한 사용자가 같은 이메일로 구글 로그인하면 (a) 기존 계정에 연결 (b) 별도 계정 생성 (c) 거부 중 어느 것인지.
- 근거 파일: SCHEMA.md#2, D-003
- 원하는 결과: D-003 보완 결정. v1 단순화 제안은 (b) 별도 계정.
- 진행: 2026-09-14 (b) 별도 계정으로 구현됨(`AuthService.loginBySocial`, `AuthServiceTest`). D-번호로 확정만 남음.
- date: 2026-09-13

### [개발자 → CEO] STT 녹음 길이·일일 호출 상한 (T-009)
- 요청/이슈: API.md 초안은 60초/25MB, TTS 1,000자로 잡았음. 비용 확인 후 확정 필요. 일일 상한(daily_usage) 도입 여부.
- 근거 파일: API.md#speech, SCHEMA.md#7, D-007 open
- 원하는 결과: 수치 확정 또는 "v1은 상한 없음" 결정.
- date: 2026-09-13

### [개발자 → CEO] T-004 구현 중 확정한 기술 결정 DECISIONS.md 기록 요청 [처리됨 2026-09-14, D-012~D-016]
- 요청/이슈: 2026-09-14 대화에서 승인된 5건. 아래 초안을 D-번호로 옮겨 적으면 됨.
  1. refresh 쿠키 Path `/api/auth` (API.md 초안 `/api/auth/refresh`에서 변경) — logout 이 refresh 쿠키를 받아 해당 family 만 revoke.
     대안 (b) user_id 기준 전체 revoke(모든 기기 로그아웃) 기각.
  2. OAuth2 authorization request 는 HttpSession 대신 JWT(HS256, audience=oauth2-request, 5분) 서명 쿠키 `oauth2_auth_request`.
     대안 Java 직렬화 쿠키는 역직렬화 취약점으로 기각.
  3. 정지/권한 판정은 매 요청 `users` 1회 DB 조회(`JwtAuthFilter`). 대안 JWT claim 은 최대 15분 지연으로 기각.
  4. 같은 이메일 다른 공급자 = 별도 계정 (위 항목).
  5. 만료 access 는 401 `TOKEN_EXPIRED`, 쿠키 없음/변조는 401 `UNAUTHENTICATED` 로 구분. 프론트는 둘 다 refresh 시도.
- 근거 파일: API.md#auth 변경 이력 2026-09-14, TASKS.md#T-004 note, SecurityConfig.java 주석
- 원하는 결과: D-012~ 기록 후 이 항목에 `[처리됨]`.
- date: 2026-09-14


### [개발자 → CEO] 표시명 "김영선 욕하는 앱" → "뒷담 친구" (D-011 보완)
- 요청/이슈: 2026-09-15 사용자 지시로 사용자 노출 이름을 **뒷담 친구**로 변경(manifest name/short_name, `<title>`, 로그인 제목, README 제목).
  슬러그 `talking-behind-my-back`(compose APP_NAME, package.json, 레포명)은 그대로.
- 근거 파일: `apps/web/app/{manifest.ts,layout.tsx,(auth)/login/LoginClient.tsx}`, README.md, CONTEXT.md 8행(기획자 갱신 필요)
- 원하는 결과: D-011 에 보완 한 줄 기록 → 이 항목 `[처리됨]`.
- date: 2026-09-15

### [개발자 → CEO] 2인 채팅방 요건(2026-09-15) 결정 기록 요청 — D-017~ 초안 + CONTEXT.md/PLAN.md 갱신
- 요청/이슈: 2026-09-15 사용자가 채팅방 요건을 추가 제시(회원 혼자 개설, 코드/QR/URL 초대, 최대 2명, 개설자가 AI 성격 설정,
  2명이면 모드 토글, 모든 대화 저장, 물리 삭제 없음, 개설자 이탈 시 주인 없는 방, AI 학습 개설자 4 : 참여자 1).
  같은 날 대화에서 확정된 해석·기술 결정 아래. D-번호로 옮겨 적고, CONTEXT.md "기능 요건"·PLAN.md M2 acceptance 는 기획자 갱신 필요.
- 근거 파일: API.md#rooms(개정), SCHEMA.md #4 #4-1 #5, TASKS.md M2 머리말 + T-006/T-016/T-017/T-007/T-008/T-018
- 초안:
  1. **D-010 폐기 — draft 방 없음.** `POST /rooms` 로 명시 생성(제목 "새 대화", 코드 즉시 발급). 초대 코드가 방보다 먼저 있어야 하므로.
     빈 방 누적은 사용자당 활성 방 50개 상한으로 막는다(개설+참여 합산).
  2. **멤버십 모델.** `room_members(role OWNER|PARTICIPANT, left_at)`, 방당 활성 2명. "삭제" = 나가기. 방·메시지 행은 물리 삭제 없음.
     개설자 이탈 → `status=ORPHANED`(복구 없음), 참여자 멤버십은 남겨 모달 안내 후 확인 시 종료. 참여자 이탈 → 자리 비고 재입장 허용, 방은 `mode=AI` 복귀.
  3. **초대.** 방당 코드 1개(8자 base32, 혼동 문자 제외), URL `/join/{code}`, QR 은 프론트 생성. 만료 없음, 개설자 재발급 가능. 코드는 개설자에게만 노출.
  4. **모드.** `AI`(기본, 2명이 되어도 유지) / `HUMAN`(유저끼리, AI 휴면). 토글은 멤버 누구나. 혼자면 HUMAN 불가. HUMAN 대화도 저장 + AI 컨텍스트 포함.
  5. **AI 성격.** 방 컬럼 `ai_personality` RATIONAL(기본)/EMOTIONAL, 개설자만 언제든 변경. 문구는 코드(`AiPersonality` enum) 고정, 어드민 편집 없음.
     최종 시스템 프롬프트 = 어드민 활성 페르소나 + 성격 문구 + 가중 지시.
  6. **"학습 4:1" 해석(D-006 보완).** 파인튜닝 없음. 컨텍스트 = 최근 N개 전부(발신자 라벨) + 시스템 프롬프트 가중 지시
     "개설자 발화 80% / 참여자 20% 비중, 개설자 발화가 적어도 개설자 기준 우선". 장기 메모리 요약(`ai_memory`)은 백로그.
  7. **동시 AI 요청(D-008 보완).** 방 단위 직렬 큐. USER 메시지 즉시 저장·브로드캐스트, AI 응답은 방당 순차. 같은 유저 대기 1건 초과 시 409 `ROOM_BUSY`.
     실시간 전달은 `GET /rooms/{id}/events` SSE 구독(in-memory 브로드캐스트, 인스턴스 1대). WebSocket 기각.
  8. **음성(M3).** 2인 방에서도 듣기/말하기·보이스 모드 모두 허용. 충돌 처리는 M3 에서.
  9. 커서 페이징은 불투명 문자열(방 목록 `(lastMessageAt,id)` 키셋). 응답 시간 UTC `Z`.
- 원하는 결과: D-017~D-025 기록 → CONTEXT.md 기능 요건 6~ 추가, PLAN.md M2 재작성 → 이 항목 `[처리됨]`. DESIGN.md 갱신 요청은 to-designer.md 에 별도.
- date: 2026-09-15

### [개발자 → CEO] D-022 세부 4건 확정 요청 — 같은 두 사람 활성 방 1개 규칙 (T-023) [처리됨 2026-09-16, 사용자가 제안값 그대로 확정 → DECISIONS.md#D-022]
- 요청/이슈: 규칙 본체는 사용자 결정(2026-09-16). 구현 전 확정 필요 —
  (1) 방향: **쌍 기준**(제안) vs 역할 기준. (2) ORPHANED 방: **제외**(제안) vs 포함. (3) 오류 코드 `PAIR_ROOM_EXISTS` + 카피 "걔랑은 이미 방 있잖아"(제안).
  (4) 판정 순서에서 PAIR 를 FULL 앞에 둘지(제안: 앞 — "꽉 찼어"보다 "이미 방 있잖아"가 더 정확한 이유).
- 근거 파일: DECISIONS.md#D-022, TASKS.md T-023, `apps/api/.../ChatRoomService.checkJoinable`
- 원하는 결과: D-022 세부 확정 표기 → T-023 blocked_by 해제.
- date: 2026-09-16

### [개발자 → CEO] 보이스 모드 "다시" 버튼 처리 결정 요청 [처리됨 2026-09-18, D-036 보류]
- 배경: D-034 12 로 오버레이를 단일 오브 + 우측 상단 X 로 바꾸며 하단 "다시"(RETRY → recording) 하나만 남김. 사용자가 "다시를 제거했을 때 경우의 수" 질문(2026-09-18).
- 제거 시 영향: 정상 4단계는 자동 흐름이라 무방하나 답하는 중/말하는 중 끊기가 X→재진입 2탭이 되고, **권한 거부·오류 카드는 X 외 액션이 없는 막다른 화면**이 된다.
- 선택지: (1) 카드(권한 거부·오류)에서만 "다시" 유지, 정상 단계에선 숨김 — 최소 변경, 추천. (2) 오류 카드는 토스트 + 2초 뒤 자동 듣기 복귀, 권한 거부는 "권한 요청" 버튼만. (3) barge-in(말하는 중 마이크 열어 두고 발화 시 TTS 중단) — 에코 필터 필요, 별도 T 크기.
- date: 2026-09-18

