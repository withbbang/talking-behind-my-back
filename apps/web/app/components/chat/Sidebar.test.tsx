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
    expect(screen.getByRole('button', { name: '영선 메뉴' })).toBeInTheDocument();
  });

  it('하단 우측 프로필 버튼 → 메뉴 "설정" · "로그아웃" (D-035 2). 톱니·테마 필·상시 로그아웃 없음', async () => {
    mockApi([]);
    const onOpenSettings = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Sidebar onOpenSettings={onOpenSettings} />
      </QueryClientProvider>,
    );
    const profile = await screen.findByRole('button', { name: '영선 메뉴' });
    expect(profile).toHaveAttribute('aria-haspopup', 'menu');
    expect(profile.parentElement?.className).toMatch(/justify-end/);
    expect(screen.queryByRole('radiogroup', { name: '테마 선택' })).toBeNull();
    expect(screen.queryByRole('button', { name: '설정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();

    fireEvent.click(profile);
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toEqual(['설정', '로그아웃']);
    expect(screen.getByRole('menuitem', { name: '설정' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: '설정' }));
    expect(onOpenSettings).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('프로필 메뉴는 바깥 클릭·Escape 로 닫힌다; onOpenSettings 없으면 "로그아웃"만', async () => {
    mockApi([]);
    renderSidebar();
    const profile = await screen.findByRole('button', { name: '영선 메뉴' });
    fireEvent.click(profile);
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['로그아웃']);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(profile);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(profile).toHaveFocus();
  });

  it('메뉴 "로그아웃" → 로그아웃 요청', async () => {
    mockApi([]);
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/auth/me') return me;
      if (path.startsWith('/rooms?')) return { items: [], nextCursor: null };
      if (path === '/auth/logout') return undefined;
      throw new Error(`unexpected ${init?.method ?? 'GET'} ${path}`);
    });
    renderSidebar();
    fireEvent.click(await screen.findByRole('button', { name: '영선 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST' })));
  });

  it('방이 없으면 빈 상태 문구', async () => {
    mockApi([]);
    renderSidebar();
    expect(await screen.findByText('아직 방이 없네? 하나 만들자!')).toBeInTheDocument();
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
