import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { roomKey } from '@/features/rooms/useRooms';
import { roomDetail } from '@/features/rooms/testFixtures';
import type { Room } from '@/features/rooms/types';
import { InviteSheet } from './InviteSheet';

const apiFetchMock = vi.mocked(apiFetch);
const writeText = vi.fn().mockResolvedValue(undefined);
let client: QueryClient;

function renderIt(room: Room = roomDetail(10), onClose = vi.fn()) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(roomKey(room.id), room);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<InviteSheet room={room} open onClose={onClose} />, { wrapper });
}

describe('InviteSheet (DESIGN.md#4 초대 공유 시트)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    writeText.mockClear();
    useToastStore.setState({ toast: null });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
  });

  it('제목 + QR + 코드 4+4 표시 + 링크 복사 + 코드 다시 만들기', () => {
    renderIt();
    expect(screen.getByRole('dialog', { name: '친구 데려오기' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '초대 QR' })).toBeInTheDocument();
    expect(screen.getByText('K7Q2 M9XW')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '코드 다시 만들기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '공유하기' })).toBeNull();
  });

  it('코드 복사 → 8자 연속으로 클립보드 + 토스트', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: '코드 복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7Q2M9XW'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('복사 완료'));
  });

  it('링크 복사 → inviteUrl 클립보드 + 토스트', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost:3000/join/K7Q2M9XW'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('복사 완료'));
  });

  it('navigator.share 가 있으면 "공유하기" → share({title, url})', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderIt(roomDetail(10, { title: '팀장 얘기' }));
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: '팀장 얘기', url: 'http://localhost:3000/join/K7Q2M9XW' }));
  });

  it('코드 다시 만들기 → 확인 모달 → POST regenerate → 새 코드 표시', async () => {
    apiFetchMock.mockResolvedValueOnce({ inviteCode: 'NEWC0DE7', inviteUrl: 'http://localhost:3000/join/NEWC0DE7' });
    const { rerender } = renderIt();
    fireEvent.click(screen.getByRole('button', { name: '코드 다시 만들기' }));
    expect(screen.getByText('이전 코드는 사용할 수 없어. 새로 만들까?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '새로 만들기' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10/invite/regenerate', { method: 'POST' }));
    // 시트는 부모(ChatShell)가 캐시의 room 을 넘기므로 캐시 갱신 후 다시 그린다
    const updated = client.getQueryData<Room>(roomKey(10))!;
    expect(updated.inviteCode).toBe('NEWC0DE7');
    rerender(
      <QueryClientProvider client={client}>
        <InviteSheet room={updated} open onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('NEWC 0DE7')).toBeInTheDocument();
    expect(screen.queryByText('이전 코드는 사용할 수 없어. 새로 만들까?')).toBeNull();
  });

  it('확인 모달에서 취소하면 요청 없음', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: '코드 다시 만들기' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('이전 코드는 사용할 수 없어. 새로 만들까?')).toBeNull();
  });
});
