'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCreateRoom, useRooms } from '@/features/rooms/useRooms';

/** `/` — 방이 있으면 최신 방으로 replace, 없으면 빈 상태 (D-020). */
export function RootRedirect() {
  const router = useRouter();
  const rooms = useRooms();
  const create = useCreateRoom();
  const first = rooms.rooms[0];

  useEffect(() => {
    if (first) router.replace(`/rooms/${first.id}`);
  }, [first, router]);

  if (rooms.isPending || first) {
    return (
      <div className="px-4 pt-4">
        <Skeleton lines={3} label="불러오는 중..." lineClassName="h-12 w-3/4" />
      </div>
    );
  }

  return (
    <div className="bubble-in flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Avatar kind="ai" size={64} />
      <p className="text-[15px] text-muted break-keep">아직 방이 없네? 하나 만들자!</p>
      <button
        type="button"
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="h-13 rounded-2xl bg-surface px-8 text-base font-semibold text-on-surface outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-60"
      >
        + 새 방
      </button>
    </div>
  );
}
