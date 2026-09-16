'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { Message } from '@/features/messages/types';
import type { RoomMember } from '@/features/rooms/types';
import type { StreamEntry, StreamState } from '@/lib/sse';
import { formatDateChip, isSameKstDay } from '@/lib/time';
import { MessageBubble, type BubbleKind } from './MessageBubble';

type Props = {
  messages: Message[];
  meId: number;
  members: RoomMember[];
  stream: StreamState;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (replyTo: number) => void;
};

type Row =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'notice'; key: string; text: string }
  | { kind: 'message'; key: string; message: Message; bubble: BubbleKind; showMeta: boolean; senderName?: string };

const LEFT_MEMBER = '나간 사람';

export function buildRows(messages: Message[], notices: StreamState['notices'], meId: number, members: RoomMember[]): Row[] {
  const nameOf = (id: number | null) => members.find((m) => m.userId === id)?.nickname ?? LEFT_MEMBER;
  const merged: ({ at: string } & ({ t: 'm'; m: Message } | { t: 'n'; n: StreamState['notices'][number] }))[] = [
    ...messages.map((m) => ({ at: m.createdAt, t: 'm' as const, m })),
    ...notices.map((n) => ({ at: n.createdAt, t: 'n' as const, n })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const rows: Row[] = [];
  let lastDate: string | null = null;
  let lastSender: string | null = null;
  for (const item of merged) {
    if (lastDate === null || !isSameKstDay(lastDate, item.at)) {
      rows.push({ kind: 'date', key: `d${item.at}`, label: formatDateChip(item.at) });
      lastDate = item.at;
      lastSender = null;
    }
    if (item.t === 'n') {
      rows.push({ kind: 'notice', key: item.n.id, text: item.n.text });
      lastSender = null;
      continue;
    }
    const m = item.m;
    const sender = m.role === 'ASSISTANT' ? 'ai' : `u${m.senderUserId}`;
    const bubble: BubbleKind = m.role === 'ASSISTANT' ? 'ai' : m.senderUserId === meId ? 'mine' : 'other';
    rows.push({ kind: 'message', key: `m${m.id}`, message: m, bubble, showMeta: sender !== lastSender, senderName: bubble === 'other' ? nameOf(m.senderUserId) : undefined });
    lastSender = sender;
  }
  return rows;
}

/** 하단에서 이만큼 안이면 새 메시지에 따라 내려간다. */
const STICK_THRESHOLD = 120;
export const isNearBottom = (scrollTop: number, scrollHeight: number, clientHeight: number) => scrollHeight - scrollTop - clientHeight < STICK_THRESHOLD;

/**
 * 메시지 목록 (DESIGN.md#3). 날짜 칩 · 시스템 라인 · 말풍선 3종(연속 발신자 메타 생략) · 스트리밍 말풍선.
 * 상단 도달 시 이전 페이지(IO, 폴백 버튼). 이전 페이지가 앞에 붙어도 스크롤 위치 유지, 하단 근처면 새 메시지에 붙어 내려간다.
 */
export function MessageList({ messages, meId, members, stream, hasOlder, isLoadingOlder, onLoadOlder, onRetry }: Props) {
  const rows = buildRows(messages, stream.notices, meId, members);
  const streams = Object.values(stream.streams).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const stick = useRef(true);
  const tailKey = `${rows[rows.length - 1]?.key ?? ''}|${streams.map((s) => `${s.replyTo}:${s.text.length}:${s.status}`).join(',')}`;

  useEffect(() => {
    const el = topSentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && hasOlder && !isLoadingOlder) {
        prevHeight.current = scroller.current?.scrollHeight ?? 0;
        onLoadOlder();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasOlder, isLoadingOlder, onLoadOlder]);

  // 이전 페이지가 앞에 붙으면 늘어난 높이만큼 내려서 보던 자리를 유지. 하단 근처였으면 맨 아래로.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = 0;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [tailKey, rows.length]);

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const t = e.currentTarget;
        stick.current = isNearBottom(t.scrollTop, t.scrollHeight, t.clientHeight);
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-3"
    >
      <div ref={topSentinel} aria-hidden="true" className="h-px" />
      {hasOlder && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => {
              prevHeight.current = scroller.current?.scrollHeight ?? 0;
              onLoadOlder();
            }}
            disabled={isLoadingOlder}
            className="h-8 rounded-full border border-ink/12 px-3 text-xs text-muted outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {isLoadingOlder ? '불러오는 중…' : '이전 대화'}
          </button>
        </div>
      )}
      <ol className="flex flex-col">
        {rows.map((row) =>
          row.kind === 'date' ? (
            <li key={row.key} data-testid="date-chip" className="my-4 self-center rounded-full bg-ink/6 px-3 py-1 text-xs text-muted">
              {row.label}
            </li>
          ) : row.kind === 'notice' ? (
            <li key={row.key} className="my-3 self-center text-center text-[13px] text-muted break-keep">
              {row.text}
            </li>
          ) : (
            <MessageBubble key={row.key} message={row.message} kind={row.bubble} senderName={row.senderName} showMeta={row.showMeta} />
          ),
        )}
        {streams.map((s) => (
          <StreamingBubble key={s.replyTo} entry={s} onRetry={onRetry} />
        ))}
      </ol>
    </div>
  );
}

/** AI 응답 자리. 대기 = 점 3개(700ms 루프, reduced-motion 은 정적 …), 진행 = 델타 + ▍, 오류 = 문구 + "다시". */
function StreamingBubble({ entry, onRetry }: { entry: StreamEntry; onRetry: (replyTo: number) => void }) {
  return (
    <li data-kind="ai" data-streaming={entry.status} className="bubble-in mt-3 flex justify-start gap-2">
      <span className="w-7 shrink-0 self-end">
        <Avatar kind="ai" />
      </span>
      <div className="relative max-w-[78%]">
        <div role="status" aria-live="polite" className="rounded-[22px] border border-ink/12 bg-bg px-4 py-2.5 text-base leading-relaxed text-ink break-words whitespace-pre-wrap">
          {entry.status === 'waiting' && (
            <span data-testid="typing-dots" className="typing-dots inline-flex h-6 items-center gap-1" aria-label="답 쓰는 중">
              <i /><i /><i />
            </span>
          )}
          {entry.status === 'streaming' && (
            <>
              {entry.text}
              <span aria-hidden="true">▍</span>
            </>
          )}
          {entry.status === 'error' && (
            <span className="flex flex-wrap items-center gap-2">
              삐끗했다. 다시 해볼까?
              <button
                type="button"
                onClick={() => onRetry(entry.replyTo)}
                className="text-[15px] font-semibold text-accent underline underline-offset-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                다시
              </button>
            </span>
          )}
        </div>
        <svg viewBox="0 0 14 10" aria-hidden="true" className="absolute -bottom-[7px] left-3 h-2.5 w-3.5">
          <path d="M0 0h14c-3 1.5-6 5-7 10C6 5 3 1.5 0 0z" className="fill-ink/12" />
          <path d="M1.5 0.9h11c-2.5 1.3-4.8 4.2-5.5 7.6C6.3 5.1 4 2.2 1.5 0.9z" className="fill-bg" />
        </svg>
      </div>
    </li>
  );
}
