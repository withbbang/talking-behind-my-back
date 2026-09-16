'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToastStore } from '@/components/ui/Toast';
import { useLogout } from '@/features/auth/useLogout';
import { useMe } from '@/features/auth/useMe';
import type { RoomListItem as RoomListItemData } from '@/features/rooms/types';
import { useCreateRoom, useLeaveRoom, usePatchRoom, useRooms } from '@/features/rooms/useRooms';
import { ApiError } from '@/lib/api';
import { RoomListItem } from './RoomListItem';
import { ThemePicker } from './ThemePicker';

export function activeRoomId(pathname: string): number | null {
  const m = /^\/rooms\/(\d+)/.exec(pathname);
  return m ? Number(m[1]) : null;
}

/**
 * 사이드바 (DESIGN.md#2). 상단 "+ 새 방", 방 목록(하단 도달 시 다음 페이지), 하단 프로필 + 로그아웃, 그 아래 테마 선택(T-020).
 * 데스크톱은 고정 280, 모바일은 ChatShell 드로어 안에 같은 컴포넌트.
 */
export function Sidebar() {
  const pathname = usePathname();
  const active = activeRoomId(pathname);
  const rooms = useRooms();
  const create = useCreateRoom();
  const me = useMe();
  const logout = useLogout();
  const [now] = useState(() => new Date());
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && rooms.hasNextPage && !rooms.isFetchingNextPage) {
        void rooms.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rooms]);

  return (
    <div className="flex h-full flex-col gap-4 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="h-13 w-full shrink-0 rounded-2xl bg-surface text-base font-semibold text-on-surface outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-60"
      >
        + 새 방
      </button>

      <nav aria-label="방 목록" className="min-h-0 flex-1 overflow-y-auto">
        {rooms.isPending ? (
          <Skeleton lines={4} label="방 목록 불러오는 중" />
        ) : rooms.rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Avatar kind="ai" size={40} />
            <p className="text-[15px] text-muted break-keep">아직 방이 없네? 하나 파자.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {rooms.rooms.map((room) => (
              <SidebarRoomItem key={room.id} room={room} active={room.id === active} now={now} />
            ))}
          </ul>
        )}
        <div ref={sentinel} aria-hidden="true" className="h-px" />
      </nav>

      <div className="flex shrink-0 items-center gap-3 pt-2">
        {me.data ? (
          <>
            <Avatar name={me.data.nickname} size={32} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{me.data.nickname}</span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="h-11 rounded-xl px-3 text-sm font-medium text-muted outline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          로그아웃
        </button>
      </div>
      <div className="flex shrink-0 justify-end">
        <ThemePicker />
      </div>
    </div>
  );
}

function SidebarRoomItem({ room, active, now }: { room: RoomListItemData; active: boolean; now: Date }) {
  const patch = usePatchRoom(room.id);
  const leave = useLeaveRoom(room.id);
  const show = useToastStore((s) => s.show);
  const fail = (e: unknown) => show(e instanceof ApiError ? e.message : '삐끗했다. 다시 해볼까?', 'error');

  return (
    <RoomListItem
      room={room}
      active={active}
      now={now}
      onRename={(title) => patch.mutate({ title }, { onError: fail })}
      onLeave={() => leave.mutate(undefined, { onError: fail })}
    />
  );
}
