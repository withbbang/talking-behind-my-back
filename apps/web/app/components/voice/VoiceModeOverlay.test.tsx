import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { initialVoiceState, type VoiceState } from '@/features/speech/voiceMachine';
import { VoiceModeOverlay } from './VoiceModeOverlay';

const st = (phase: VoiceState['phase'], extra: Partial<VoiceState> = {}): VoiceState => ({ ...initialVoiceState, phase, ...extra });
const noop = { onDone: vi.fn(), onRetry: vi.fn(), onExit: vi.fn() };

describe('VoiceModeOverlay (DESIGN.md#7, D-029 뒤집히는 말풍선)', () => {
  it('recording: 내 쪽(우측) 말풍선 활성 = 탭하면 녹음 완료, "듣는 중" + m:ss', () => {
    const onDone = vi.fn();
    render(<VoiceModeOverlay state={st('recording')} elapsedMs={7300} preview="" {...noop} onDone={onDone} />);
    const dialog = screen.getByRole('dialog', { name: '보이스 모드' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('듣는 중')).toBeInTheDocument();
    expect(screen.getByText('0:07')).toBeInTheDocument();
    expect(screen.getByTestId('orb-mine')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('orb-ai')).toHaveAttribute('data-active', 'false');
    fireEvent.click(screen.getByRole('button', { name: '녹음 완료' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('transcribing: 내 쪽 활성 + 점 3개 + "받아적는 중", 녹음 완료 버튼 없음', () => {
    render(<VoiceModeOverlay state={st('transcribing')} elapsedMs={0} preview="" {...noop} />);
    expect(screen.getByText('받아적는 중')).toBeInTheDocument();
    expect(screen.getByTestId('orb-mine')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('typing-dots')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '녹음 완료' })).toBeNull();
  });

  it('streaming: AI 쪽(좌측) 활성 + 델타 미리보기 + "답하는 중"', () => {
    render(<VoiceModeOverlay state={st('streaming', { replyTo: 1 })} elapsedMs={0} preview="또? 놀랍지도" {...noop} />);
    expect(screen.getByText('답하는 중')).toBeInTheDocument();
    expect(screen.getByText('또? 놀랍지도')).toBeInTheDocument();
    expect(screen.getByTestId('orb-ai')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('orb-mine')).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('img', { name: 'AI' })).toBeInTheDocument();
  });

  it('speaking: AI 쪽 활성 + "말하는 중"', () => {
    render(<VoiceModeOverlay state={st('speaking', { replyTo: 1, speech: 'x' })} elapsedMs={0} preview="" {...noop} />);
    expect(screen.getByText('말하는 중')).toBeInTheDocument();
    expect(screen.getByTestId('orb-ai')).toHaveAttribute('data-active', 'true');
  });

  it('상태 라벨은 aria-live polite', () => {
    render(<VoiceModeOverlay state={st('recording')} elapsedMs={0} preview="" {...noop} />);
    expect(screen.getByRole('status')).toHaveTextContent('듣는 중');
  });

  it('denied: 말풍선 대신 카드 "마이크 좀 열어줘. 브라우저 설정에서." + 다시 → onRetry', () => {
    const onRetry = vi.fn();
    render(<VoiceModeOverlay state={st('denied')} elapsedMs={0} preview="" {...noop} onRetry={onRetry} />);
    expect(screen.getByText('마이크 좀 열어줘. 브라우저 설정에서.')).toBeInTheDocument();
    expect(screen.queryByTestId('orb-mine')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('error: 문구 + 다시', () => {
    render(<VoiceModeOverlay state={st('error', { error: '아직 답 쓰는 중. 좀만 기다려줘!' })} elapsedMs={0} preview="" {...noop} />);
    expect(screen.getByText('아직 답 쓰는 중. 좀만 기다려줘!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시' })).toBeInTheDocument();
  });

  it('"끄기" → onExit, "다시" → onRetry (모든 단계)', () => {
    const onExit = vi.fn();
    const onRetry = vi.fn();
    render(<VoiceModeOverlay state={st('streaming', { replyTo: 1 })} elapsedMs={0} preview="" {...noop} onExit={onExit} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '끄기' }));
    fireEvent.click(screen.getByRole('button', { name: '다시' }));
    expect(onExit).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });
});
