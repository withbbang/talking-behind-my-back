import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import { ME_QUERY_KEY, useMe } from './useMe';
import type { Me } from './types';

const apiFetchMock = vi.mocked(apiFetch);

const me: Me = {
  id: 1,
  nickname: '영선',
  profileImageUrl: null,
  role: 'USER',
  status: 'ACTIVE',
  provider: 'KAKAO',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMe', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('GET /auth/me 결과를 data 로 돌려준다', async () => {
    apiFetchMock.mockResolvedValueOnce(me);

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(me);
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/me');
  });

  it('401 이면 재시도 없이 error 상태', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(401, 'UNAUTHENTICATED', '인증이 필요합니다.'));

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('queryKey 는 ["me"] 로 고정', () => {
    expect(ME_QUERY_KEY).toEqual(['me']);
  });
});
