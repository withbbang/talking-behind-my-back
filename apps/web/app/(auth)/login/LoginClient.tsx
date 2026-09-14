'use client';

import { useEffect, useState } from 'react';
import { SocialLoginButton } from '@/components/ui/SocialLoginButton';
import { loginErrorMessage } from '@/features/auth/loginErrorMessage';
import { silentRefresh } from '@/features/auth/session';
import { hardNavigate } from '@/lib/navigation';

/**
 * 로그인 화면 본문 (DESIGN.md#로그인).
 * - error 없이 열렸으면 silent refresh 1회: 성공 → / 전체 이동, 실패 → 버튼 노출.
 * - error 가 있으면 사용자가 방금 로그인을 시도한 것이라 refresh 를 건너뛰고 알림부터 보여준다.
 */
export function LoginClient({ error }: { error: string | null }) {
  const message = loginErrorMessage(error ?? undefined);
  const [checking, setChecking] = useState(message === null);

  useEffect(() => {
    if (message !== null) return;
    let cancelled = false;
    silentRefresh().then((ok) => {
      if (cancelled) return;
      if (ok) {
        hardNavigate('/');
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [message]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-between px-6 pt-20 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-[clamp(2rem,9vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] break-keep">
          김영선
          <br />
          욕하는 앱
        </h1>
        <p className="mt-4 text-base break-keep opacity-70">김영선 뒷담화 전문 AI 친구. 말로 걸어도 되고 글로 걸어도 됨.</p>
      </header>

      <section aria-label="로그인" className="flex flex-col gap-3">
        {message && (
          <p role="alert" className="rounded-lg bg-[#b3261e]/10 px-4 py-3 text-sm text-[#b3261e] dark:text-[#f2b8b5]">
            {message}
          </p>
        )}
        {checking ? (
          <div role="status" className="flex flex-col gap-3" aria-live="polite">
            <span className="sr-only">로그인 확인 중</span>
            <div className="h-13 animate-pulse rounded-xl bg-current opacity-10" />
            <div className="h-13 animate-pulse rounded-xl bg-current opacity-10" />
            <div className="h-13 animate-pulse rounded-xl bg-current opacity-10" />
          </div>
        ) : (
          <>
            <SocialLoginButton provider="google" />
            <SocialLoginButton provider="naver" />
            <SocialLoginButton provider="kakao" />
          </>
        )}
      </section>
    </main>
  );
}
