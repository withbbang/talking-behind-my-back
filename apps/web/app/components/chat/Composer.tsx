'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Check, Microphone, X } from '@phosphor-icons/react';
import { useToastStore } from '@/components/ui/Toast';
import { VoiceButton } from '@/components/voice/VoiceButton';
import type { InputType } from '@/features/messages/types';
import type { RoomMode } from '@/features/rooms/types';
import { formatElapsed } from '@/features/speech/format';
import { transcribe } from '@/features/speech/speechApi';
import { RecorderError, useRecorder, type Recording } from '@/features/speech/useRecorder';
import { useTtsStore } from '@/features/speech/useTts';
import { GENERIC_ERROR, VOICE_COPY, VOICE_MAX_MS } from '@/lib/copy';

export type ComposerLock = 'pending' | 'orphaned' | null;

const PLACEHOLDER: Record<RoomMode, string> = { AI: '무슨 얘기 하고싶어?', HUMAN: 'AI 몰래 얘기하기' };
const LOCK_PLACEHOLDER: Record<Exclude<ComposerLock, null>, string> = { pending: '뒷담 친구 기다리는 중...', orphaned: '방장이 도망간 방이야!' };
const MAX = 4000;
const MAX_LINES = 5;

type VoiceUi = 'idle' | 'recording' | 'transcribing';

/**
 * 입력창 (DESIGN.md#3·#7). 하단 고정 라운드 24 캡슐: textarea(자동 높이, 최대 5줄) · 지우기 X(글자가 있을 때만, D-035 4) · 마이크(원 40, 테두리) · 보이스 모드 토글(D-034 1, AI 모드·ACTIVE 일 때만) · 전송(원 40, surface).
 * Enter 전송 / Shift+Enter 줄바꿈 / IME 조합 중 Enter 무시. 내 잡 대기 중(pending)·주인 없는 방(orphaned)이면 잠김 — 상대는 계속 입력 가능.
 * 마이크: 탭 시작 → 캡슐이 녹음 줄(듣는 중 + m:ss + 취소/완료)로 → 완료 시 STT → 결과를 확인 없이 VOICE 로 즉시 전송(D-029 3=b). 60초면 자동 완료.
 */
type Props = {
  mode: RoomMode;
  lock: ComposerLock;
  /** 보이스 모드 토글을 붙일 방 id. null 이면 토글 없음(HUMAN 모드·ORPHANED·잠김) — 조건은 RoomView 가 판단. */
  voiceRoomId?: number | null;
  onSend: (content: string, inputType?: InputType) => void;
};

export function Composer({ mode, lock, voiceRoomId = null, onSend }: Props) {
  const [value, setValue] = useState('');
  const [voice, setVoice] = useState<VoiceUi>('idle');
  const ref = useRef<HTMLTextAreaElement>(null);
  const locked = lock !== null;
  const show = useToastStore((s) => s.show);
  const player = useTtsStore((s) => s.player);

  const afterRecording = async (rec: Recording) => {
    setVoice('transcribing');
    try {
      const { text } = await transcribe(rec);
      if (!text) show(VOICE_COPY.empty);
      else onSend(text, 'VOICE');
    } catch {
      show(GENERIC_ERROR, 'error');
    } finally {
      setVoice('idle');
    }
  };
  const recorder = useRecorder({
    maxMs: VOICE_MAX_MS,
    onAutoStop: (rec) => {
      show(VOICE_COPY.limit);
      void afterRecording(rec);
    },
  });
  const startVoice = async () => {
    player.unlock();
    try {
      await recorder.start();
      setVoice('recording');
    } catch (e) {
      show(e instanceof RecorderError && e.kind === 'denied' ? VOICE_COPY.denied : GENERIC_ERROR, 'error');
    }
  };
  const finishVoice = async () => {
    const rec = await recorder.stop();
    await afterRecording(rec);
  };
  const cancelVoice = () => {
    recorder.cancel();
    setVoice('idle');
  };

  const submit = () => {
    const content = value.trim();
    if (!content || locked) return;
    onSend(content);
    setValue('');
    if (ref.current) ref.current.style.height = '';
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  };
  const clear = () => {
    setValue('');
    if (ref.current) {
      ref.current.style.height = '';
      ref.current.focus();
    }
  };
  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = '';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + 20)}px`;
  };

  if (voice !== 'idle') {
    return (
      <div className="shrink-0 bg-bg p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex h-[52px] items-center gap-2 rounded-3xl border border-ink/12 py-1.5 pr-1.5 pl-4">
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full bg-accent ${voice === 'recording' ? 'motion-safe:animate-pulse' : ''}`} />
          <span className="text-[15px] font-semibold">{voice === 'recording' ? VOICE_COPY.recording : VOICE_COPY.transcribing}</span>
          {voice === 'recording' ? (
            <span className="text-[15px] text-muted tabular-nums">{formatElapsed(recorder.elapsedMs)}</span>
          ) : (
            <span className="typing-dots inline-flex h-6 items-center gap-1" aria-hidden="true">
              <i /><i /><i />
            </span>
          )}
          <span className="flex-1" />
          {voice === 'recording' && (
            <>
              <button
                type="button"
                aria-label="녹음 취소"
                onClick={cancelVoice}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink/12 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform"
              >
                <X size={20} weight="bold" />
              </button>
              <button
                type="button"
                aria-label="녹음 완료"
                onClick={() => void finishVoice()}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform"
              >
                <Check size={20} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 bg-bg p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className={`flex items-end gap-2 rounded-3xl border border-ink/12 py-1.5 pr-1.5 pl-4 ${locked ? 'opacity-60' : ''}`}>
        <textarea
          ref={ref}
          aria-label="메시지"
          rows={1}
          maxLength={MAX}
          value={value}
          disabled={locked}
          placeholder={locked ? LOCK_PLACEHOLDER[lock] : PLACEHOLDER[mode]}
          onChange={(e) => {
            setValue(e.target.value);
            autosize(e.target);
          }}
          onKeyDown={onKey}
          className="max-h-40 min-h-7 flex-1 resize-none self-center bg-transparent py-1 text-base leading-6 text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />
        {value !== '' && !locked && (
          <button
            type="button"
            aria-label="지우기"
            onClick={clear}
            className="relative flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-ink/12 text-ink outline-offset-2 after:absolute after:-inset-2.5 after:content-[''] hover:bg-ink/20 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={12} weight="bold" />
          </button>
        )}
        {!locked && (
          <button
            type="button"
            aria-label="마이크"
            onClick={() => void startVoice()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink/12 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform"
          >
            <Microphone size={20} weight="bold" />
          </button>
        )}
        {!locked && voiceRoomId !== null && <VoiceButton roomId={voiceRoomId} />}
        <button
          type="button"
          aria-label="전송"
          onClick={submit}
          disabled={locked || value.trim() === ''}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform disabled:opacity-40"
        >
          <ArrowUp size={20} weight="bold" />
        </button>
      </div>
    </div>
  );
}
