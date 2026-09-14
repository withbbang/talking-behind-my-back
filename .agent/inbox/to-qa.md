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

### [개발자 → QA] T-005 로그인 페이지 + 세션 유지 + 라우트 가드 검증 요청
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
- 범위 외(기존 미결): favicon/`icons/*.png` 404 (T-001 note, DESIGN.md 아이콘 미결), 약관/개인정보 링크 없음(v1 결정).
- date: 2026-09-14
