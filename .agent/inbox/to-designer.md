# to-designer — 디자이너 요청

> 받는 역할: 디자이너. 처리 후 DESIGN.md 갱신 + 항목에 `[처리됨 날짜]`.

### [개발자 → 디자이너] 핑크 테마 컬러 토큰·로그인 화면 초안을 DESIGN.md 에 반영 요청 (T-005)
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
