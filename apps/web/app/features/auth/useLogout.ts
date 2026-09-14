import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';

/**
 * 로그아웃. POST /auth/logout 은 인증 불필요(API.md) — 401 재시도 없음.
 * 성공/실패 무관하게 캐시를 비우고 /login 으로 전체 이동한다. 요청이 실패해 쿠키가 남았다면
 * proxy 가 다시 / 로 돌려보내므로 사용자는 로그인 상태임을 알 수 있다.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST', retryOn401: false }),
    onSettled: () => {
      queryClient.clear();
      hardNavigate('/login');
    },
  });
}
