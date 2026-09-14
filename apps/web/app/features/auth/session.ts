import { apiFetch } from '@/lib/api';

/**
 * /login 콜드 오픈용 silent refresh (TASKS.md#T-005 note 2).
 * access 쿠키(15m)는 사라졌어도 refresh 쿠키(30d, Path /api/auth)는 이 요청에 실린다.
 * 성공(204)이면 새 access 쿠키가 심겨 / 로 돌아갈 수 있다. 어떤 실패든 false — 로그인 버튼을 보여준다.
 */
export async function silentRefresh(): Promise<boolean> {
  try {
    await apiFetch<void>('/auth/refresh', { method: 'POST', retryOn401: false });
    return true;
  } catch {
    return false;
  }
}
