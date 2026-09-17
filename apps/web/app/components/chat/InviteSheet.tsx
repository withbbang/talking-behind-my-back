'use client';

import { useState } from 'react';
import { GENERIC_ERROR } from '@/lib/copy';
import { Copy } from '@phosphor-icons/react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { QrCode } from '@/components/ui/QrCode';
import { Sheet } from '@/components/ui/Sheet';
import { useToastStore } from '@/components/ui/Toast';
import type { Room } from '@/features/rooms/types';
import { useRegenerateInvite } from '@/features/rooms/useInvite';

/** "K7Q2M9XW" → "K7Q2 M9XW" (읽기용, 복사는 원문). */
export function groupCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * 초대 공유 시트 (DESIGN.md#4, 개설자 전용). QR · 코드 · 링크 복사 · 공유(가능할 때만) · 코드 재발급.
 * room 은 부모(ChatShell)가 캐시에서 넘긴다 — 재발급이 캐시를 바꾸면 여기도 다시 그려진다.
 */
export function InviteSheet({ room, open, onClose }: { room: Room; open: boolean; onClose: () => void }) {
  const show = useToastStore((s) => s.show);
  const regenerate = useRegenerateInvite(room.id);
  const [confirming, setConfirming] = useState(false);
  const code = room.inviteCode ?? '';
  const url = room.inviteUrl ?? '';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show('복사 완료');
    } catch {
      show(GENERIC_ERROR, 'error');
    }
  };
  const share = () => navigator.share({ title: room.title, url }).catch(() => {}); // 사용자가 시트를 닫으면 AbortError — 무시
  const confirmRegenerate = () =>
    regenerate.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: () => {
        setConfirming(false);
        show(GENERIC_ERROR, 'error');
      },
    });

  return (
    <>
      <Sheet open={open} onClose={onClose} label="친구 데려오기">
        <div className="flex flex-col items-center gap-5">
          <h2 className="self-start text-[17px] leading-snug font-semibold">친구 데려오기</h2>

          <div className="rounded-2xl p-4" style={{ background: 'var(--qr-bg)' }}>
            <QrCode value={url} size={200} label="초대 QR" />
          </div>

          <div className="flex items-center gap-2">
            <span aria-label={`초대 코드 ${code}`} className="text-2xl font-bold tracking-[0.12em] tabular-nums">
              {groupCode(code)}
            </span>
            <button
              type="button"
              aria-label="코드 복사"
              onClick={() => void copy(code)}
              className="flex size-11 items-center justify-center rounded-full text-muted outline-offset-[-3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Copy size={22} weight="bold" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => void copy(url)}
              className="h-13 w-full rounded-2xl bg-surface text-base font-semibold text-on-surface outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform"
            >
              링크 복사
            </button>
            {canShare && (
              <button
                type="button"
                onClick={() => void share()}
                className="h-13 w-full rounded-2xl border border-ink/12 text-base font-semibold text-ink outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform"
              >
                공유하기
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-11 rounded-full px-3 text-[15px] text-muted underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            코드 다시 만들기
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title={'이전 코드는 사용할 수 없어.\n새로 만들까?'}
        confirmLabel="새로 만들기"
        cancelLabel="취소"
        busy={regenerate.isPending}
        onConfirm={confirmRegenerate}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
