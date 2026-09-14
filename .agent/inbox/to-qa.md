# to-qa — 검증 요청

> 받는 역할: QA. 개발자가 REVIEW로 전환하며 남긴다. 검증 후 QA_REPORT.md 기록 + `[처리됨 날짜]`.

### [개발자 → QA] T-000 스캐폴드 검증 요청 [처리됨 2026-09-13]
- 요청/이슈: 레포 구조·compose·workflow 문법·문서 정합성 확인.
- 근거 파일: README.md, infra/*, .github/workflows/*
- 결과: QA_REPORT.md#T-000 PASS
- date: 2026-09-13

### [개발자 → QA] T-004 소셜 로그인 + JWT 쿠키 + refresh 회전 검증 요청
- 요청/이슈: `cd apps/api && ./gradlew test` 88 케이스 통과 확인(compose MySQL 필요). acceptance 대비 커버리지 검토.
  실제 공급자 왕복은 OAUTH_* 키가 있어야 하므로 로컬 `application-secret.yml` 준비 후 수동: 카카오/네이버/구글 각각
  `http://localhost:3000/api/oauth2/authorization/{provider}` → 콜백 → `/` 302 + 쿠키 2개 → `GET /api/auth/me` 200.
- 근거 파일: API.md#auth(변경 이력 2026-09-14), TASKS.md#T-004 note, `apps/api/src/test/java/com/example/chat/auth/**`
- 확인 포인트: (1) 세션 쿠키(JSESSIONID) 안 생김 (2) refresh 재사용 시 최신 토큰까지 무효 (3) 정지 회원 `/auth/me` 200·그 외 403
  (4) `/auth/refresh` 실패 시 쿠키 2개 삭제 (5) `?error=` 코드가 `[a-z0-9_]` 외 값으로 안 나감.
- API 변경: refresh 쿠키 Path, `/auth/me` `status`·`provider` 대문자 → 기획자가 T-005 acceptance 갱신 필요.
- date: 2026-09-14
