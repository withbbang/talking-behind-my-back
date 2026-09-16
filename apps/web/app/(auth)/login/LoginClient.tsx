'use client';

import { useCallback, useEffect, useState } from 'react';
import { SocialLoginButton } from '@/components/ui/SocialLoginButton';
import { Toast } from '@/components/ui/Toast';
import { loginErrorMessage } from '@/features/auth/loginErrorMessage';
import { silentRefresh } from '@/features/auth/session';
import { hardNavigate } from '@/lib/navigation';

/**
 * 로그인 화면 본문 (DESIGN.md#로그인, 핑크 테마 A 안: 하단 말풍선이 버튼을 담는다).
 * - error 없이 열렸으면 silent refresh 1회: 성공 → / 전체 이동, 실패 → 버튼 노출.
 * - error 가 있으면 사용자가 방금 로그인을 시도한 것이라 refresh 를 건너뛰고 토스트로 알린다.
 */
export function LoginClient({ error }: { error: string | null }) {
  const message = loginErrorMessage(error ?? undefined);
  const [checking, setChecking] = useState(message === null);
  const [toast, setToast] = useState<string | null>(message);
  const closeToast = useCallback(() => setToast(null), []);

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
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-between px-5 pt-24 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <Toast message={toast} tone="error" onClose={closeToast} />

      <header className="px-1">
        <h1 className="text-center text-[clamp(3rem,15vw,4.5rem)] leading-none font-extrabold tracking-[-0.05em] break-keep">
          뒷담 친구
        </h1>
        <p className="mt-5 text-right text-[17px] leading-snug text-muted break-keep">
          뒷담화 전문 AI 친구
          <br />
          무엇이든지 이야기 해도 돼!
        </p>
      </header>

      {/* 말풍선: 면 + 왼쪽 아래 꼬리. 다크 모드는 surface/on-surface 가 반전된다. */}
      <section aria-label="로그인" className="bubble-in relative">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-4 text-on-surface">
          {checking ? (
            <div role="status" className="flex flex-col gap-3" aria-live="polite">
              <span className="sr-only">로그인 확인 중</span>
              <div className="h-13 animate-pulse rounded-2xl bg-on-surface/15" />
              <div className="h-13 animate-pulse rounded-2xl bg-on-surface/15" />
              <div className="h-13 animate-pulse rounded-2xl bg-on-surface/15" />
            </div>
          ) : (
            <>
              <SocialLoginButton provider="google" />
              <SocialLoginButton provider="naver" />
              <SocialLoginButton provider="kakao" />
            </>
          )}
        </div>
        <svg viewBox="0 0 40 24" className="absolute -bottom-[18px] left-8 h-6 w-10 text-surface" aria-hidden="true">
          <path fill="currentColor" d="M0 0h40c-8 3-16 12-20 24C18 14 10 5 0 0z" />
        </svg>
      </section>
    </main>
  );
}
