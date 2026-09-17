import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useTtsStore } from '@/features/speech/useTts';
import { fakePlayer } from '@/features/speech/testFixtures';
import { ListenButton } from './ListenButton';

describe('ListenButton (DESIGN.md#7 듣기 버튼)', () => {
  let player: ReturnType<typeof fakePlayer>;
  beforeEach(() => {
    player = fakePlayer();
    useTtsStore.setState({ playingId: null, player });
  });

  it('"듣기" 탭 → unlock + 재생, 재생 중엔 "정지", 끝나면 다시 "듣기"', async () => {
    render(<ListenButton messageId={3} text="또? 놀랍지도 않네." />);
    fireEvent.click(screen.getByRole('button', { name: '듣기' }));
    expect(player.unlock).toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledWith('또? 놀랍지도 않네.');
    expect(screen.getByRole('button', { name: '정지' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => {
      player.resolvePlay();
    });
    expect(screen.getByRole('button', { name: '듣기' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"정지" 탭 → stop', () => {
    render(<ListenButton messageId={3} text="x" />);
    fireEvent.click(screen.getByRole('button', { name: '듣기' }));
    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    expect(player.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '듣기' })).toBeInTheDocument();
  });

  it('다른 메시지가 재생 중이면 이 버튼은 "듣기"', () => {
    useTtsStore.setState({ playingId: 99 });
    render(<ListenButton messageId={3} text="x" />);
    expect(screen.getByRole('button', { name: '듣기' })).toBeInTheDocument();
  });
});
