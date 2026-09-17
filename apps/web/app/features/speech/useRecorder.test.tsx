import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { RecorderError, useRecorder } from './useRecorder';
import { FakeMediaRecorder, deniedError, fakeRecorderDeps, fakeStream } from './testFixtures';

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
    expect(result.current.status).toBe('idle');
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
