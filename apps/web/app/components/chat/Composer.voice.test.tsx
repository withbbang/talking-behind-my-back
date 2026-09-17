import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => {
  const getUserMedia = vi.fn();
  return { getUserMedia };
});
vi.mock('@/features/speech/speechApi', () => ({ transcribe: vi.fn(), synthesize: vi.fn() }));

import { useToastStore } from '@/components/ui/Toast';
import { transcribe } from '@/features/speech/speechApi';
import { FakeMediaRecorder, deniedError, fakeStream } from '@/features/speech/testFixtures';
import { useTtsStore } from '@/features/speech/useTts';
import { fakePlayer } from '@/features/speech/testFixtures';
import { RecorderError } from '@/features/speech/useRecorder';
import { defaultRecorderDeps } from '@/features/speech/useRecorder';
import { Composer } from './Composer';

const transcribeMock = vi.mocked(transcribe);

describe('Composer 마이크 (DESIGN.md#7 컴포저 마이크, D-029 3=b 즉시 전송)', () => {
  beforeEach(() => {
    h.getUserMedia.mockReset();
    h.getUserMedia.mockImplementation(async () => fakeStream().stream);
    defaultRecorderDeps.getUserMedia = h.getUserMedia;
    defaultRecorderDeps.MediaRecorderImpl = FakeMediaRecorder as unknown as typeof MediaRecorder;
    transcribeMock.mockReset();
    useToastStore.setState({ toast: null });
    useTtsStore.setState({ playingId: null, player: fakePlayer() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('마이크 탭 → 녹음 줄("듣는 중" + 시간 + 녹음 취소/완료), 입력·전송은 사라진다', async () => {
    render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    expect(h.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByText('듣는 중')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '녹음 취소' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '녹음 완료' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '전송' })).toBeNull();
  });

  it('녹음 완료 → "받아적는 중" → STT 결과를 VOICE 로 즉시 전송 → 입력창 복귀', async () => {
    let settle!: (v: { text: string; durationMs: number }) => void;
    transcribeMock.mockImplementationOnce(() => new Promise((r) => (settle = r)));
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '녹음 완료' }));
    });
    expect(screen.getByText('받아적는 중')).toBeInTheDocument();
    expect(transcribeMock).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/webm;codecs=opus', hitLimit: false }));
    await act(async () => {
      settle({ text: '진짜 짜증나', durationMs: 2000 });
    });
    expect(onSend).toHaveBeenCalledWith('진짜 짜증나', 'VOICE');
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeInTheDocument();
  });

  it('STT 결과가 비면 전송 없이 토스트 "아무 말도 안 들렸는데?"', async () => {
    transcribeMock.mockResolvedValueOnce({ text: '', durationMs: 900 });
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '녹음 완료' }));
    });
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('아무 말도 안 들렸는데?'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('STT 실패 → 공용 오류 토스트, 입력창 복귀', async () => {
    transcribeMock.mockRejectedValueOnce(new Error('502'));
    render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '녹음 완료' }));
    });
    await waitFor(() => expect(useToastStore.getState().toast).toMatchObject({ message: '시스템 오류. 다시 시도해줄래?', tone: 'error' }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('권한 거부 → 토스트 "마이크 좀 열어줘. 브라우저 설정에서.", 입력창 그대로', async () => {
    h.getUserMedia.mockImplementationOnce(async () => Promise.reject(deniedError()));
    render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    expect(useToastStore.getState().toast).toMatchObject({ message: '마이크 좀 열어줘. 브라우저 설정에서.', tone: 'error' });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(RecorderError).toBeDefined();
  });

  it('녹음 취소 → STT 호출 없이 입력창 복귀', async () => {
    render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    fireEvent.click(screen.getByRole('button', { name: '녹음 취소' }));
    expect(transcribeMock).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('60초에 닿으면 자동 완료 + 토스트 "60초까지만 들을 수 있어!"', async () => {
    vi.useFakeTimers();
    transcribeMock.mockResolvedValueOnce({ text: '긴 얘기', durationMs: 60000 });
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '마이크' }));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(transcribeMock).toHaveBeenCalledWith(expect.objectContaining({ hitLimit: true }));
    expect(useToastStore.getState().toast?.message).toBe('60초까지만 들을 수 있어!');
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(onSend).toHaveBeenCalledWith('긴 얘기', 'VOICE');
  });

  it('잠김(pending/orphaned)이면 마이크 없음', () => {
    const { rerender } = render(<Composer mode="AI" lock="pending" onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '마이크' })).toBeNull();
    rerender(<Composer mode="HUMAN" lock="orphaned" onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '마이크' })).toBeNull();
    rerender(<Composer mode="HUMAN" lock={null} onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: '마이크' })).toBeInTheDocument();
  });
});
