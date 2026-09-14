import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import { silentRefresh } from './session';

const apiFetchMock = vi.mocked(apiFetch);

// silentRefresh: /login 콜드 오픈 시 refresh 쿠키(Path /api/auth)로 세션 되살리기 (TASKS.md#T-005 note 2).
describe('silentRefresh', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('POST /auth/refresh 204 → true', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    await expect(silentRefresh()).resolves.toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/refresh', { method: 'POST', retryOn401: false });
  });

  it('401(refresh 없음/만료/재사용) → false, throw 하지 않는다', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(401, 'UNAUTHENTICATED', '인증이 필요합니다.'));

    await expect(silentRefresh()).resolves.toBe(false);
  });

  it('네트워크 오류도 false', async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(silentRefresh()).resolves.toBe(false);
  });
});
