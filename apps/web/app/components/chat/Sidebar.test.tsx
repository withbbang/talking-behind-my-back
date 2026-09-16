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
let pathname = '/';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => pathname }));
vi.mock('@/lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { roomDetail, roomItem } from '@/features/rooms/testFixtures';

const apiFetchMock = vi.mocked(apiFetch);
const me = { id: 1, nickname: '영선', profileImageUrl: null, role: 'USER', status: 'ACTIVE', provider: 'KAKAO' };

function mockApi(rooms: ReturnType<typeof roomItem>[]) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/auth/me') return me;
    if (path.startsWith('/rooms?')) return { items: rooms, nextCursor: null };
    if (path === '/rooms' && init?.method === 'POST') return roomDetail(99);
    if (path === '/rooms/1' && init?.method === 'PATCH') return roomDetail(1, { title: '새 제목' });
    if (path === '/rooms/1' && init?.method === 'DELETE') return undefined;
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${path}`);
  });
}

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<Sidebar />, { wrapper });
}

describe('Sidebar (DESIGN.md#2)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    push.mockReset();
    replace.mockReset();
    pathname = '/';
  });

  it('로딩 중 스켈레톤 → 목록 + 프로필 + 로그아웃', async () => {
    mockApi([roomItem(1, { title: '오늘 뭐 먹지' }), roomItem(2)]);
    renderSidebar();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /오늘 뭐 먹지/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '방 목록' })).toBeInTheDocument();
    expect(await screen.findByText('영선')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('하단에 테마 선택 필 토글(시스템 | 라이트 | 다크) — T-020', async () => {
    mockApi([]);
    renderSidebar();
    expect(await screen.findByText('영선')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: '테마 선택' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('화면')).not.toBeInTheDocument();
  });

  it('방이 없으면 빈 상태 문구', async () => {
    mockApi([]);
    renderSidebar();
    expect(await screen.findByText('아직 방이 없네? 하나 파자.')).toBeInTheDocument();
  });

  it('"+ 새 방" → POST /rooms → /rooms/{id} 이동', async () => {
    mockApi([]);
    renderSidebar();
    fireEvent.click(await screen.findByRole('button', { name: '+ 새 방' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/rooms/99'));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms', { method: 'POST' });
  });

  it('현재 경로의 방이 활성', async () => {
    pathname = '/rooms/2';
    mockApi([roomItem(1), roomItem(2)]);
    renderSidebar();
    expect(await screen.findByRole('link', { name: /방 2/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /방 1/ })).not.toHaveAttribute('aria-current');
  });

  it('제목 수정 → PATCH', async () => {
    mockApi([roomItem(1)]);
    renderSidebar();
    await screen.findByRole('link', { name: /방 1/ });
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '제목 수정' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '새 제목' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/1', { method: 'PATCH', body: { title: '새 제목' } }));
  });

  it('지금 보고 있는 방을 나가기 → DELETE → / 로 replace', async () => {
    pathname = '/rooms/1';
    mockApi([roomItem(1)]);
    renderSidebar();
    await screen.findByRole('link', { name: /방 1/ });
    fireEvent.click(screen.getByRole('button', { name: '방 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '나가기' }));
    fireEvent.click(screen.getByRole('button', { name: '나갈래' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/1', { method: 'DELETE' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('보고 있지 않은 다른 방을 목록에서 나가기 → DELETE 만, 이동하지 않는다', async () => {
    pathname = '/rooms/2';
    mockApi([roomItem(1), roomItem(2)]);
    renderSidebar();
    await screen.findByRole('link', { name: /방 1/ });
    fireEvent.click(screen.getAllByRole('button', { name: '방 메뉴' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: '나가기' }));
    fireEvent.click(screen.getByRole('button', { name: '나갈래' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/1', { method: 'DELETE' }));
    expect(replace).not.toHaveBeenCalled();
  });
});
