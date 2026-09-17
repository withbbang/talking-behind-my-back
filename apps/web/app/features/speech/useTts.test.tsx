import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { useToastStore } from '@/components/ui/Toast';
import { useTtsStore } from './useTts';
import { fakePlayer } from './testFixtures';

describe('useTtsStore (동시 재생 1개, 듣기 토글 상태)', () => {
  let player: ReturnType<typeof fakePlayer>;
  beforeEach(() => {
    player = fakePlayer();
    useTtsStore.setState({ playingId: null, player });
    useToastStore.setState({ toast: null });
  });

  it('play(id, text): playingId 설정 + 재생, 끝나면 null', async () => {
    act(() => useTtsStore.getState().play(7, '안녕'));
    expect(useTtsStore.getState().playingId).toBe(7);
    expect(player.play).toHaveBeenCalledWith('안녕');
    await act(async () => {
      player.resolvePlay();
    });
    expect(useTtsStore.getState().playingId).toBeNull();
  });

  it('다른 id 를 play 하면 새 id 로 바뀌고, 먼저 것이 끝나도 새 id 는 유지', async () => {
    act(() => useTtsStore.getState().play(7, '하나'));
    const first = player.play.mock.results[0].value as Promise<void>;
    act(() => useTtsStore.getState().play(8, '둘'));
    expect(useTtsStore.getState().playingId).toBe(8);
    await act(async () => {
      await first;
    });
    expect(useTtsStore.getState().playingId).toBe(8);
  });

  it('stop(): 재생기 정지 + playingId null', () => {
    act(() => useTtsStore.getState().play(7, '안녕'));
    act(() => useTtsStore.getState().stop());
    expect(player.stop).toHaveBeenCalled();
    expect(useTtsStore.getState().playingId).toBeNull();
  });

  it('실패하면 공용 오류 토스트 + null', async () => {
    act(() => useTtsStore.getState().play(7, '안녕'));
    await act(async () => {
      player.rejectPlay();
    });
    expect(useTtsStore.getState().playingId).toBeNull();
    expect(useToastStore.getState().toast).toMatchObject({ message: '시스템 오류. 다시 시도해줄래?', tone: 'error' });
  });
});
