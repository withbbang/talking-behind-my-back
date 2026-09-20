import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OfflinePage from './page';

// 오프라인 셸 (T-014, D-039 3). SW 가 navigation 실패 시 이 페이지를 폴백으로 내준다.
describe('/~offline', () => {
  it('"연결 없음" 제목과 안내 문구', () => {
    render(<OfflinePage />);
    expect(screen.getByRole('heading', { name: '연결 없음' })).toBeInTheDocument();
    expect(screen.getByText('인터넷이 안 되는 것 같아. 다시 연결되면 이어서 하자.')).toBeInTheDocument();
  });

  it('"다시 시도" 버튼은 새로고침한다', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<OfflinePage />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
