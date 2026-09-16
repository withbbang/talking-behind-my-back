/**
 * 로그인 후 복귀 경로(`?next=`) 정제 — api `NextPath.sanitize` 와 같은 규칙 (API.md#auth, D-021).
 * 앱 내부 상대경로만 통과: `/` 로 시작, `//` 아님, 경로·쿼리용 ASCII 만, 200자 이내. 그 외 null.
 * proxy.ts(edge) 와 클라이언트 양쪽에서 import 하므로 의존성 없이 순수 함수만 둔다.
 */
const SAFE = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*$/;
const MAX_LENGTH = 200;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH || !SAFE.test(raw)) return null;
  return raw;
}

/** `/api/oauth2/authorization/{provider}` 에 next 를 붙인다. 불량이면 붙이지 않는다. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
