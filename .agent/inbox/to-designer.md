# to-designer — 디자이너 요청

> 받는 역할: 디자이너. 처리 후 DESIGN.md 갱신 + 항목에 `[처리됨 날짜]`.

### [개발자 → 디자이너] 핑크 테마 컬러 토큰·로그인 화면 초안을 DESIGN.md 에 반영 요청 (T-005) [처리됨 2026-09-16, BRAND.md#2 + DESIGN.md#1]
- 요청/이슈: DESIGN.md 미결 "컬러 토큰·타이포"를 사용자 지시(2026-09-15, 핑크 테마)로 개발자가 초안 확정해 코드에 넣음.
  토큰은 `apps/web/app/globals.css` `:root` / `@media (prefers-color-scheme: dark)`:
  `--bg #fff4f8/#170611`, `--ink #2b0a1a/#ffe1eb`, `--surface #2b0a1a/#ff3d7f`(라이트·다크 반전), `--on-surface`, `--accent #ff3d7f/#ff6b9c`,
  `--danger`, `--alert-on-surface`. Tailwind 에서 `bg-bg text-ink bg-surface text-accent` 로 사용. 폰트는 시스템 한글 스택(웹폰트 없음).
  로그인 화면: 제목 "뒷담 친구" 한 줄 좌측 + 하단 말풍선(surface 면 + 꼬리)이 소셜 버튼 3개·오류 알림을 담음. 말풍선은 `app/icon.svg` 와 같은 은유.
  소셜 버튼은 각사 브랜드색 유지. 약관/개인정보 링크 없음(v1).
- 근거 파일: `apps/web/app/globals.css`, `apps/web/app/(auth)/login/LoginClient.tsx`, `apps/web/app/icon.svg`
- 원하는 결과: DESIGN.md#원칙 또는 새 "토큰" 절에 위 값 기록, 미결 항목에서 컬러 토큰 제거. 바꾸고 싶은 값은 to-dev.md 로.
  2026-09-15 추가: 제목 중앙 정렬, 소개문 우측 2줄, 말풍선 안내문 없음, 오류는 상단 토스트(`components/ui/Toast`). 아이콘 세트(악마 하트) 적용 완료 — 미결에서 제거 가능.
- date: 2026-09-15

### [개발자 → 디자이너] 2인 채팅방 화면 설계 요청 (T-008/T-018) [처리됨 2026-09-16, DESIGN.md#2~6]
- 요청/이슈: 2026-09-15 요건 변경(inbox/to-ceo.md 최신 항목). DESIGN.md#채팅 에 필요한 화면 —
  (1) 사이드바 "+ 새 방"(draft 폐기), 방 항목에 역할/주인 없는 방 표시. (2) 방 헤더: 멤버 2명 표시, 모드 토글(유저끼리 ↔ AI), AI 성격 선택(개설자만).
  (3) 초대 공유 시트: 코드·URL 복사·QR·재발급. (4) `/join/{code}` 미리보기 → 입장. 실패(없음/정원/주인 없음/본인 방) 안내.
  (5) "이용할 수 없는 채팅방입니다." 모달(확인 1개). (6) 2인 대화 말풍선: 나/상대/AI 3종 구분.
- 근거 파일: API.md#rooms, TASKS.md T-008/T-018
- 원하는 결과: DESIGN.md 갱신. 모바일 390px 기준.
- date: 2026-09-15

### [개발자 → 디자이너] T-008 착수 확정 사항 DESIGN.md 반영 요청 (D-020)
- 요청/이슈: (1) 아이콘 소스 `@phosphor-icons/react` bold 24px — DESIGN.md 컴포넌트 스펙 또는 원칙에 "아이콘 라이브러리" 한 줄. (2) `/` 동작(최신 방 자동 이동, 없으면 빈 상태) 을 #2 채팅 셸에 추가.
  (3) 시간 표기 규칙(목록 상대시간 / 말풍선 HH:mm / 날짜 칩 M월 D일 요일). (4) T-020 테마 수동 선택 예정 — #원칙 "수동 토글 없음(v1)" 문구를 "T-020 에서 추가" 로.
- 근거 파일: DECISIONS.md D-020, TASKS.md T-008/T-020
- 원하는 결과: DESIGN.md 갱신. 값 이견은 to-dev.md 로.
- date: 2026-09-16

