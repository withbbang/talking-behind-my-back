import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
vi.mock('./Sidebar', () => ({
  Sidebar: ({ onOpenSettings }: { onOpenSettings?: () => void }) => (
    <nav aria-label="방 목록">
      sidebar
      <button type="button" aria-label="설정" onClick={onOpenSettings} />
    </nav>
  ),
}));

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

  it('메뉴 버튼 → 드로어(dialog) 열림. 닫기 X 없음, Escape·딤 클릭으로 닫힘 (D-035 1)', () => {
    renderShell();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    const drawer = screen.getByRole('dialog', { name: '방 목록' });
    expect(drawer).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    fireEvent.click(screen.getByRole('dialog', { name: '방 목록' }).previousElementSibling as Element);
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

  it('방 안이면 제목은 평문(버튼 아님), 사이드바 "설정" → 설정 시트 (D-034 2)', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10, { title: '오늘 뭐 먹지' }));
    renderShell();
    expect(await screen.findByRole('heading', { name: '오늘 뭐 먹지' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '오늘 뭐 먹지' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '설정' })[0]);
    const sheet = screen.getByRole('dialog', { name: '설정' });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '모드' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
  });

  it('방 밖에서 "설정" → 테마만 있는 설정 시트', () => {
    renderShell();
    fireEvent.click(screen.getAllByRole('button', { name: '설정' })[0]);
    expect(screen.getByRole('dialog', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: '모드' })).toBeNull();
  });

  it('드로어의 "설정" → 드로어 닫히고 설정 시트', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10));
    renderShell();
    await screen.findByRole('heading', { name: roomDetail(10).title });
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
    const drawer = screen.getByRole('dialog', { name: '방 목록' });
    fireEvent.click(within(drawer).getByRole('button', { name: '설정' }));
    expect(screen.queryByRole('dialog', { name: '방 목록' })).toBeNull();
    expect(screen.getByRole('dialog', { name: '설정' })).toBeInTheDocument();
  });

  it('설정 시트의 "초대" → 초대 공유 시트로 전환 (T-018)', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10, { title: '오늘 뭐 먹지' }));
    renderShell();
    await screen.findByRole('heading', { name: '오늘 뭐 먹지' });
    fireEvent.click(screen.getAllByRole('button', { name: '설정' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(screen.getByRole('dialog', { name: '친구 데려오기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '설정' })).toBeNull();
    expect(screen.getByText('K7Q2 M9XW')).toBeInTheDocument();
  });

  it('방 밖이면 제목 자리에 앱 이름', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: '뒷담 친구' })).toBeInTheDocument();
  });
});

describe('ChatShell 상단 바 (D-034 1·13)', () => {
  it('상단 바에는 보이스 토글이 없다 — 컴포저로 이동', async () => {
    pathname = '/rooms/10';
    params = { id: '10' };
    apiFetchMock.mockResolvedValue(roomDetail(10, { mode: 'AI', status: 'ACTIVE' }));
    renderShell();
    await screen.findByRole('heading', { name: roomDetail(10).title });
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
  });

  it('햄버거는 상단 바 마지막(우측), 드로어는 우측에 붙는다', () => {
    renderShell();
    const header = screen.getByRole('banner');
    const buttons = within(header).getAllByRole('button');
    expect(buttons[buttons.length - 1]).toHaveAccessibleName('메뉴');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole('dialog', { name: '방 목록' }).className).toMatch(/right-0/);
  });
});
