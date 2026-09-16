import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => '/rooms/10' }));

import { ApiError, apiFetch } from '@/lib/api';
import { RoomView } from './RoomView';
import { useToastStore } from '@/components/ui/Toast';
import { useStreamStore } from '@/features/messages/streamStore';
import { roomDetail } from '@/features/rooms/testFixtures';
import { aiMsg, userMsg } from '@/features/messages/testFixtures';

const me = { id: 1, nickname: '영선', profileImageUrl: null, role: 'USER', status: 'ACTIVE', provider: 'KAKAO' };
function mockApi(room: unknown, messages: unknown[] = [], onSend?: () => unknown) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/rooms/10/messages' && init?.method === 'POST') return onSend ? onSend() : { messageId: 101 };
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
    replace.mockReset();
    useToastStore.setState({ toast: null });
    useStreamStore.setState({ rooms: {} });
  });

  it('메시지 0 이면 빈 방 상태: 하트 64 + "오늘은 누가 그랬어?"', async () => {
    mockApi(roomDetail(10, { messageCount: 0 }));
    renderIt();
    expect(await screen.findByText('오늘은 누가 그랬어?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI' })).toHaveStyle({ width: '64px' });
  });

  it('메시지 0 이라도 시스템 라인이 있으면 빈 상태 대신 라인을 보인다 (T-024)', async () => {
    mockApi(roomDetail(10, { messageCount: 0, memberCount: 2 }));
    useStreamStore.setState({ rooms: { 10: { streams: {}, notices: [{ id: 'n1', text: '영희 등장!', createdAt: '2026-09-16T00:00:00Z' }] } } });
    renderIt();
    expect(await screen.findByText('영희 등장!')).toBeInTheDocument();
    expect(screen.queryByText('오늘은 누가 그랬어?')).toBeNull();
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

  it('입력창: 전송 → POST + 낙관 말풍선 + 내 잡 잠금', async () => {
    mockApi(roomDetail(10, { messageCount: 0 }));
    renderIt();
    const box = await screen.findByRole('textbox', { name: '메시지' });
    fireEvent.change(box, { target: { value: '그 사람이 또' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    // 임시 id → 202 messageId 로 교체되며 말풍선이 다시 마운트되므로 재조회로 단언
    await waitFor(() => expect(screen.getByText('그 사람이 또')).toBeInTheDocument());
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10/messages', { method: 'POST', body: { content: '그 사람이 또', inputType: 'TEXT' } }));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeDisabled());
    expect(screen.getByTestId('typing-dots')).toBeInTheDocument();
  });

  it('409 → 토스트 "아직 답 쓰는 중. 좀만 기다려" + 낙관 말풍선 제거', async () => {
    mockApi(roomDetail(10), [], () => {
      throw new ApiError(409, 'ROOM_BUSY', '이미 처리 중');
    });
    renderIt();
    const box = await screen.findByRole('textbox', { name: '메시지' });
    fireEvent.change(box, { target: { value: '한 번 더' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('아직 답 쓰는 중. 좀만 기다려'));
    await waitFor(() => expect(screen.queryByText('한 번 더')).toBeNull());
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  it('ORPHANED 방은 입력 잠김', async () => {
    mockApi(roomDetail(10, { role: 'PARTICIPANT', status: 'ORPHANED', messageCount: 1 }), [userMsg(1)]);
    renderIt();
    expect(await screen.findByRole('textbox')).toHaveAttribute('placeholder', '주인이 도망간 방이야');
  });

  it('참여자 + ORPHANED → "이용할 수 없는 채팅방입니다." 모달, "알았어" → DELETE → / (D-021)', async () => {
    mockApi(roomDetail(10, { role: 'PARTICIPANT', status: 'ORPHANED', messageCount: 1 }), [userMsg(1)]);
    renderIt();
    const dialog = await screen.findByRole('dialog', { name: '이용할 수 없는 채팅방입니다.' });
    expect(dialog).toHaveTextContent('주인이 도망갔어. 이 방은 여기까지.');
    expect(screen.queryByRole('button', { name: '취소' })).toBeNull();

    // DELETE 는 마지막 호출 — mockApi 구현을 덮어 DELETE 도 받게 한다
    apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === '/rooms/10' && init?.method === 'DELETE') return undefined;
      if (path === '/auth/me') return me;
      throw new Error(`unexpected ${path}`);
    });
    fireEvent.click(screen.getByRole('button', { name: '알았어' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'DELETE' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('전송 410 → 토스트 없이 캐시 status ORPHANED → 모달 (D-021 단일 트리거)', async () => {
    mockApi(roomDetail(10, { role: 'PARTICIPANT', memberCount: 2, messageCount: 0 }), [], () => {
      throw new ApiError(410, 'ROOM_ORPHANED', '이탈');
    });
    renderIt();
    const box = await screen.findByRole('textbox', { name: '메시지' });
    fireEvent.change(box, { target: { value: '아직 있어?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: '이용할 수 없는 채팅방입니다.' })).toBeInTheDocument();
    expect(useToastStore.getState().toast).toBeNull();
    expect(screen.queryByText('아직 있어?')).toBeNull();
  });

  it('개설자 화면에는 ORPHANED 모달이 뜨지 않는다', async () => {
    mockApi(roomDetail(10, { role: 'OWNER', status: 'ORPHANED', messageCount: 0 }));
    renderIt();
    expect(await screen.findByText('오늘은 누가 그랬어?')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('토스트 정리', () => {
    act(() => useToastStore.getState().clear());
  });
});
