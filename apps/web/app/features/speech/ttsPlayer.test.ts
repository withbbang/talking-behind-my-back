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

  it('stop(): 재생 중단 + 남은 덩어리 합성 안 함(선합성 1개 제외), play 는 resolve(reject 아님)', async () => {
    const { audio, player, synthesize } = setup();
    const result = vi.fn();
    const three = ['x'.repeat(999), 'y'.repeat(999), 'z'.repeat(999)].map((c) => `${c}.`).join(' ');
    void player.play(three).then(() => result('resolved'), () => result('rejected'));
    await tick();
    player.stop();
    await tick();
    await tick();
    expect(audio.pause).toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledTimes(2); // 첫 덩어리 + 선합성 1개, 세 번째는 안 부른다
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

  describe('open() 세션 — 스트리밍 문장 선재생 큐 (D-033 B4)', () => {
    it('enqueue 한 순서대로 이어 재생하고, 다음 덩어리는 재생 중에 미리 합성한다; end() 뒤 큐가 비면 done', async () => {
      const { audio, player, synthesize } = setup();
      const session = player.open();
      const done = vi.fn();
      void session.done.then(done);
      session.enqueue('하나.');
      await tick();
      expect(synthesize).toHaveBeenNthCalledWith(1, '하나.');
      expect(audio.play).toHaveBeenCalledTimes(1);
      session.enqueue('둘.');
      await tick();
      expect(synthesize).toHaveBeenNthCalledWith(2, '둘.'); // 첫 덩어리가 끝나기 전에 선합성
      expect(audio.play).toHaveBeenCalledTimes(1);
      audio.end();
      await tick();
      expect(audio.play).toHaveBeenCalledTimes(2);
      audio.end();
      await tick();
      expect(done).not.toHaveBeenCalled(); // 아직 end() 전 — 더 올 수 있다
      session.end();
      await tick();
      expect(done).toHaveBeenCalled();
    });

    it('선합성은 1개까지 — 재생 중인 것 + 준비된 것 1개 이상 앞서 부르지 않는다', async () => {
      const { audio, player, synthesize } = setup();
      const session = player.open();
      ['하나.', '둘.', '셋.', '넷.'].forEach((t) => session.enqueue(t));
      session.end();
      await tick();
      await tick();
      expect(synthesize).toHaveBeenCalledTimes(2);
      audio.end();
      await tick();
      await tick();
      expect(synthesize).toHaveBeenCalledTimes(3);
    });

    it('end() 만 부르고 아무것도 넣지 않으면 바로 done', async () => {
      const { player, synthesize } = setup();
      const session = player.open();
      session.end();
      await session.done;
      expect(synthesize).not.toHaveBeenCalled();
    });

    it('played: 첫 오디오가 시작되기 전 false, 시작되면 true', async () => {
      const { player } = setup();
      const session = player.open();
      expect(session.played).toBe(false);
      session.enqueue('하나.');
      await tick();
      expect(session.played).toBe(true);
    });

    it('첫 오디오 전에 합성이 실패하면 done reject, played=false (전체 텍스트 폴백 판단용)', async () => {
      const { player, deps } = setup();
      (deps.synthesize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('502'));
      const session = player.open();
      session.enqueue('하나.');
      await expect(session.done).rejects.toThrow('502');
      expect(session.played).toBe(false);
    });

    it('재생이 시작된 뒤 실패하면 done reject, played=true', async () => {
      const { audio, player, deps } = setup();
      const session = player.open();
      session.enqueue('하나.');
      await tick();
      (deps.synthesize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('502'));
      session.enqueue('둘.');
      audio.end();
      await expect(session.done).rejects.toThrow('502');
      expect(session.played).toBe(true);
    });

    it('stop() 은 세션을 중단하고 done 을 resolve, 이후 enqueue 는 무시', async () => {
      const { audio, player, synthesize } = setup();
      const session = player.open();
      session.enqueue('하나.');
      await tick();
      player.stop();
      await session.done;
      session.enqueue('둘.');
      await tick();
      expect(audio.pause).toHaveBeenCalled();
      expect(synthesize).toHaveBeenCalledTimes(1);
    });

    it('새 open() 은 진행 중인 세션을 멈춘다(동시 재생 1개)', async () => {
      const { player } = setup();
      const first = player.open();
      first.enqueue('하나.');
      await tick();
      const second = player.open();
      await first.done;
      second.end();
      await second.done;
    });
  });
});
