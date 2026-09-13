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
