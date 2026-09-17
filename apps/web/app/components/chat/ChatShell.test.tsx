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
import { useVoiceStore } from '@/features/speech/voiceStore';
import { useTtsStore } from '@/features/speech/useTts';
import { fakePlayer } from '@/features/speech/testFixtures';

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

  it('방 헤더 시트의 "초대" → 초대 공유 시트로 전환 (T-018)', async () => {
    params = { id: '10' };
    pathname = '/rooms/10';
    apiFetchMock.mockResolvedValue(roomDetail(10, { title: '오늘 뭐 먹지' }));
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: '오늘 뭐 먹지' }));
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(screen.getByRole('dialog', { name: '친구 데려오기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '방 정보' })).toBeNull();
    expect(screen.getByText('K7Q2 M9XW')).toBeInTheDocument();
  });

  it('방 밖이면 제목 자리에 앱 이름', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: '뒷담 친구' })).toBeInTheDocument();
  });
});

describe('ChatShell 보이스 토글 (T-010, D-029 노출 조건)', () => {
  beforeEach(() => {
    useVoiceStore.setState({ roomId: null });
    useTtsStore.setState({ playingId: null, player: fakePlayer() });
  });

  it('AI 모드 ACTIVE 방: 상단 바 우측 "음성" 토글, 탭하면 열림(aria-pressed) + 재생기 unlock, 다시 탭하면 닫힘', async () => {
    pathname = '/rooms/10';
    params = { id: '10' };
    apiFetchMock.mockResolvedValue(roomDetail(10, { mode: 'AI', status: 'ACTIVE' }));
    renderShell();
    const toggle = await screen.findByRole('button', { name: '음성' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(useVoiceStore.getState().roomId).toBe(10);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(useTtsStore.getState().player.unlock).toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(useVoiceStore.getState().roomId).toBeNull();
  });

  it('HUMAN 모드·ORPHANED·방 밖에서는 토글 없음', async () => {
    pathname = '/rooms/10';
    params = { id: '10' };
    apiFetchMock.mockResolvedValue(roomDetail(10, { mode: 'HUMAN' }));
    const { unmount } = renderShell();
    expect(await screen.findByText(roomDetail(10).title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
    unmount();
    apiFetchMock.mockResolvedValue(roomDetail(10, { status: 'ORPHANED' }));
    const r2 = renderShell();
    expect(await screen.findByText(roomDetail(10).title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
    r2.unmount();
    pathname = '/';
    params = {};
    renderShell();
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
  });
});
