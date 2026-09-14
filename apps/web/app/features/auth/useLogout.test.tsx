import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
vi.mock('@/lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { useLogout } from './useLogout';
import { ME_QUERY_KEY } from './useMe';

const apiFetchMock = vi.mocked(apiFetch);
const navigateMock = vi.mocked(hardNavigate);

describe('useLogout', () => {
  let client: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('POST /auth/logout(재시도 없음) → 캐시 비우고 /login 으로 전체 이동', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);
    client.setQueryData(ME_QUERY_KEY, { id: 1 });

    const { result } = renderHook(() => useLogout(), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login'));
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST', retryOn401: false });
    expect(client.getQueryData(ME_QUERY_KEY)).toBeUndefined();
  });

  it('logout 요청이 실패해도 /login 으로 이동한다(쿠키가 남았으면 proxy 가 다시 돌려보낸다)', async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useLogout(), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login'));
  });
});
