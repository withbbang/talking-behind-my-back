import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@/features/auth/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
vi.mock('@/lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { HomeClient } from './HomeClient';

const apiFetchMock = vi.mocked(apiFetch);

const me: Me = { id: 1, nickname: '영선', profileImageUrl: null, role: 'USER', status: 'ACTIVE', provider: 'NAVER' };

/** 경로별 응답. 로그아웃 뒤 캐시 clear 로 /auth/me 가 재조회돼도 undefined 가 새지 않게 한다. */
function mockApi(meResponse: Me) {
  apiFetchMock.mockImplementation(async (path) => {
    if (path === '/auth/me') return meResponse;
    if (path === '/auth/logout') return undefined;
    throw new Error(`unexpected ${path}`);
  });
}

/** 테스트마다 새 QueryClient — app/providers.tsx 의 브라우저 싱글턴은 테스트 간 캐시를 공유한다. */
function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeClient />
    </QueryClientProvider>,
  );
}

// 임시 홈(T-008 전까지): 세션 유지 확인용 닉네임 + 로그아웃 버튼.
describe('HomeClient', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('/auth/me 닉네임과 공급자를 보여준다', async () => {
    mockApi(me);

    renderHome();

    expect(await screen.findByText('영선')).toBeInTheDocument();
    expect(screen.getByText(/네이버/)).toBeInTheDocument();
  });

  it('로그아웃 버튼 → POST /auth/logout → /login 이동', async () => {
    mockApi(me);
    const user = userEvent.setup();

    renderHome();
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/login'));
    expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST', retryOn401: false });
  });

  it('정지 회원이면 안내 문구를 보여준다', async () => {
    mockApi({ ...me, status: 'SUSPENDED' });

    renderHome();

    expect(await screen.findByText(/이용이 정지된 계정/)).toBeInTheDocument();
  });
});
