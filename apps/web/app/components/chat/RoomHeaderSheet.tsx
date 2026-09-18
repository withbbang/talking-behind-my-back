'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { GENERIC_ERROR } from '@/lib/copy';
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
import { ThemeRow } from './ThemePicker';

// 칸별 안내 툴팁(D-037 4) — 혼자인 방은 토글이 비활성이라 "친구 초대해봐!" 하나만 띄운다.
const MODES = [
  { value: 'AI', label: 'AI', tip: 'AI와 1:1, 친구는 못 봐!' },
  { value: 'HUMAN', label: '유저끼리', tip: '친구와 1:1, AI는 못 봐!' },
] as const satisfies readonly { value: RoomMode; label: string; tip: string }[];

const MODES_ALONE = MODES.map(({ value, label }) => ({ value, label })) as readonly { value: RoomMode; label: string }[];

type Props = { room: Room; open: boolean; onClose: () => void; onInvite?: () => void };

/**
 * 설정 시트 (DESIGN.md#3, D-034 2~7). 사이드바 톱니 → 제목(가운데, 개설자는 탭해 수정) · 멤버 줄(가운데) · 모드 · 테마 · AI 성격.
 * 모드 토글 칸마다 안내 툴팁("AI와 1:1, 친구는 못 봐!" / "친구와 1:1, AI는 못 봐!", D-037 4).
 * 혼자면 모드 토글 비활성 + 칸별 툴팁 대신 "친구 초대해봐!" 말풍선 툴팁 하나. 초대 시트 진입(onInvite)은 T-018. 모드는 낙관적으로 바꾸고 실패 시 토스트 + 되돌림.
 */
export function RoomHeaderSheet({ room, open, onClose, onInvite }: Props) {
  const patch = usePatchRoom(room.id);
  const show = useToastStore((s) => s.show);
  const fail = (e: unknown) =>
    show(e instanceof ApiError && e.code === 'MODE_NOT_ALLOWED' ? '혼자서는 유저끼리 대화할 수 없어!' : GENERIC_ERROR, 'error');
  const tipId = useId();

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
    <Sheet open={open} onClose={onClose} label="설정">
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
            className="text-center"
          />
        ) : (
          <h2 className="text-center text-[17px] leading-snug font-semibold break-keep">
            {isOwner ? (
              <button
                type="button"
                aria-label={`제목 수정: ${room.title}`}
                onClick={() => {
                  setTitleDraft(room.title);
                  setEditingTitle(true);
                }}
                className="max-w-full rounded-lg px-2 py-0.5 text-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {room.title}
              </button>
            ) : (
              room.title
            )}
          </h2>
        )}

        <ul aria-label="멤버" className="flex items-center justify-center gap-5">
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

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">모드</h3>
          <span className="group relative inline-flex">
            <PillToggle
              aria-label="모드"
              aria-describedby={alone ? tipId : undefined}
              options={alone ? MODES_ALONE : MODES}
              value={mode}
              onChange={changeMode}
              disabled={alone || patch.isPending}
            />
            {alone && (
              <span
                role="tooltip"
                id={tipId}
                className="pointer-events-none absolute right-0 bottom-full mb-2 rounded-full rounded-br-[4px] bg-surface px-3 py-1.5 text-xs font-medium whitespace-nowrap text-on-surface opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100"
              >
                친구 초대해봐!
              </span>
            )}
          </span>
        </div>

        <ThemeRow />

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
