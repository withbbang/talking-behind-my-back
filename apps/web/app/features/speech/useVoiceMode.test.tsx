import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Meter } from './useRecorder';
import { act, renderHook } from '@testing-library/react';
import { useToastStore } from '@/components/ui/Toast';
import { useStreamStore } from '@/features/messages/streamStore';
import { aiMsg, userMsg } from '@/features/messages/testFixtures';
import { ApiError } from '@/lib/api';
import { deniedError, fakeMeter, fakePlayer, fakeRecorderDeps, fakeStream } from './testFixtures';
import { useVoiceMode, type VoiceModeDeps } from './useVoiceMode';

function setup(
  over: { transcribe?: VoiceModeDeps['transcribe']; send?: (content: string) => Promise<{ messageId: number }>; getUserMedia?: () => Promise<MediaStream>; meter?: Meter } = {},
) {
  const player = fakePlayer();
  const transcribe = over.transcribe ?? vi.fn(async () => ({ text: '진짜 짜증나', durationMs: 2000 }));
  const send = over.send ?? vi.fn(async () => ({ messageId: 77 }));
  const recorderDeps = fakeRecorderDeps({
    ...(over.getUserMedia ? { getUserMedia: vi.fn(over.getUserMedia) } : {}),
    ...(over.meter ? { createMeter: () => over.meter ?? null } : {}),
  });
  const onExit = vi.fn();
  const deps: VoiceModeDeps = { player, transcribe, recorderDeps };
  const hook = renderHook(({ active }) => useVoiceMode({ roomId: 10, active, send, onExit }, deps), { initialProps: { active: true } });
  return { ...hook, player, transcribe, send, recorderDeps, onExit };
}
const flush = () => act(async () => {});

