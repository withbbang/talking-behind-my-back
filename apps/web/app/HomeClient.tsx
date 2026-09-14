'use client';

import { PROVIDER_LABEL } from '@/features/auth/types';
import { useLogout } from '@/features/auth/useLogout';
import { useMe } from '@/features/auth/useMe';

/** 임시 홈 — 세션 유지 확인용. T-008 채팅 셸이 교체한다. */
export function HomeClient() {
  const me = useMe();
  const logout = useLogout();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-between px-6 pt-20 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] break-keep">
          {me.data ? me.data.nickname : '…'}
        </h1>
        {me.data && (
          <p className="mt-4 text-base break-keep opacity-70">
            {PROVIDER_LABEL[me.data.provider]} 계정으로 로그인됨. 채팅은 T-008 에서.
          </p>
        )}
        {me.data?.status === 'SUSPENDED' && (
          <p role="alert" className="mt-4 rounded-lg bg-[#b3261e]/10 px-4 py-3 text-sm text-[#b3261e] dark:text-[#f2b8b5]">
            이용이 정지된 계정이에요. 문의가 필요하면 관리자에게 연락해주세요.
          </p>
        )}
      </header>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="h-13 w-full rounded-xl border border-current text-[15px] font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-current disabled:opacity-50"
      >
        로그아웃
      </button>
    </main>
  );
}
