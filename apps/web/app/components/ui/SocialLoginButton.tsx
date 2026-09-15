import type { ReactNode } from 'react';

export type SocialProvider = 'google' | 'naver' | 'kakao';

/**
 * 소셜 로그인 버튼 (DESIGN.md#로그인, 컴포넌트 목록 SocialLoginButton).
 * a 태그 전체 페이지 이동 — OAuth 302 체인은 fetch 로 따라가면 깨진다.
 * 색은 각사 브랜드 가이드 값. 아이콘은 인라인 SVG 근사치(디자이너 확정 후 교체 가능).
 */
const BRAND: Record<SocialProvider, { label: string; className: string; icon: ReactNode }> = {
  google: {
    label: '구글로 시작하기',
    className: 'bg-white text-[#1f1f1f]',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.2c-1.7 3.4-1.7 7.4 0 10.8l4.1-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
    ),
  },
  naver: {
    label: '네이버로 시작하기',
    className: 'bg-[#03C75A] text-white',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="currentColor" d="M15.6 12.9 8.1 2.5H2v19h6.4V11.1l7.5 10.4H22v-19h-6.4z" />
      </svg>
    ),
  },
  kakao: {
    label: '카카오로 시작하기',
    className: 'bg-[#FEE500] text-[#191919]',
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.87 5.32 4.68 6.74l-.96 3.56c-.08.3.26.54.52.37l4.2-2.8c.51.06 1.03.1 1.56.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"
        />
      </svg>
    ),
  },
};

export function SocialLoginButton({ provider }: { provider: SocialProvider }) {
  const { label, className, icon } = BRAND[provider];
  return (
    <a
      href={`/api/oauth2/authorization/${provider}`}
      className={`flex h-13 w-full items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform ${className}`}
    >
      <span className="flex w-6 shrink-0 justify-center">{icon}</span>
      <span className="flex-1 text-center">{label}</span>
      <span className="w-6 shrink-0" />
    </a>
  );
}
