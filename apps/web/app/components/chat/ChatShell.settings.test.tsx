import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/rooms/10',
  useParams: () => ({ id: '10' }),
}));
vi.mock('@/lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { ChatShell } from './ChatShell';
import { roomDetail, roomItem } from '@/features/rooms/testFixtures';
import type { Room } from '@/features/rooms/types';

const apiFetchMock = vi.mocked(apiFetch);
const ME = { id: 2, nickname: '빵선이', profileImageUrl: null, role: 'USER', status: 'ACTIVE', provider: 'KAKAO' };

/**
 * 프로필 메뉴 → "설정" 경로를 **실제 Sidebar 로** 통합 검증 (T-032 실측: "참여자는 설정 모달이 켜지지 않음").
 * ChatShell.test.tsx 는 Sidebar 를 스텁으로 갈아끼워 이 경로가 검증되지 않았다.
 */
function mockApi(room: Room | null, me: unknown = ME) {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      if (me === null) throw new Error('me failed');
      return me;
    }
    if (path.startsWith('/rooms?')) return { items: [roomItem(10)], nextCursor: null };
    if (path === '/rooms/10') {
      if (room === null) throw new Error('room detail failed');
      return room;
    }
    throw new Error(`unexpected ${path}`);
  });
}

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

async function openSettings(nickname: string) {
  const profile = await screen.findByRole('button', { name: new RegExp(nickname) });
  fireEvent.click(profile);
  fireEvent.click(screen.getByRole('menuitem', { name: '설정' }));
}

const participantRoom = roomDetail(10, {
  role: 'PARTICIPANT',
  memberCount: 2,
  inviteCode: null,
  inviteUrl: null,
  members: [
    { userId: 1, nickname: '상남자', role: 'OWNER' },
    { userId: 2, nickname: '빵선이', role: 'PARTICIPANT' },
  ],
});

describe('ChatShell 설정 진입 (실제 Sidebar)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('참여자도 프로필 메뉴 "설정" 으로 설정 시트를 연다 — 모드·AI 성격 없이', async () => {
    mockApi(participantRoom);
    renderShell();

    await openSettings('빵선이');

    const sheet = await screen.findByRole('dialog', { name: '설정' });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: '모드' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'AI 성격' })).toBeNull();
  });

  it('개설자는 모드·AI 성격까지 본다', async () => {
    mockApi(roomDetail(10, { role: 'OWNER', memberCount: 2, members: participantRoom.members }));
    renderShell();

    await openSettings('빵선이');

    expect(await screen.findByRole('dialog', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '모드' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'AI 성격' })).toBeInTheDocument();
  });

  it('방 상세 조회가 실패해도 설정 시트는 열린다(테마만)', async () => {
    mockApi(null);
    renderShell();

    await openSettings('빵선이');

    expect(await screen.findByRole('dialog', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '테마 선택' })).toBeInTheDocument();
  });

  it('Safari: 클릭이 포커스를 안 옮겨도(relatedTarget null) 메뉴가 안 닫히고 설정이 열린다 (T-032 실측)', async () => {
    mockApi(participantRoom);
    renderShell();
    const profile = await screen.findByRole('button', { name: /빵선이/ });
    fireEvent.click(profile);

    // macOS Safari 는 버튼 클릭 시 포커스를 옮기지 않아 focusout 의 relatedTarget 이 null 로 온다.
    // 그때 메뉴를 닫으면 click 이 사라진 항목에 떨어져 "아무 반응 없음" 이 된다.
    fireEvent.blur(screen.getByRole('menu', { name: '계정' }), { relatedTarget: null });

    expect(screen.getByRole('menuitem', { name: '설정' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '설정' }));
    expect(await screen.findByRole('dialog', { name: '설정' })).toBeInTheDocument();
  });

  it('/auth/me 가 실패하면 프로필 버튼이 없어 설정으로 갈 길이 사라진다 (회귀 감시)', async () => {
    mockApi(participantRoom, null);
    renderShell();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/auth/me'));
    expect(screen.queryByRole('button', { name: /빵선이/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: '설정' })).toBeNull();
  });
});
