import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/features/auth/session', () => ({ silentRefresh: vi.fn() }));
vi.mock('@/lib/navigation', () => ({ hardNavigate: vi.fn() }));

import { silentRefresh } from '@/features/auth/session';
import { hardNavigate } from '@/lib/navigation';
import { LoginClient } from './LoginClient';

const refreshMock = vi.mocked(silentRefresh);
const navigateMock = vi.mocked(hardNavigate);

describe('LoginClient', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    navigateMock.mockReset();
  });

  it('마운트 시 silent refresh 성공 → / 로 전체 이동, 버튼은 노출하지 않는다', async () => {
    let resolve!: (v: boolean) => void;
    refreshMock.mockReturnValueOnce(new Promise<boolean>((r) => (resolve = r)));

    render(<LoginClient error={null} next={null} />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 확인 중');
    expect(screen.queryByRole('link', { name: '카카오로 시작하기' })).toBeNull();

    resolve(true);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('link', { name: '카카오로 시작하기' })).toBeNull();
  });

  it('silent refresh 실패 → 소셜 버튼 3개 노출', async () => {
    refreshMock.mockResolvedValueOnce(false);

    render(<LoginClient error={null} next={null} />);

    expect(await screen.findByRole('link', { name: '구글로 시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '네이버로 시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '카카오로 시작하기' })).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('?error= 가 있으면 silent refresh 를 건너뛰고 알림 + 버튼을 바로 보여준다', () => {
    render(<LoginClient error="access_denied" next={null} />);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('로그인을 취소했어요');
    expect(screen.getByRole('link', { name: '카카오로 시작하기' })).toBeInTheDocument();
  });

  it('next 가 있으면 silent refresh 성공 시 그 경로로 이동하고 소셜 링크에도 ?next= 를 붙인다', async () => {
    refreshMock.mockResolvedValueOnce(true);
    const { unmount } = render(<LoginClient error={null} next="/join/K7Q2M9XW" />);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/join/K7Q2M9XW'));
    unmount();

    refreshMock.mockResolvedValueOnce(false);
    render(<LoginClient error={null} next="/join/K7Q2M9XW" />);
    const kakao = await screen.findByRole('link', { name: '카카오로 시작하기' });
    expect(kakao).toHaveAttribute('href', '/api/oauth2/authorization/kakao?next=%2Fjoin%2FK7Q2M9XW');
    expect(screen.getByRole('link', { name: '구글로 시작하기' })).toHaveAttribute('href', '/api/oauth2/authorization/google?next=%2Fjoin%2FK7Q2M9XW');
  });

  it('next 가 없거나 불량이면 링크는 ?next 없이, 이동은 / 로', async () => {
    refreshMock.mockResolvedValueOnce(false);
    render(<LoginClient error="access_denied" next="https://evil.example" />);
    expect(screen.getByRole('link', { name: '카카오로 시작하기' })).toHaveAttribute('href', '/api/oauth2/authorization/kakao');
  });

  it('알 수 없는 error 코드도 공통 메시지로 알린다', () => {
    render(<LoginClient error="oauth_failed" next={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent('로그인에 실패했어요');
  });
});
