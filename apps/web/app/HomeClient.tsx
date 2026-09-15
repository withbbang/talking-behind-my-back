'use client';

import { PROVIDER_LABEL } from '@/features/auth/types';
import { useLogout } from '@/features/auth/useLogout';
import { useMe } from '@/features/auth/useMe';

/** 임시 홈 — 세션 유지 확인용. T-008 채팅 셸이 교체한다. */
export function HomeClient() {
  const me = useMe();
  const logout = useLogout();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-between px-5 pt-24 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-[clamp(3rem,15vw,4.5rem)] leading-none font-extrabold tracking-[-0.05em] break-keep">
          {me.data ? me.data.nickname : '…'}
        </h1>
        {me.data && (
          <p className="mt-5 text-[17px] leading-snug text-muted break-keep">
            {PROVIDER_LABEL[me.data.provider]} 계정으로 로그인됨. 채팅은 T-008 에서.
          </p>
        )}
        {me.data?.status === 'SUSPENDED' && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
            이용이 정지된 계정이에요. 문의가 필요하면 관리자에게 연락해주세요.
          </p>
        )}
      </header>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="h-13 w-full rounded-2xl bg-surface text-[15px] font-semibold text-on-surface outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-50"
      >
        로그아웃
      </button>
    </main>
  );
}
