'use client';

import { useState, type KeyboardEvent } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { PillToggle } from '@/components/ui/PillToggle';
import { Sheet } from '@/components/ui/Sheet';
import { useToastStore } from '@/components/ui/Toast';
import type { Room, RoomMode } from '@/features/rooms/types';
import { usePatchRoom } from '@/features/rooms/useRooms';
import { ApiError } from '@/lib/api';
import { AiPromptEditor } from './AiPromptEditor';

const MODES = [
  { value: 'AI', label: 'AI' },
  { value: 'HUMAN', label: '유저끼리' },
] as const satisfies readonly { value: RoomMode; label: string }[];

type Props = { room: Room; open: boolean; onClose: () => void; onInvite?: () => void };

/**
 * 방 헤더 시트 (DESIGN.md#3). 상단 바 제목 탭 → 멤버 줄 · 모드 토글 · AI 성격 · 제목 수정(개설자).
 * 초대 시트 진입(onInvite)은 T-018 이 연결한다. 모드는 낙관적으로 바꾸고 실패 시 토스트 + 되돌림.
 */
export function RoomHeaderSheet({ room, open, onClose, onInvite }: Props) {
  const patch = usePatchRoom(room.id);
  const show = useToastStore((s) => s.show);
  const fail = (e: unknown) => show(e instanceof ApiError ? e.message : '삐끗했다. 다시 해볼까?', 'error');

  const [pendingMode, setPendingMode] = useState<RoomMode | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(room.title);

  const isOwner = room.role === 'OWNER';
  const alone = room.memberCount < 2;
  const mode = pendingMode ?? room.mode;

  const changeMode = (next: RoomMode) => {
    setPendingMode(next);
    patch.mutate({ mode: next }, { onError: fail, onSettled: () => setPendingMode(null) });
  };
  const onTitleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const title = titleDraft.trim();
      if (title && title !== room.title) patch.mutate({ title }, { onError: fail });
      setEditingTitle(false);
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="방 정보">
      <div className="flex flex-col gap-6">
        {editingTitle ? (
          <Input
            autoFocus
            aria-label="방 제목"
            value={titleDraft}
            maxLength={100}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={onTitleKey}
            onBlur={() => setEditingTitle(false)}
          />
        ) : (
          <h2 className="text-[17px] leading-snug font-semibold break-keep">
            {isOwner ? (
              <button
                type="button"
                aria-label={`제목 수정: ${room.title}`}
                onClick={() => {
                  setTitleDraft(room.title);
                  setEditingTitle(true);
                }}
                className="rounded-lg text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {room.title}
              </button>
            ) : (
              room.title
            )}
          </h2>
        )}

        <ul aria-label="멤버" className="flex items-center gap-4">
          {room.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 text-[15px]">
              <Avatar name={m.nickname} size={32} />
              <span>{m.nickname}</span>
            </li>
          ))}
          {alone && (
            <li className="flex items-center gap-2 text-[15px] text-muted">
              {isOwner && onInvite ? (
                <button
                  type="button"
                  onClick={onInvite}
                  className="flex items-center gap-2 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full border border-dashed border-ink/30">
                    <Plus size={16} weight="bold" />
                  </span>
                  초대
                </button>
              ) : (
                <>
                  <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full border border-dashed border-ink/30">
                    <Plus size={16} weight="bold" />
                  </span>
                  <span>초대</span>
                </>
              )}
            </li>
          )}
        </ul>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold">모드</h3>
            <PillToggle aria-label="모드" options={MODES} value={mode} onChange={changeMode} disabled={alone || patch.isPending} />
          </div>
          {alone && <p className="text-right text-[13px] text-muted">둘이 되면 켜져</p>}
        </div>

        <AiPromptEditor
          key={room.aiPrompt ?? ''}
          aiPersonality={room.aiPersonality}
          aiPrompt={room.aiPrompt}
          effectiveAiPrompt={room.effectiveAiPrompt}
          editable={isOwner}
          onSelectPreset={(aiPersonality) => patch.mutate({ aiPersonality }, { onError: fail })}
          onSavePrompt={(aiPrompt) => patch.mutate({ aiPrompt }, { onError: fail })}
          onReset={() => patch.mutate({ aiPrompt: '' }, { onError: fail })}
        />
      </div>
    </Sheet>
  );
}
