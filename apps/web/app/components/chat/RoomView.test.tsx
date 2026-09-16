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
import { aiMsg, userMsg } from '@/features/messages/testFixtures';

const me = { id: 1, nickname: '영선', profileImageUrl: null, role: 'USER', status: 'ACTIVE', provider: 'KAKAO' };
function mockApi(room: unknown, messages: unknown[] = []) {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path === '/auth/me') return me;
    if (path === '/rooms/10') {
      if (room instanceof Error) throw room;
      return room;
    }
    if (path.startsWith('/rooms/10/messages')) return { items: messages, nextCursor: null };
    throw new Error(`unexpected ${path}`);
  });
}

const apiFetchMock = vi.mocked(apiFetch);

function renderIt(id = 10) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<RoomView roomId={id} />, { wrapper });
}

describe('RoomView (DESIGN.md#3)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset(); // 화살표가 mock 을 반환하면 vitest 가 cleanup 훅으로 호출한다
  });

  it('메시지 0 이면 빈 방 상태: 하트 64 + "오늘은 누가 그랬어?"', async () => {
    mockApi(roomDetail(10, { messageCount: 0 }));
    renderIt();
    expect(await screen.findByText('오늘은 누가 그랬어?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI' })).toHaveStyle({ width: '64px' });
  });

  it('404 면 "그런 방 없는데?" 안내', async () => {
    mockApi(new ApiError(404, 'ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.'));
    renderIt();
    expect(await screen.findByText('그런 방 없는데?')).toBeInTheDocument();
  });

  it('메시지가 있으면 목록(나/AI 말풍선)', async () => {
    mockApi(roomDetail(10, { messageCount: 2 }), [aiMsg(2), userMsg(1)]);
    renderIt();
    expect(await screen.findByText('메시지 1')).toBeInTheDocument();
    expect(screen.getByText('답 2')).toBeInTheDocument();
    expect(screen.queryByText('오늘은 누가 그랬어?')).toBeNull();
  });
});