describe('useVoiceMode (DESIGN.md#7 루프 오케스트레이션)', () => {
  beforeEach(() => {
    useStreamStore.setState({ rooms: {} });
    useToastStore.setState({ toast: null });
  });

  it('정상 루프: 녹음 → 완료 → STT → 전송(VOICE) → 스트리밍 중 첫 문장 선재생 → done 에 꼬리 → 큐 소진 → 다시 녹음', async () => {
    const { result, player, transcribe, send, recorderDeps } = setup();
    await flush();
    expect(result.current.state.phase).toBe('recording');
    expect(recorderDeps.getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => result.current.done());
    expect(transcribe).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('진짜 짜증나');
    expect(result.current.state).toMatchObject({ phase: 'streaming', replyTo: 77 });
    expect(player.open).toHaveBeenCalledTimes(1);
    act(() => useStreamStore.getState().dispatch(10, { type: 'delta', data: { replyTo: 77, text: '또? 놀랍' } }));
    expect(result.current.preview).toBe('또? 놀랍');
    expect(player.session.enqueue).toHaveBeenCalledWith('또?'); // 첫 문장은 done 전에 재생 큐로
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: '또? 놀랍지도 않네.' }), promptTokens: 1, completionTokens: 1 } }));
    expect(result.current.state.phase).toBe('speaking');
    expect(player.session.enqueue).toHaveBeenLastCalledWith('놀랍지도 않네.'); // 델타로 못 받은 나머지 + 꼬리
    expect(player.session.end).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    await act(async () => {
      player.session.resolve();
    });
    expect(result.current.state.phase).toBe('recording');
    expect(recorderDeps.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('done 본문이 델타 누적과 다르면(서버 trim 등) 받은 델타 뒤 꼬리만 flush 하고 끝낸다', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'delta', data: { replyTo: 77, text: '하나. 둘' } }));
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: '다른 본문' }), promptTokens: 1, completionTokens: 1 } }));
    expect(player.session.enqueue.mock.calls.map((c) => c[0])).toEqual(['하나.', '둘']);
    expect(player.session.end).toHaveBeenCalled();
    expect(result.current.state.phase).toBe('speaking');
  });

  it('선재생이 첫 오디오 전에 실패하면 전체 텍스트 TTS 로 폴백(T-010 경로) → 끝나면 다시 녹음', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: '또? 놀랍지도 않네.' }), promptTokens: 1, completionTokens: 1 } }));
    await act(async () => {
      player.session.reject(false);
    });
    expect(result.current.state.phase).toBe('speaking');
    expect(player.play).toHaveBeenCalledWith('또? 놀랍지도 않네.');
    await act(async () => {
      player.resolvePlay();
    });
    expect(result.current.state.phase).toBe('recording');
  });

  it('선재생이 재생 시작 후 실패하면 error 공용 문구(이미 읽은 부분을 다시 읽지 않는다)', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: 'x' }), promptTokens: 1, completionTokens: 1 } }));
    await act(async () => {
      player.session.reject(true);
    });
    expect(player.play).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ phase: 'error', error: '시스템 오류. 다시 시도해줄래?' });
  });

  describe('VAD (D-033 A2·A3)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('말한 뒤 1초 무음이면 탭 없이 자동으로 완료 → STT → 전송, 토스트 없음; level 노출', async () => {
      const LOUD = -20;
      const QUIET = -60;
      const { meter } = fakeMeter([...Array.from({ length: 10 }, () => LOUD), ...Array.from({ length: 100 }, () => QUIET)]);
      const { result, transcribe, send } = setup({ meter });
      await flush();
      expect(result.current.state.phase).toBe('recording');
      await act(async () => {
        vi.advanceTimersByTime(50 * 5);
      });
      expect(result.current.level).toBeGreaterThan(0.5);
      await act(async () => {
        vi.advanceTimersByTime(50 * 5 + 1000 + 100);
      });
      await flush();
      expect(transcribe).toHaveBeenCalled();
      expect(send).toHaveBeenCalledWith('진짜 짜증나');
      expect(useToastStore.getState().toast).toBeNull();
    });
  });

  it('권한 거부 → denied, retry() 로 재요청', async () => {
    let calls = 0;
    const { result } = setup({
      getUserMedia: async () => {
        calls += 1;
        if (calls === 1) throw deniedError();
        return fakeStream().stream;
      },
    });
    await flush();
    expect(result.current.state.phase).toBe('denied');
    await act(async () => result.current.retry());
    expect(result.current.state.phase).toBe('recording');
  });

  it('STT 빈 결과 → 토스트 "아무 말도 안 들렸는데?" + 다시 녹음, 전송 없음', async () => {
    const { result, send } = setup({ transcribe: vi.fn(async () => ({ text: '', durationMs: 500 })) });
    await flush();
    await act(async () => result.current.done());
    expect(send).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('recording');
    expect(useToastStore.getState().toast?.message).toBe('아무 말도 안 들렸는데?');
  });

  it('전송 409 ROOM_BUSY → error "아직 답 쓰는 중. 좀만 기다려줘!"', async () => {
    const { result } = setup({ send: vi.fn(async () => Promise.reject(new ApiError(409, 'ROOM_BUSY', 'busy'))) });
    await flush();
    await act(async () => result.current.done());
    expect(result.current.state).toMatchObject({ phase: 'error', error: '아직 답 쓰는 중. 좀만 기다려줘!' });
  });

  it('스트림 error 이벤트 → error 공용 문구', async () => {
    const { result } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'error', data: { replyTo: 77, code: 'LLM_UPSTREAM_ERROR', message: 'x' } }));
    expect(result.current.state).toMatchObject({ phase: 'error', error: '시스템 오류. 다시 시도해줄래?' });
  });

  it('2인 방: 상대 메시지의 done 은 무시하고 내 replyTo 만 읽는다', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'message', data: userMsg(80, { senderUserId: 2 }) }));
    act(() => useStreamStore.getState().dispatch(10, { type: 'delta', data: { replyTo: 80, text: '상대 답. ' } }));
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 80, message: aiMsg(81, { content: '상대 답.' }), promptTokens: 1, completionTokens: 1 } }));
    expect(result.current.state.phase).toBe('streaming');
    expect(player.play).not.toHaveBeenCalled();
    expect(player.session.enqueue).not.toHaveBeenCalled();
  });

  it('retry() 중 스트리밍이면 추적을 버리고 녹음으로, 늦게 온 done 은 무시', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    await act(async () => result.current.retry());
    expect(result.current.state).toMatchObject({ phase: 'recording', replyTo: null });
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78), promptTokens: 1, completionTokens: 1 } }));
    expect(result.current.state.phase).toBe('recording');
    expect(player.play).not.toHaveBeenCalled();
  });

  it('exit(): 재생 정지 + 녹음 정리 + onExit, idle', async () => {
    const { result, player, onExit } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: 'x' }), promptTokens: 1, completionTokens: 1 } }));
    expect(result.current.state.phase).toBe('speaking');
    await act(async () => result.current.exit());
    expect(player.stop).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
    expect(result.current.state.phase).toBe('idle');
  });

  it('active 가 false 로 바뀌면 정리하고 idle', async () => {
    const { result, rerender, player } = setup();
    await flush();
    expect(result.current.state.phase).toBe('recording');
    rerender({ active: false });
    await flush();
    expect(result.current.state.phase).toBe('idle');
    expect(player.stop).toHaveBeenCalled();
  });

  it('폴백 전체 TTS 도 실패 → error 공용 문구', async () => {
    const { result, player } = setup();
    await flush();
    await act(async () => result.current.done());
    act(() => useStreamStore.getState().dispatch(10, { type: 'done', data: { replyTo: 77, message: aiMsg(78, { content: 'x' }), promptTokens: 1, completionTokens: 1 } }));
    await act(async () => {
      player.session.reject(false);
    });
    await act(async () => {
      player.rejectPlay();
    });
    expect(result.current.state).toMatchObject({ phase: 'error', error: '시스템 오류. 다시 시도해줄래?' });
  });
});