### [개발자 → 디자이너] T-008 구현 중 판단 4건 확인 요청 [처리됨 2026-09-17, 사용자 결정 D-025 → T-025 코드 반영. BRAND/DESIGN 갱신은 아래 항목]
- 요청/이슈: DESIGN.md 에 없거나 데이터가 없어 개발자가 정한 것. 바꾸려면 to-dev.md 로.
  (1) 목록 API(`GET /rooms`)는 `members: null` 이라 참여자 보조 줄에 상대 닉네임을 못 넣음 → "초대받은 방" 고정 문구. 상대 닉네임을 원하면 API 변경(T-번호) 필요.
  (2) 2인 방 목록 아바타: 상대 닉네임이 없어 사람 이니셜 대신 Users(두 사람) 아이콘 원.
  (3) 모드 AI 복귀 시스템 라인: BRAND 표에 없어 "AI 다시 귀 열었다" 사용(HUMAN 진입은 표 문구 그대로).
  (4) 사이드바 페이징: 목록이 최신순이라 "상단 도달" 대신 하단 도달 시 다음 페이지.
  (5) AI 성격 textarea 플레이스홀더 "AI 한테 어떻게 굴라고 할래?", 이전 페이지 버튼 "이전 대화", 나가기 확인 버튼 "나갈래"/"안 갈래", 방 목록 새 방 시간 자리 "새 방", 404 방 "그런 방 없는데?".
- 근거 파일: `apps/web/app/components/chat/{RoomListItem,Sidebar,AiPromptEditor,MessageList,RoomView}.tsx`, `apps/web/app/lib/sse.ts`
- 원하는 결과: DESIGN.md#2~3 / BRAND.md#5 표에 반영 또는 대체 문구.
- date: 2026-09-16

### [개발자 → 디자이너] 빈 방 상태 vs 시스템 라인 우선순위 (T-018 QA 발견) [처리됨 2026-09-16, 사용자 결정 → DESIGN.md#3, T-024]
- 요청/이슈: 메시지 0개인 방에 친구가 들어오면 "빵선이 등장!" 시스템 라인 대신 빈 상태("오늘은 누가 그랬어?")가 그대로 보인다(빈 방 판정이 메시지 수만 본다). 시스템 라인이 있으면 목록을 보여줄지, 빈 상태 위에 라인만 얹을지 결정 필요.
- 근거 파일: QA_REPORT.md#T-018 issues, `apps/web/app/components/chat/RoomView.tsx`(`empty` 판정), DESIGN.md#3 빈 방
- 원하는 결과: DESIGN.md#3 빈 방 항목에 한 줄. 바뀌면 to-dev 로.
- date: 2026-09-16

### [개발자 → 디자이너] D-025 문구 전면 개정 — BRAND.md#5 표·DESIGN.md#2~6 갱신 요청 (T-025) [처리됨 2026-09-17, 디자이너 대행(사용자 지시) — BRAND.md#5 표 교체 + 고정 용어 줄, DESIGN.md 4차 개정]
- 요청/이슈: 사용자가 `inbox/copy-inventory.md` `수정안` 열로 UI 문구 52건을 확정(D-025), 코드 반영 완료. 문서가 코드보다 뒤처진 상태.
  주요 변경 — 공용 오류 "시스템 오류. 다시 시도해줄래?", "주인"→"방장", 시스템 라인 "유저끼리 대화 가능!"/"AI랑 대화 가능!"/"{닉} 퇴장!",
  입장 버튼 "들어가기"(재입장 구분 없음), 입장 소개문 "{닉}의 방 / 같이 뒷담화하자!", ORPHANED 모달 "이용할 수 없는 채팅방이야." / "방장이 도망간 방이야!" / "나가기",
  모드 안내 "친구 초대해봐!", 로그인 오류 3종 반말화, 서버 메시지 토스트 노출 폐지(전송 400 "불가능한 요청이야!", MODE_NOT_ALLOWED "혼자서는 유저끼리 대화할 수 없어!"). 전체 목록은 copy-inventory.md.
- 근거 파일: D-025, `inbox/copy-inventory.md`, `apps/web/app/lib/copy.ts`
- 원하는 결과: BRAND.md#5 "상황별 예시" 표를 copy-inventory.md 기준으로 교체(원안 승인분 포함), DESIGN.md#2~6 인라인 문구 동기화. 고정 용어 목록에 "방장" 추가 검토.
- date: 2026-09-17

### [개발자 → 디자이너] D-033 보이스 모드 체감 보강 — DESIGN.md#7 갱신 요청 (T-026)
- 요청/이슈: 보이스 모드 흐름이 바뀐다. (1) recording 은 "녹음 완료" 탭 외에 **말이 끝나고 1초 무음이면 자동 종료**(적응형 VAD, 발화 전엔 종료 안 함, 60초 상한 유지). (2) streaming 중 **첫 문장이 완성되면 바로 읽기 시작**해 답변이 끝나기 전에 목소리가 나온다(speaking 은 남은 큐를 마저 읽는 단계). (3) recording 오브의 바 5개는 CSS keyframes 대신 실제 마이크 진폭에 반응한다. 컴포저 마이크는 탭/탭 그대로.
- 근거 파일: D-033, `apps/web/app/features/speech/{vad,sentenceChunker,useRecorder,useVoiceMode,ttsPlayer}.ts`, `components/voice/VoiceOrb.tsx`
- 원하는 결과: DESIGN.md#7 상태 설명에 자동 종료·선재생·진폭 한 줄씩. 바뀌면 to-dev 로.
- date: 2026-09-18
