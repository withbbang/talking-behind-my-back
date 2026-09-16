'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp } from '@phosphor-icons/react';
import type { RoomMode } from '@/features/rooms/types';

export type ComposerLock = 'pending' | 'orphaned' | null;

const PLACEHOLDER: Record<RoomMode, string> = { AI: '누구 얘기 할래?', HUMAN: 'AI 몰래 얘기하기' };
const LOCK_PLACEHOLDER: Record<Exclude<ComposerLock, null>, string> = { pending: '답 쓰는 중… 잠깐만', orphaned: '주인이 도망간 방이야' };
const MAX = 4000;
const MAX_LINES = 5;

/**
 * 입력창 (DESIGN.md#3). 하단 고정 라운드 24 캡슐: textarea(자동 높이, 최대 5줄) · 전송(원 40, surface). 마이크는 M3.
 * Enter 전송 / Shift+Enter 줄바꿈 / IME 조합 중 Enter 무시. 내 잡 대기 중(pending)·주인 없는 방(orphaned)이면 잠김 — 상대는 계속 입력 가능.
 */
export function Composer({ mode, lock, onSend }: { mode: RoomMode; lock: ComposerLock; onSend: (content: string) => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const locked = lock !== null;

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
  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = '';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + 20)}px`;
  };

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
        <button
          type="button"
          aria-label="메시지 전송"
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
