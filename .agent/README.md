# .agent — chat-app 협업 워크플로우

> AI 에이전트(CEO/기획자/디자이너/개발자/QA)가 파일을 통해 협업하는 공간.
> 에이전트끼리 직접 대화할 수 없으므로 **파일이 유일한 소통 채널**이다.
> 요건 원문은 CONTEXT.md, 레포 구조·요청 흐름·배포 순서는 루트 README.md.

## 프로젝트 개요 (TL;DR)
심심이 같은 음성 대화 앱. 소셜 로그인(구글/네이버/카카오)만 지원, 채팅방 여러 개,
방마다 텍스트/음성(STT/TTS) 대화, 음성 대화도 텍스트로 기록. 별도 어드민 페이지.
스택: Next.js PWA + Spring Boot(MyBatis) + MySQL + OmniRoute(LLM 게이트웨이), Synology NAS Docker 배포.
혼자 개발. 배포 대상은 NAS 한 대. 비용·메모리 제약이 설계 기준에 포함된다.

## 파일 지도 + 쓰기 권한 (충돌 방지 핵심 규칙)
| 파일 | 내용 | Write | Read |
|---|---|---|---|
| CONTEXT.md | 요구사항 원문·제약·용어 (거의 안 바뀜) | 기획자 | 전원 |
| PLAN.md | 유저 스토리·마일스톤·acceptance | 기획자 | 전원 |
| DECISIONS.md | 우선순위·범위·기술 결정 로그 (D-번호) | CEO | 전원 |
| CONVENTIONS.md | 브랜치·커밋·코딩·테스트·툴 규칙 | CEO | 전원 |
| DESIGN.md | 화면 설계·인터랙션 | 디자이너 | 개발자, QA |
| API.md | 프론트↔백 API 계약 | 개발자 | 전원 |
| SCHEMA.md | DB 스키마 | 개발자 | 전원 |
| TASKS.md | 작업 큐 (T-번호) | owner가 자기 라인만 | 전원 |
| QA_REPORT.md | 검증 리포트 | QA | 개발자, 기획자 |
| inbox/to-*.md | 역할 간 요청/이슈 | 보내는 쪽 | 받는 쪽 |
| apps/** 코드·테스트 | 구현 | 개발자 | QA, 디자이너 |
| infra/**, .github/** | 배포 설정 | 개발자 | QA |

**한 파일 = 한 역할 write.** 동시에 같은 파일에 쓰면 서로 덮어쓴다.
API.md·SCHEMA.md는 개발자가 쓰지만, 계약이 바뀌면 기획자·QA가 읽고 acceptance를 갱신한다.

## 개발 방법론: TDD (필수)
- 사이클: **RED**(실패 테스트) → **GREEN**(통과 최소 구현) → **REFACTOR**.
- 프론트: Vitest + React Testing Library — `cd apps/web && npm test`
- 백엔드: JUnit5 + AssertJ + MockMvc — `cd apps/api && ./gradlew test`
- 외부 API(OmniRoute, STT/TTS, OAuth)는 인터페이스 뒤에 두고 테스트는 fake로 격리한다.
- 원칙: 테스트 없는 구현은 "완료"가 아니다. QA는 테스트 존재/통과를 함께 검증한다.

## 한 사이클 워크플로우
1. 기획자: PLAN.md 요구사항 → TASKS.md 등록 (각 작업에 테스트로 검증 가능한 acceptance)
2. CEO: PLAN.md 읽고 우선순위·범위 판단 → DECISIONS.md 기록. 기술 갈림길도 여기서 확정.
3. 디자이너: DESIGN.md 화면 설계 (로그인·채팅 셸·채팅방·보이스 모드·어드민)
4. 개발자: **API.md/SCHEMA.md 계약을 먼저 갱신** → 테스트(RED) → 구현(GREEN) → 리팩터 →
   전체 테스트 통과 → TASKS.md status REVIEW → inbox/to-qa.md 검증 요청
5. QA: 테스트 존재 + 전체 통과 확인 → 요구사항 커버리지 → 엣지케이스·반응형·접근성·PWA →
   QA_REPORT.md 기록 → PASS면 DONE / FAIL이면 inbox/to-dev.md
6. 반복

## 이 프로젝트 특유의 검증 포인트 (QA·개발자 공통)
- SSE 스트리밍: nginx 경유 시 델타가 버퍼링 없이 순서대로 도착하는가, 중단 시 부분 응답 처리
- 방당 동시 요청 1건: 전송 중 재전송 시 409, UI 비활성화
- 음성 루프: 녹음 → STT → 메시지 저장(VOICE) → 응답 → TTS 재생 → 자동 재청취
- 오디오 파일은 `/tmp/audio`(tmpfs)에서 처리 후 삭제, DB에는 텍스트만 남는가
- 세션: 앱 종료/재시작 후 refresh 쿠키로 자동 로그인, 만료 시 /login 이동
- iOS 홈화면 PWA에서 소셜 로그인 왕복 (Safari로 튀어나가지 않는가)
- 컨텍스트 윈도우: 긴 방에서 LLM에 최근 N개만 전달되는가

## 토큰 절약 규칙 (전 에이전트 공통)
- 작업 하나 끝나면 `/clear`. 상태는 파일에 남아있으니 대화 히스토리 유지 불필요.
- 각 파일 상단 TL;DR(3~5줄)만 우선 읽고, 필요 시 본문 열람.
- 관련 파일만 읽기. 전체 코드베이스 로딩 금지. 테스트는 대상 코드와 그 테스트 파일만.
- 단순 작업(QA 1차 스캔, 상태 정리)은 가벼운 모델로.
- 필요한 역할만 활성화. 5개 상시 대기 금지. `launch-agents.sh` 참고.
