import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTtsPlayer, type TtsPlayerDeps } from './ttsPlayer';

class FakeAudio extends EventTarget {
  src = '';
  play = vi.fn(async () => {});
  pause = vi.fn();
  currentTime = 0;
  end() {
    this.dispatchEvent(new Event('ended'));
  }
  fail() {
    this.dispatchEvent(new Event('error'));
  }
}

function setup(chunks: Record<string, Blob> = {}) {
  const audio = new FakeAudio();
  const synthesize = vi.fn(async (text: string) => chunks[text] ?? new Blob([text], { type: 'audio/mpeg' }));
  const urls: string[] = [];
  const deps: TtsPlayerDeps = {
    synthesize,
    createAudio: () => audio as unknown as HTMLAudioElement,
    createObjectURL: () => {
      const u = `blob:${urls.length}`;
      urls.push(u);
      return u;
    },
    revokeObjectURL: vi.fn(),
  };
  return { audio, synthesize, deps, player: createTtsPlayer(deps), revoke: deps.revokeObjectURL as ReturnType<typeof vi.fn> };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ttsPlayer (듣기·보이스 모드 재생 큐, D-029)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('한 덩어리: 합성 → src 지정 → play → ended 에 resolve, object URL 은 회수', async () => {
    const { audio, player, revoke, synthesize } = setup();
    const done = vi.fn();
    void player.play('안녕, 반가워.').then(done);
    await tick();
    expect(synthesize).toHaveBeenCalledWith('안녕, 반가워.');
    expect(audio.src).toBe('blob:0');
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    audio.end();
    await tick();
    expect(done).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:0');
  });

  it('1,000자 초과는 문장 경계로 나눠 순서대로 이어 재생한다', async () => {
    const { audio, player, synthesize } = setup();
    const done = vi.fn();
    void player.play(`${'가'.repeat(600)}. ${'나'.repeat(600)}.`).then(done);
    await tick();
    expect(synthesize).toHaveBeenNthCalledWith(1, `${'가'.repeat(600)}.`);
    audio.end();
    await tick();
    expect(synthesize).toHaveBeenNthCalledWith(2, `${'나'.repeat(600)}.`);
    expect(audio.play).toHaveBeenCalledTimes(2);
    audio.end();
    await tick();
    expect(done).toHaveBeenCalled();
  });

  it('stop(): 재생 중단 + 남은 덩어리 합성 안 함, play 는 resolve(reject 아님)', async () => {
    const { audio, player, synthesize } = setup();
    const result = vi.fn();
    void player.play('하나. 둘.'.replace('. ', `${'x'.repeat(999)}. `)).then(() => result('resolved'), () => result('rejected'));
    await tick();
    player.stop();
    await tick();
    expect(audio.pause).toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(result).toHaveBeenCalledWith('resolved');
  });

  it('합성 실패·재생 오류는 reject', async () => {
    const { audio, player, deps } = setup();
    (deps.synthesize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('502'));
    await expect(player.play('안녕')).rejects.toThrow('502');
    const p = player.play('다시');
    await tick();
    audio.fail();
    await expect(p).rejects.toThrow();
  });

  it('빈 텍스트는 아무것도 안 하고 resolve', async () => {
    const { audio, player, synthesize } = setup();
    await player.play('   ');
    expect(synthesize).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('unlock(): 사용자 제스처에서 무음 소스를 한 번 재생해 iOS 자동재생을 푼다(같은 엘리먼트 재사용)', async () => {
    const { audio, player } = setup();
    player.unlock();
    expect(audio.src.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    void player.play('안녕');
    await tick();
    expect(audio.play).toHaveBeenCalledTimes(2); // 같은 엘리먼트로 이어서 재생
    audio.end();
  });

  it('새 play 는 진행 중인 재생을 먼저 멈춘다(동시 재생 1개)', async () => {
    const { audio, player } = setup();
    const first = vi.fn();
    void player.play('첫째').then(first);
    await tick();
    void player.play('둘째');
    await tick();
    expect(audio.pause).toHaveBeenCalled();
    expect(first).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(2);
  });
});
