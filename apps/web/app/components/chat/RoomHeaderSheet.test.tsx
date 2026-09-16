import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { RoomHeaderSheet } from './RoomHeaderSheet';
import { roomDetail } from '@/features/rooms/testFixtures';
import type { Room } from '@/features/rooms/types';

const apiFetchMock = vi.mocked(apiFetch);

const two = (over: Partial<Room> = {}) =>
  roomDetail(10, {
    memberCount: 2,
    members: [
      { userId: 1, nickname: '영선', role: 'OWNER' },
      { userId: 2, nickname: '영희', role: 'PARTICIPANT' },
    ],
    ...over,
  });

function renderSheet(room: Room, extra: Partial<Parameters<typeof RoomHeaderSheet>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['rooms', room.id], room);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<RoomHeaderSheet room={room} open onClose={() => {}} {...extra} />, { wrapper });
}

describe('RoomHeaderSheet (DESIGN.md#3 방 헤더 시트)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useToastStore.setState({ toast: null });
  });

  it('멤버 2명 아바타, 모드 토글 활성', () => {
    renderSheet(two());
    expect(screen.getByRole('img', { name: '영선' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '영희' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '모드' })).not.toHaveAttribute('aria-disabled');
  });

  it('혼자면 빈 자리 + 토글 비활성 + "둘이 되면 켜져"; 개설자에 onInvite 있으면 초대 버튼', () => {
    const onInvite = vi.fn();
    renderSheet(roomDetail(10), { onInvite });
    expect(screen.getByRole('radiogroup', { name: '모드' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('둘이 되면 켜져')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('참여자는 초대 버튼 없음', () => {
    renderSheet(roomDetail(10, { role: 'PARTICIPANT' }), { onInvite: vi.fn() });
    expect(screen.queryByRole('button', { name: '초대' })).toBeNull();
  });

  it('모드 변경 → PATCH mode', async () => {
    apiFetchMock.mockResolvedValueOnce(two({ mode: 'HUMAN' }));
    renderSheet(two());
    fireEvent.click(screen.getByRole('radio', { name: '유저끼리' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { mode: 'HUMAN' } }));
  });

  it('모드 변경 실패 → 토스트 + 되돌림', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, 'MODE_NOT_ALLOWED', '혼자서는 안 돼요.'));
    renderSheet(two());
    fireEvent.click(screen.getByRole('radio', { name: '유저끼리' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('혼자서는 안 돼요.'));
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('aria-checked', 'true');
  });

  it('개설자: 프리셋 선택 → PATCH aiPersonality, 직접 쓰기 blur → PATCH aiPrompt, 되돌리기 → aiPrompt ""', async () => {
    apiFetchMock.mockResolvedValue(two({ aiPrompt: '내 편만' }));
    renderSheet(two());
    fireEvent.click(screen.getByRole('radio', { name: '공감형' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPersonality: 'EMOTIONAL' } }));

    fireEvent.click(screen.getByRole('button', { name: '직접 쓰기' }));
    const ta = screen.getByRole('textbox', { name: '직접 쓰기' });
    fireEvent.change(ta, { target: { value: '내 편만' } });
    fireEvent.blur(ta);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPrompt: '내 편만' } }));
  });

  it('되돌리기 → PATCH aiPrompt ""', async () => {
    apiFetchMock.mockResolvedValue(two());
    renderSheet(two({ aiPrompt: '내 편만' }));
    fireEvent.click(screen.getByRole('button', { name: '프리셋으로 되돌리기' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPrompt: '' } }));
  });

  it('개설자: 제목 탭 → 입력 → Enter → PATCH title', async () => {
    apiFetchMock.mockResolvedValueOnce(two({ title: '새 제목' }));
    renderSheet(two({ title: '옛 제목' }));
    fireEvent.click(screen.getByRole('button', { name: '제목 수정: 옛 제목' }));
    const input = screen.getByRole('textbox', { name: '방 제목' });
    fireEvent.change(input, { target: { value: '새 제목' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { title: '새 제목' } }));
  });

  it('참여자: 제목은 버튼 아님, 성격 토글 비활성', () => {
    renderSheet(two({ role: 'PARTICIPANT' }));
    expect(screen.queryByRole('button', { name: /제목 수정/ })).toBeNull();
    expect(screen.getByRole('heading', { name: '방 10' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'AI 성격' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('토스트 스토어에 오류 메시지가 남으면 act 경고 없이 정리', () => {
    act(() => useToastStore.getState().clear());
    expect(useToastStore.getState().toast).toBeNull();
  });
});
