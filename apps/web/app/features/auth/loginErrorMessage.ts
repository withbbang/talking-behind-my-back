/**
 * `/login?error=<code>` → 안내 문구 (API.md#auth).
 * 공급자 코드는 `[a-z0-9_]` 로 한정되어 오지만, 여기서 아는 코드만 구분하고 나머지는 공통 문구.
 */
const MESSAGES: Record<string, string> = {
  access_denied: '로그인을 취소했어요. 다시 시도할 수 있어요.',
  authorization_request_not_found: '로그인 시간이 지났어요. 처음부터 다시 해주세요.',
};

const FALLBACK = '로그인에 실패했어요. 잠시 후 다시 시도해주세요.';

export function loginErrorMessage(code: string | string[] | undefined): string | null {
  const first = Array.isArray(code) ? code[0] : code;
  if (!first) return null;
  return MESSAGES[first] ?? FALLBACK;
}
