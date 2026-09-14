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

