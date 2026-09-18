import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { RecorderError, useRecorder } from './useRecorder';
import { FakeMediaRecorder, deniedError, fakeMeter, fakeRecorderDeps, fakeStream } from './testFixtures';

const deps = fakeRecorderDeps;

describe('useRecorder (MediaRecorder, DESIGN.md#7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeMediaRecorder.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start → recording(elapsed 증가) → stop → Blob·mimeType·durationMs, 트랙 정지', async () => {
    const { stream, track } = fakeStream();
    const d = deps({ getUserMedia: vi.fn(async () => stream) });
    const { result } = renderHook(() => useRecorder({}, d));
    expect(result.current.status).toBe('idle');
    await act(() => result.current.start());
    expect(d.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.status).toBe('recording');
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(2000);
    let rec!: Awaited<ReturnType<typeof result.current.stop>>;
    await act(async () => {
      rec = await result.current.stop();
    });
    expect(rec.blob.size).toBeGreaterThan(0);
    expect(rec.mimeType).toBe('audio/webm;codecs=opus');
    expect(rec.durationMs).toBeGreaterThanOrEqual(2300);
    expect(rec.hitLimit).toBe(false);
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('권한 거부(NotAllowedError)는 RecorderError(denied) 로 throw, 상태는 idle', async () => {
    const d = deps({ getUserMedia: vi.fn(async () => Promise.reject(deniedError())) });
    const { result } = renderHook(() => useRecorder({}, d));
    await expect(act(() => result.current.start())).rejects.toMatchObject({ name: 'RecorderError', kind: 'denied' });
    expect(result.current.status).toBe('idle');
  });

  it('MediaRecorder 가 없으면 RecorderError(unsupported)', async () => {
    const d = deps({ MediaRecorderImpl: undefined });
    const { result } = renderHook(() => useRecorder({}, d));
    await expect(act(() => result.current.start())).rejects.toBeInstanceOf(RecorderError);
    await expect(act(() => result.current.start())).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('maxMs 에 닿으면 자동 종료 → onAutoStop(recording, hitLimit=true)', async () => {
    const onAutoStop = vi.fn();
    const { result } = renderHook(() => useRecorder({ maxMs: 60_000, onAutoStop }, deps()));
    await act(() => result.current.start());
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop.mock.calls[0][0]).toMatchObject({ hitLimit: true });
    expect(onAutoStop.mock.calls[0][1]).toBe('limit');
    expect(result.current.status).toBe('idle');
  });

  describe('VAD (D-033 A1~A4)', () => {
    const QUIET = -60;
    const LOUD = -20;
    const frames = (n: number, db: number) => Array.from({ length: n }, () => db);

    it('vad: 발화 뒤 1초 무음이면 자동 종료 → onAutoStop(recording, "silence"), hitLimit=false, 미터 close', async () => {
      const onAutoStop = vi.fn();
      const { meter, close } = fakeMeter([...frames(5, QUIET), ...frames(10, LOUD), ...frames(100, QUIET)]);
      const d = deps({ createMeter: () => meter });
      const { result } = renderHook(() => useRecorder({ maxMs: 60_000, vad: true, onAutoStop }, d));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(50 * 15 + 950);
      });
      expect(onAutoStop).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(onAutoStop).toHaveBeenCalledTimes(1);
      expect(onAutoStop.mock.calls[0][0]).toMatchObject({ hitLimit: false });
      expect(onAutoStop.mock.calls[0][1]).toBe('silence');
      expect(result.current.status).toBe('idle');
      expect(close).toHaveBeenCalled();
    });

    it('vad: 발화가 없으면 무음이 길어도 종료하지 않는다(60초 상한이 잡는다)', async () => {
      const onAutoStop = vi.fn();
      const { meter } = fakeMeter([QUIET]);
      const { result } = renderHook(() => useRecorder({ maxMs: 60_000, vad: true, onAutoStop }, deps({ createMeter: () => meter })));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(onAutoStop).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(onAutoStop.mock.calls[0][1]).toBe('limit');
    });

    it('vad 를 켜지 않으면(컴포저 마이크) 무음이어도 자동 종료하지 않는다', async () => {
      const onAutoStop = vi.fn();
      const { meter } = fakeMeter([...frames(10, LOUD), ...frames(100, QUIET)]);
      const { result } = renderHook(() => useRecorder({ onAutoStop }, deps({ createMeter: () => meter })));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onAutoStop).not.toHaveBeenCalled();
      expect(result.current.status).toBe('recording');
    });

    it('level: 미터 진폭을 0~1 로 노출, 정지 후 0', async () => {
      const { meter } = fakeMeter([...frames(10, QUIET), ...frames(10, LOUD)]);
      const { result } = renderHook(() => useRecorder({ vad: true }, deps({ createMeter: () => meter })));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(50 * 10);
      });
      expect(result.current.level).toBe(0);
      await act(async () => {
        vi.advanceTimersByTime(50 * 5);
      });
      expect(result.current.level).toBeGreaterThan(0.5);
      act(() => result.current.cancel());
      expect(result.current.level).toBe(0);
    });

    it('실제 MediaRecorder 처럼 stop 이벤트가 늦게 와도 종료는 한 번만(연속 프레임·상한 타이머가 stop 을 두 번 부르지 않는다)', async () => {
      class SlowStopRecorder extends FakeMediaRecorder {
        stop = vi.fn(() => {
          this.state = 'inactive';
          setTimeout(() => super.stop(), 200);
        });
      }
      const onAutoStop = vi.fn();
      const { meter } = fakeMeter([...frames(10, LOUD), ...frames(100, QUIET)]);
      const d = deps({ createMeter: () => meter, MediaRecorderImpl: SlowStopRecorder as unknown as typeof MediaRecorder });
      const { result } = renderHook(() => useRecorder({ maxMs: 1600, vad: true, onAutoStop }, d));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      const rec = FakeMediaRecorder.instances[0] as unknown as SlowStopRecorder;
      expect(rec.stop).toHaveBeenCalledTimes(1);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
      expect(onAutoStop.mock.calls[0][1]).toBe('silence');
    });

    it('createMeter 가 없거나 null 이면(Web Audio 미지원) 녹음은 그대로 되고 level 은 0', async () => {
      const { result } = renderHook(() => useRecorder({ vad: true }, deps({ createMeter: () => null })));
      await act(() => result.current.start());
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.status).toBe('recording');
      expect(result.current.level).toBe(0);
    });
  });

  it('cancel(): 데이터 버리고 트랙 정지, idle', async () => {
    const { stream, track } = fakeStream();
    const { result } = renderHook(() => useRecorder({}, deps({ getUserMedia: vi.fn(async () => stream) })));
    await act(() => result.current.start());
    act(() => result.current.cancel());
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedMs).toBe(0);
  });

  it('언마운트 시 녹음 중이면 정리(트랙 정지)', async () => {
    const { stream, track } = fakeStream();
    const { result, unmount } = renderHook(() => useRecorder({}, deps({ getUserMedia: vi.fn(async () => stream) })));
    await act(() => result.current.start());
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });
});
