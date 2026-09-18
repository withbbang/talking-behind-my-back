'use client';

import { usePathname } from 'next/navigation';
import { GENERIC_ERROR } from '@/lib/copy';
import { useEffect, useRef, useState } from 'react';
import { CaretUp } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToastStore } from '@/components/ui/Toast';
import { useMenu } from '@/components/ui/useMenu';
import { useLogout } from '@/features/auth/useLogout';
import { useMe } from '@/features/auth/useMe';
import type { RoomListItem as RoomListItemData } from '@/features/rooms/types';
import { useCreateRoom, useLeaveRoom, usePatchRoom, useRooms } from '@/features/rooms/useRooms';
import { RoomListItem } from './RoomListItem';

export function activeRoomId(pathname: string): number | null {
  const m = /^\/rooms\/(\d+)/.exec(pathname);
  return m ? Number(m[1]) : null;
}

type Props = {
  /** 프로필 메뉴의 "설정" (D-035 2). ChatShell 이 설정 시트를 연다. 없으면 메뉴에 "로그아웃"만. */
  onOpenSettings?: () => void;
};

/**
 * 사이드바 (DESIGN.md#2, D-034·D-035). 상단 "+ 새 방", 방 목록(하단 도달 시 다음 페이지), 하단 우측 프로필 버튼(아바타+닉네임) → 위로 뜨는 메뉴 "설정" · "로그아웃".
 * 메뉴 닫힘 규칙은 방 목록 … 메뉴와 같다(`useMenu`). 데스크톱은 우측 고정 280, 모바일은 ChatShell 우측 드로어 안에 같은 컴포넌트.
 */
export function Sidebar({ onOpenSettings }: Props) {
  const pathname = usePathname();
  const active = activeRoomId(pathname);
  const rooms = useRooms();
  const create = useCreateRoom();
  const me = useMe();
  const logout = useLogout();
  const [now] = useState(() => new Date());
  const sentinel = useRef<HTMLDivElement>(null);
  const { open: menuOpen, toggle: toggleMenu, close: closeMenu, menuRef, triggerRef, menuProps } = useMenu();

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
          <Skeleton lines={4} label="방 목록 불러오는 중..." />
        ) : rooms.rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Avatar kind="ai" size={40} />
            <p className="text-[15px] text-muted break-keep">아직 방이 없네? 하나 만들자!</p>
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

      <div className="relative flex shrink-0 justify-end pt-2">
        {me.data ? (
          <button
            ref={triggerRef}
            type="button"
            aria-label={`${me.data.nickname} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
            className="flex h-11 max-w-full items-center gap-2 rounded-full pr-3 pl-1.5 outline-offset-2 hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-accent aria-expanded:bg-ink/6"
          >
            <Avatar name={me.data.nickname} size={32} />
            <span className="min-w-0 truncate text-[15px] font-medium">{me.data.nickname}</span>
            <CaretUp size={14} weight="bold" aria-hidden="true" className={`shrink-0 text-muted motion-safe:transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <span className="h-11" />
        )}
        {menuOpen && (
          <div
            ref={menuRef}
            {...menuProps}
            aria-label="계정"
            className="bubble-in absolute right-0 bottom-full z-10 mb-1 flex w-40 flex-col rounded-2xl border border-ink/12 bg-bg p-1"
          >
            {onOpenSettings && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onOpenSettings();
                }}
                className="h-11 rounded-xl px-3 text-left text-[15px] text-ink outline-offset-[-2px] hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-accent"
              >
                설정
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={logout.isPending}
              onClick={() => {
                closeMenu();
                logout.mutate();
              }}
              className="h-11 rounded-xl px-3 text-left text-[15px] text-ink outline-offset-[-2px] hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarRoomItem({ room, active, now }: { room: RoomListItemData; active: boolean; now: Date }) {
  const patch = usePatchRoom(room.id);
  const leave = useLeaveRoom(room.id);
  const show = useToastStore((s) => s.show);
  const fail = () => show(GENERIC_ERROR, 'error');

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
