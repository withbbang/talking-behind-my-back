'use client';

import { useRouter } from 'next/navigation';
import { GENERIC_ERROR } from '@/lib/copy';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useToastStore } from '@/components/ui/Toast';
import { joinErrorMessage } from '@/features/rooms/joinErrorMessage';
import { useJoinPreview, useJoinRoom } from '@/features/rooms/useInvite';

const BTN = 'h-13 w-full rounded-2xl text-base font-semibold outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-60';

/**
 * 입장 화면 (DESIGN.md#5, D-021 E1). 로그인과 같은 골격 — 제목 "초대장 도착", 소개문 2줄, 하단 말풍선 시트.
 * 말풍선은 개설자가 말 거는 장면: 꼬리 발치에 개설자 아바타. 시트 안은 미리보기 / 실패 문구 / 스켈레톤 중 하나.
 * 실패는 알려진 코드(BRAND 표) 면 "내 방 가기", 모르는 오류면 "다시"(재조회). 입장 단계 실패도 같은 규칙.
 */
export function JoinClient({ code }: { code: string }) {
  const router = useRouter();
  const show = useToastStore((s) => s.show);
  const preview = useJoinPreview(code);
  const join = useJoinRoom(code);
  const [joinError, setJoinError] = useState<string | null>(null);

  const error = preview.isError ? preview.error : null;
  const knownMessage = joinError ?? (error ? joinErrorMessage(error) : null);
  const owner = preview.data?.ownerNickname ?? null;

  const enter = () =>
    join.mutate(undefined, {
      onError: (e) => {
        const known = joinErrorMessage(e);
        if (known) setJoinError(known);
        else show(GENERIC_ERROR, 'error');
      },
    });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-between px-5 pt-24 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="px-1">
        <h1 className="text-center text-[clamp(3rem,15vw,4.5rem)] leading-none font-extrabold tracking-[-0.05em] break-keep">초대장 도착</h1>
        <p className="mt-5 text-right text-[17px] leading-snug text-muted break-keep">
          <span className="block">{owner ? `${owner}의 방` : ' '}</span>
          <span className="block">같이 뒷담화하자!</span>
        </p>
      </header>

      <section aria-label="초대장" className="bubble-in relative">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-5 text-on-surface">
          {preview.isPending ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              <span className="sr-only">초대장 확인 중...</span>
              <div className="h-6 w-2/3 animate-pulse rounded-xl bg-on-surface/15" />
              <div className="h-13 animate-pulse rounded-2xl bg-on-surface/15" />
            </div>
          ) : knownMessage ? (
            <>
              <p className="text-[17px] leading-snug font-semibold break-keep">{knownMessage}</p>
              <button type="button" onClick={() => router.push('/')} className={`${BTN} border border-on-surface/30 text-on-surface`}>
                내 방 가기
              </button>
            </>
          ) : preview.data ? (
            <>
              <div>
                <p className="text-[17px] leading-snug font-semibold break-keep">{preview.data.title}</p>
                <p className="mt-1 text-[13px] text-on-surface/70 tabular-nums">멤버 {preview.data.memberCount}/2</p>
              </div>
              <button type="button" onClick={enter} disabled={join.isPending} className={`${BTN} bg-bg text-ink`}>
                들어가기
              </button>
            </>
          ) : (
            <>
              <p className="text-[17px] leading-snug font-semibold break-keep">시스템 오류. 다시 시도해줄래?</p>
              <button type="button" onClick={() => void preview.refetch()} className={`${BTN} bg-bg text-ink`}>
                다시
              </button>
            </>
          )}
        </div>
        <svg viewBox="0 0 40 24" className="absolute -bottom-[18px] left-8 h-6 w-10 text-surface" aria-hidden="true">
          <path fill="currentColor" d="M0 0h40c-8 3-16 12-20 24C18 14 10 5 0 0z" />
        </svg>
        {owner && (
          <span className="absolute -bottom-[38px] left-1">
            <Avatar name={owner} size={28} />
          </span>
        )}
      </section>
    </main>
  );
}
