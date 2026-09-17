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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => '/join/K7Q2M9XW' }));

import { ApiError, apiFetch } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { roomDetail } from '@/features/rooms/testFixtures';
import type { JoinPreview } from '@/features/rooms/types';
import { JoinClient } from './JoinClient';

const apiFetchMock = vi.mocked(apiFetch);
const preview = (over: Partial<JoinPreview> = {}): JoinPreview => ({ roomId: 10, title: '팀장 얘기', ownerNickname: '영희', memberCount: 1, alreadyMember: false, ...over });

function mockApi(previewResult: JoinPreview | Error, joinResult: unknown = roomDetail(10, { role: 'PARTICIPANT', memberCount: 2 })) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === '/rooms/join/K7Q2M9XW' && init?.method === 'POST') {
      if (joinResult instanceof Error) throw joinResult;
      return joinResult;
    }
    if (path === '/rooms/join/K7Q2M9XW') {
      if (previewResult instanceof Error) throw previewResult;
      return previewResult;
    }
    throw new Error(`unexpected ${path}`);
  });
}

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<JoinClient code="K7Q2M9XW" />, { wrapper });
}

describe('JoinClient (DESIGN.md#5 입장)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    push.mockReset();
    replace.mockReset();
    useToastStore.setState({ toast: null });
  });

  it('제목 "초대장 도착" + 로딩 중 시트 안 스켈레톤', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    renderIt();
    expect(screen.getByRole('heading', { name: '초대장 도착' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('초대장 확인 중...');
  });

  it('미리보기: 개설자 소개 2줄 + 꼬리 아바타 + 방 제목 + 멤버 n/2 + "들어가기"', async () => {
    mockApi(preview());
    renderIt();
    expect(await screen.findByText('팀장 얘기')).toBeInTheDocument();
    expect(screen.getByText('영희의 방')).toBeInTheDocument();
    expect(screen.getByText('같이 뒷담화하자!')).toBeInTheDocument();
    expect(screen.getByText('멤버 1/2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '영희' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '들어가기' })).toBeInTheDocument();
  });

  it('이미 멤버면 버튼 "들어가기"', async () => {
    mockApi(preview({ alreadyMember: true, memberCount: 2 }));
    renderIt();
    expect(await screen.findByRole('button', { name: '들어가기' })).toBeInTheDocument();
  });

  it('입장 → POST → replace(/rooms/10)', async () => {
    mockApi(preview());
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: '들어가기' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rooms/10'));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/join/K7Q2M9XW', { method: 'POST' });
  });

  it('미리보기 실패(알려진 코드) → 시트 안 문구 + "내 방 가기" → push(/)', async () => {
    mockApi(new ApiError(409, 'ROOM_FULL', 'x'));
    renderIt();
    expect(await screen.findByText('여긴 벌써 꽉 찼어')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '내 방 가기' }));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('미리보기 실패(모르는 오류) → "시스템 오류. 다시 시도해줄래?" + "다시" 로 재조회', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('network'));
    renderIt();
    expect(await screen.findByText('시스템 오류. 다시 시도해줄래?')).toBeInTheDocument();
    mockApi(preview());
    fireEvent.click(screen.getByRole('button', { name: '다시' }));
    expect(await screen.findByRole('button', { name: '들어가기' })).toBeInTheDocument();
  });

  it('입장 단계에서 실패(알려진 코드) → 같은 오류 화면으로 전환', async () => {
    mockApi(preview(), new ApiError(409, 'ROOM_LIMIT_EXCEEDED', 'x'));
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: '들어가기' }));
    expect(await screen.findByText('방이 50개 넘었어. 정리하고 와!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내 방 가기' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('입장 단계에서 모르는 오류 → 토스트, 버튼은 유지', async () => {
    mockApi(preview(), new Error('network'));
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: '들어가기' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('시스템 오류. 다시 시도해줄래?'));
    expect(screen.getByRole('button', { name: '들어가기' })).toBeInTheDocument();
  });
});
