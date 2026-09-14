# chat-app 작업 지침

이 저장소는 `apps/web`(Next.js PWA) · `apps/api`(Spring Boot) · `infra/`(NAS 배포)를 묶는 단일 모노레포다.
협업 규칙·상태는 전부 `.agent/` 아래 파일이 단일 소스다. **코드를 만지기 전에 `.agent/README.md` → `.agent/TASKS.md` 를 먼저 읽는다.**
TASKS.md 상단 "진행 중 얻은 교훈"은 착수마다 다시 본다.

## 착수 전 필수

1. **파일시스템 확인 먼저.** 변경 전에 실제 디렉터리/파일 상태를 확인한다. 추측으로 경로를 만들지 않는다.
2. **제안 → 선택 → 구현.** 변경안을 먼저 제시하고, 사용자가 고른 항목만 구현한다. 임의로 범위를 넓히지 않는다.
3. **역할 권한.** `.agent/README.md`의 파일별 write 권한표를 따른다. 허용되지 않은 파일은 읽기만 한다.
4. **TDD.** 로직 변경은 실패 테스트(RED) → 최소 구현(GREEN) → 리팩터. 테스트 없는 구현은 완료가 아니다.
5. **시크릿 금지.** 키/비밀번호/토큰은 코드·문서에 쓰지 않는다. `infra/.env`(gitignore)와 환경변수만 사용.
6. **Boot 4 import 는 `../Homepage`/`../Admin` 기존 코드에서 확인 후 사용.** 기억으로 쓰면 컴파일이 깨진다(CONVENTIONS.md#백엔드).
7. **api 구조.** 도메인별 패키지 `com.example.chat.{user,chatroom,message,persona}` + `global/{config,error}`. 스키마는 Flyway(`src/main/resources/db/migration/V*__*.sql`)만, 쿼리는 MyBatis XML(`resources/mapper/*.xml`). Java 17 / Boot 4.1.

## 태스크 생명주기

1. **신규 태스크** → 착수 전 `.agent/TASKS.md`에 T-번호로 등록 (acceptance 기준 포함).
2. **진행** → status를 `IN_PROGRESS`로. 구현+테스트 통과 후 `REVIEW` + `inbox/to-qa.md`에 검증 요청.
3. **검증** → QA가 `QA_REPORT.md` 기록. PASS면 `DONE`, FAIL이면 `inbox/to-dev.md`.
4. **파생 작업** → 별도 T-번호로 등록하고 원 작업에 `→ T-xxx 참조`.
5. **결정이 필요한 것** → `inbox/to-ceo.md`에 남기고 `DECISIONS.md` 기록을 기다린다. 임의 결정 금지.
6. **교훈** → 같은 데서 두 번 넘어질 만한 것은 `TASKS.md` 상단에 한 줄.
7. **역할 대행.** 사용자가 CEO/QA 파일(`DECISIONS.md`, `QA_REPORT.md`)을 "네가 적어라" 하면 그 지시 범위 안에서만 대신 쓴다. "태스크 종료" = QA_REPORT 기록 + TASKS `DONE` + to-qa 처리됨 + 커밋.

## 브랜치·커밋

- `feature_YYYYMMDD` → `dev` → `master`, 각각 `--no-ff` 머지. `master` push가 NAS 배포를 트리거한다(`.github/workflows/deploy.yml`).
- 커밋 메시지는 `.gitmessage.txt` 템플릿: `Type(scope) : 제목` / 본문 `- ` 불릿 / 꼬릿말 `Task: T-xxx`. type = Feat|Fix|Refactor|Style|Docs|Test|Chore, scope = web|api|infra|agent.

## 자주 쓰는 명령

```
cp infra/.env.example infra/.env && cp infra/.env.omniroute.example infra/.env.omniroute   # 최초 1회, 값 채우기
cd infra && docker compose -f docker-compose.dev.yml up -d   # nginx :3000 + MySQL + OmniRoute
cd apps/api && ./gradlew bootRun                              # :8080/api
cd apps/web && npm run dev                                    # :3001 — 브라우저는 http://localhost:3000 (nginx 경유)
cd apps/web && npm test && npm run lint && npm run typecheck
cd apps/api && ./gradlew test                                 # compose MySQL 필요
```

CI(`.github/workflows/ci.yml`, `dev`/`master` push): web lint+typecheck+test+build (Node 22), api `gradlew test` (Java 17). 로컬에서 같은 명령 통과 후 push.

## 문서 위치

| 궁금한 것 | 파일 |
|---|---|
| 뭘 만드는지, 요건 원문 | `.agent/CONTEXT.md` |
| 지금 뭘 해야 하는지, 교훈 | `.agent/TASKS.md` |
| 왜 이렇게 결정했는지 | `.agent/DECISIONS.md` |
| 유저 스토리·마일스톤·acceptance | `.agent/PLAN.md` |
| 화면 설계·인터랙션 | `.agent/DESIGN.md` |
| API 계약 | `.agent/API.md` |
| DB 스키마 | `.agent/SCHEMA.md` |
| 코딩/커밋/테스트/툴 규칙 | `.agent/CONVENTIONS.md` |
| 레포 구조·요청 흐름·배포 순서 | `README.md` |
