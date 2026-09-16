import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
let pathname = '/';
let params: Record<string, string> = {};
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => pathname,
  useParams: () => params,
}));
vi.mock('./Sidebar', () => ({ Sidebar: () => <nav aria-label="방 목록">sidebar</nav> }));

import { apiFetch } from '@/lib/api';
import { ChatShell } from './ChatShell';
import { roomDetail } from '@/features/rooms/testFixtures';

const apiFetchMock = vi.mocked(apiFetch);

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(
    <ChatShell>
      <p>본문</p>
    </ChatShell>,
    { wrapper },
  );
}

describe('ChatShell (DESIGN.md#2 채팅 셸)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    pathname = '/';
    params = {};
  });

  it('본문 + 사이드바(데스크톱 고정) + 상단 바 메뉴 버튼', () => {
    renderShell();
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '방 목록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument();
  });

  it('메뉴 버튼 → 드로어(dialog) 열림, 닫기 버튼으로 닫힘', () => {
    renderShell();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    const drawer = screen.getByRole('dialog', { name: '방 목록' });
    expect(drawer).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('경로가 바뀌면 드로어가 닫힌다', () => {
    const { rerender } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    pathname = '/rooms/1';
    rerender(
      <ChatShell>
        <p>본문</p>
      </ChatShell>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('방 안이면 상단 바에 방 제목', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10, { title: '오늘 뭐 먹지' }));
    renderShell();
    expect(await screen.findByRole('heading', { name: '오늘 뭐 먹지' })).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10');
  });

  it('방 안에서 제목 탭 → 방 헤더 시트', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10, { title: '오늘 뭐 먹지' }));
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: '오늘 뭐 먹지' }));
    expect(screen.getByRole('dialog', { name: '방 정보' })).toBeInTheDocument();
  });

  it('방 밖이면 제목 자리에 앱 이름', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: '뒷담 친구' })).toBeInTheDocument();
  });
});
