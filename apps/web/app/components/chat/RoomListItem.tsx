'use client';

import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';
import { DotsThree, Users } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import type { RoomListItem as RoomListItemData } from '@/features/rooms/types';
import { relativeTime } from '@/lib/time';

type Props = {
  room: RoomListItemData;
  active: boolean;
  now?: Date;
  onRename: (title: string) => void;
  onLeave: () => void;
};

const LEAVE_COPY = {
  OWNER: '나가면 이 방은 끝이야.\n진짜 나갈거야?',
  PARTICIPANT: '나가면 이 방 대화는 앞으로 볼 수 없어.\n진짜 나갈거야?',
} as const;

/**
 * 방 목록 항목 (DESIGN.md#2). 높이 64: 아바타 · 제목/보조 줄 · 상대 시간. … 메뉴로 제목 수정(개설자)·나가기.
 * 목록 API 는 members 를 내려주지 않아(API.md) 참여자 보조 줄은 상대 닉네임 대신 "초대받은 방".
 */
export function RoomListItem({ room, active, now, onRename, onLeave }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(room.title);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isOwner = room.role === 'OWNER';
  const orphaned = room.status === 'ORPHANED';

  const startEdit = () => {
    setDraft(room.title);
    setMenuOpen(false);
    setEditing(true);
  };
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const title = draft.trim();
      if (title && title !== room.title) onRename(title);
      setEditing(false);
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  return (
    <li className={`relative rounded-2xl ${active ? 'bg-ink/6' : ''}`}>
      {editing ? (
        <div className="px-3 py-2">
          <Input
            autoFocus
            aria-label="방 제목"
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onEditKey}
            onBlur={() => setEditing(false)}
          />
        </div>
      ) : (
        <Link
          href={`/rooms/${room.id}`}
          aria-current={active ? 'page' : undefined}
          className="flex h-16 items-center gap-3 rounded-2xl pr-12 pl-3 outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-accent"
        >
          {room.memberCount >= 2 ? (
            <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/12 text-ink">
              <Users size={16} weight="bold" />
            </span>
          ) : (
            <Avatar kind="ai" />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`truncate text-[15px] font-medium ${orphaned ? 'text-muted' : 'text-ink'}`}>{room.title}</span>
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              {orphaned ? <Badge kind="closed" /> : isOwner ? <Badge kind="owner" /> : '초대받은 방'}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted tabular-nums" suppressHydrationWarning>
            {room.lastMessageAt ? relativeTime(room.lastMessageAt, now) : '새 방'}
          </span>
        </Link>
      )}

      {!editing && (
        <button
          type="button"
          aria-label="방 메뉴"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted outline-offset-[-3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <DotsThree size={24} weight="bold" />
        </button>
      )}

      {menuOpen && (
        <div
          role="menu"
          aria-label="방 메뉴"
          onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}
          className="absolute top-14 right-2 z-10 flex w-40 flex-col rounded-2xl border border-ink/12 bg-bg p-1"
        >
          {isOwner && !orphaned && (
            <button type="button" role="menuitem" onClick={startEdit} className="h-11 rounded-xl px-3 text-left text-[15px] text-ink hover:bg-ink/6">
              제목 수정
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirmLeave(true);
            }}
            className="h-11 rounded-xl px-3 text-left text-[15px] text-danger hover:bg-ink/6"
          >
            나가기
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title={LEAVE_COPY[room.role]}
        confirmLabel="나갈래"
        cancelLabel="안 나갈래"
        onConfirm={() => {
          setConfirmLeave(false);
          onLeave();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </li>
  );
}
