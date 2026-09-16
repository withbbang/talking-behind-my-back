'use client';

import { useParams, usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { List, X } from '@phosphor-icons/react';
import { useRoom } from '@/features/rooms/useRooms';
import { InviteSheet } from './InviteSheet';
import { RoomHeaderSheet } from './RoomHeaderSheet';
import { Sidebar } from './Sidebar';

/**
 * 채팅 셸 (DESIGN.md#2). 모바일: 상단 바 56 + 햄버거 드로어(300, ink 40% 딤). 데스크톱(≥1024): 사이드바 280 고정.
 * 상단 바 제목은 현재 방 제목(방 밖이면 앱 이름). 방 안에서 제목 탭 → 방 헤더 시트 → "초대" → 초대 공유 시트(T-018).
 * 초대 시트는 친구가 들어오면(memberCount 2) 저절로 닫힌다 — 뒤에 "영희 등장!" 시스템 라인이 보이도록.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const roomId = params?.id ? Number(params.id) : null;
  const room = useRoom(roomId);
  // 드로어는 "열린 경로"를 기억한다 — 경로가 바뀌면 자동으로 닫힘(effect 없이 파생).
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (v: boolean) => setOpenPath(v ? pathname : null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const openInvite = () => {
    setHeaderOpen(false);
    setInviteOpen(true);
  };

  const title = roomId === null ? '뒷담 친구' : (room.data?.title ?? '…');

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-ink">
      <aside className="hidden w-[280px] shrink-0 border-r border-ink/8 lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            aria-label="메뉴"
            onClick={() => setOpen(true)}
            className="flex size-11 items-center justify-center rounded-full outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-accent lg:invisible"
          >
            <List size={24} weight="bold" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
            {room.data ? (
              <button
                type="button"
                onClick={() => setHeaderOpen(true)}
                className="max-w-full truncate rounded-lg px-2 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {title}
              </button>
            ) : (
              title
            )}
          </h1>
          <span className="size-11" aria-hidden="true" />
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>

      {room.data && <RoomHeaderSheet room={room.data} open={headerOpen} onClose={() => setHeaderOpen(false)} onInvite={openInvite} />}
      {room.data?.inviteCode && (
        <InviteSheet room={room.data} open={inviteOpen && room.data.memberCount < 2} onClose={() => setInviteOpen(false)} />
      )}

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <div role="dialog" aria-modal="true" aria-label="방 목록" className="bubble-in absolute inset-y-0 left-0 w-[300px] max-w-[85vw] bg-bg">
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full text-muted outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X size={22} weight="bold" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}
