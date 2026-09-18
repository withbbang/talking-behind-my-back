'use client';

import { useParams, usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { List } from '@phosphor-icons/react';
import { Sheet } from '@/components/ui/Sheet';
import { useRoom } from '@/features/rooms/useRooms';
import { InviteSheet } from './InviteSheet';
import { RoomHeaderSheet } from './RoomHeaderSheet';
import { Sidebar } from './Sidebar';
import { ThemeRow } from './ThemePicker';

/**
 * 채팅 셸 (DESIGN.md#2, D-034·D-035). 모바일: 상단 바 56 = 중앙 제목(평문) + 우측 햄버거 → 우측 드로어(300, ink 40% 딤, 닫기 버튼 없음 — 딤 탭·Escape·경로 이동으로 닫힘). 데스크톱(≥1024): 우측 사이드바 280 고정.
 * 설정 시트는 사이드바 하단 톱니(로그아웃 왼쪽)로 연다 — 방 안이면 방 설정(제목·멤버·모드·테마·AI 성격), 방 밖이면 테마만.
 * 설정 시트 "초대" → 초대 공유 시트(T-018). 초대 시트는 친구가 들어오면(memberCount 2) 저절로 닫힌다 — 뒤에 "영희 등장!" 시스템 라인이 보이도록.
 * 보이스 토글은 컴포저(RoomView)로 옮겨졌다(D-034 1).
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const openSettings = () => {
    setOpen(false);
    setSettingsOpen(true);
  };
  const openInvite = () => {
    setSettingsOpen(false);
    setInviteOpen(true);
  };

  const title = roomId === null ? '뒷담 친구' : (room.data?.title ?? '…');

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-ink">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
          <span className="size-11 shrink-0 lg:hidden" aria-hidden="true" />
          <h1 className="min-w-0 flex-1 truncate px-2 text-center text-base font-semibold">{title}</h1>
          <button
            type="button"
            aria-label="메뉴"
            onClick={() => setOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
          >
            <List size={24} weight="bold" />
          </button>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>

      <aside className="hidden w-[280px] shrink-0 border-l border-ink/8 lg:block">
        <Sidebar onOpenSettings={openSettings} />
      </aside>

      {room.data ? (
        <RoomHeaderSheet room={room.data} open={settingsOpen} onClose={() => setSettingsOpen(false)} onInvite={openInvite} />
      ) : (
        <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} label="설정">
          <ThemeRow />
        </Sheet>
      )}
      {room.data?.inviteCode && (
        <InviteSheet room={room.data} open={inviteOpen && room.data.memberCount < 2} onClose={() => setInviteOpen(false)} />
      )}

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="방 목록"
            tabIndex={-1}
            ref={(el) => el?.focus()}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className="bubble-in absolute inset-y-0 right-0 w-[300px] max-w-[85vw] bg-bg pt-[env(safe-area-inset-top)] outline-none"
          >
            <Sidebar onOpenSettings={openSettings} />
          </div>
        </div>
      )}
    </div>
  );
}
