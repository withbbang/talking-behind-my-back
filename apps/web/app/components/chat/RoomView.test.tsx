import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from '@/lib/api';
import { RoomView } from './RoomView';
import { roomDetail } from '@/features/rooms/testFixtures';

const apiFetchMock = vi.mocked(apiFetch);

function renderIt(id = 10) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<RoomView roomId={id} />, { wrapper });
}

describe('RoomView (T-008 커밋 1 골격 — 메시지 목록은 커밋 3)', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('메시지 0 이면 빈 방 상태: 하트 64 + "오늘은 누가 그랬어?"', async () => {
    apiFetchMock.mockResolvedValueOnce(roomDetail(10, { messageCount: 0 }));
    renderIt();
    expect(await screen.findByText('오늘은 누가 그랬어?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI' })).toHaveStyle({ width: '64px' });
  });

  it('404 면 "그런 방 없는데?" 안내', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, 'ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.'));
    renderIt();
    expect(await screen.findByText('그런 방 없는데?')).toBeInTheDocument();
  });
});
