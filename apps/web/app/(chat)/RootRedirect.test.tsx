import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

import { apiFetch } from '@/lib/api';
import { RootRedirect } from './RootRedirect';
import { roomDetail, roomItem } from '@/features/rooms/testFixtures';

const apiFetchMock = vi.mocked(apiFetch);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<RootRedirect />, { wrapper });
}

describe('RootRedirect (/ 동작, D-020)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    push.mockReset();
    replace.mockReset();
  });

  it('방이 있으면 첫 항목(최신)으로 replace', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [roomItem(7), roomItem(3)], nextCursor: null });
    renderIt();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rooms/7'));
  });

  it('방이 없으면 빈 상태 + "+ 새 방" 이 POST 후 이동', async () => {
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/rooms' && init?.method === 'POST') return roomDetail(99);
      return { items: [], nextCursor: null };
    });
    renderIt();
    expect(await screen.findByText('아직 방이 없네? 하나 만들자!')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '+ 새 방' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/rooms/99'));
  });

  it('로딩 중엔 상태 표시만', () => {
    apiFetchMock.mockReturnValueOnce(new Promise(() => {}));
    renderIt();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('아직 방이 없네? 하나 만들자!')).toBeNull();
  });
});
