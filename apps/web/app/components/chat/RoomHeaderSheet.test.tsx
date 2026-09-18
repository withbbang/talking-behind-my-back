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

  it('혼자면 빈 자리 + 토글 비활성 + 토글에 "친구 초대해봐!" 툴팁(D-034 4); 개설자에 onInvite 있으면 초대 버튼', () => {
    const onInvite = vi.fn();
    renderSheet(roomDetail(10), { onInvite });
    const group = screen.getByRole('radiogroup', { name: '모드' });
    expect(group).toHaveAttribute('aria-disabled', 'true');
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('친구 초대해봐!');
    expect(group).toHaveAttribute('aria-describedby', tip.id);
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('둘이면 칸별 안내 툴팁 2개 + "친구 초대해봐!" 없음 (D-037 4)', () => {
    renderSheet(two());
    expect(screen.queryByText('친구 초대해봐!')).toBeNull();
    expect(screen.getAllByRole('tooltip').map((t) => t.textContent))
      .toEqual(['AI와 1:1, 친구는 못 봐!', '친구와 1:1, AI는 못 봐!']);
    expect(screen.getByRole('radio', { name: 'AI' }))
      .toHaveAttribute('aria-describedby', screen.getByText('AI와 1:1, 친구는 못 봐!').id);
  });

  it('혼자면 칸별 툴팁 없이 "친구 초대해봐!" 하나만 (D-037 4 현행 유지)', () => {
    renderSheet(roomDetail(10));
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.queryByText('AI와 1:1, 친구는 못 봐!')).toBeNull();
  });

  it('시트 라벨 "설정", 제목·멤버 줄 가운데 정렬, 모드 다음 줄에 "테마"(시스템/라이트/다크) — D-034 2·3·5·7', () => {
    renderSheet(two());
    expect(screen.getByRole('dialog', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '방 10' }).className).toMatch(/text-center/);
    expect(screen.getByRole('list', { name: '멤버' }).className).toMatch(/justify-center/);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['모드', '테마', 'AI 성격']);
    expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
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
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('혼자서는 유저끼리 대화할 수 없어!'));
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('aria-checked', 'true');
  });

  it('개설자: 프리셋 선택 → PATCH aiPersonality, 직접 쓰기 "저장" → PATCH aiPrompt (D-034 6)', async () => {
    apiFetchMock.mockResolvedValue(two({ aiPrompt: '내 편만' }));
    renderSheet(two());
    fireEvent.click(screen.getByRole('radio', { name: '공감형' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPersonality: 'EMOTIONAL' } }));

    fireEvent.click(screen.getByRole('button', { name: '직접 쓰기' }));
    const ta = screen.getByRole('textbox', { name: '직접 쓰기' });
    fireEvent.change(ta, { target: { value: '내 편만' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPrompt: '내 편만' } }));
  });

  it('되돌리기 → PATCH aiPrompt ""', async () => {
    apiFetchMock.mockResolvedValue(two());
    renderSheet(two({ aiPrompt: '내 편만' }));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { aiPrompt: '' } }));
  });

  it('개설자: 제목 탭 → 입력(가운데) → Enter → PATCH title', async () => {
    apiFetchMock.mockResolvedValueOnce(two({ title: '새 제목' }));
    renderSheet(two({ title: '옛 제목' }));
    fireEvent.click(screen.getByRole('button', { name: '제목 수정: 옛 제목' }));
    const input = screen.getByRole('textbox', { name: '방 제목' });
    expect(input.className).toMatch(/text-center/);
    fireEvent.change(input, { target: { value: '새 제목' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { title: '새 제목' } }));
  });

  it('모드 변경 실패(다른 코드) → 서버 메시지 대신 공용 오류 문구 (D-025)', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.'));
    renderSheet(two());
    fireEvent.click(screen.getByRole('radio', { name: '유저끼리' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('시스템 오류. 다시 시도해줄래?'));
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
