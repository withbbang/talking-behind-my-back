import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastHost } from '@/components/ui/Toast';
import Script from 'next/script';
import { ThemeSync } from '@/lib/theme';
import { THEME_INIT_SCRIPT } from '@/lib/themeInit';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '뒷담 친구',
  description: '뒷담화 전문 AI 친구. 무엇이든지 이야기 해도 돼!',
  applicationName: '뒷담 친구',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '뒷담 친구' },
};

/**
 * themeColor 는 여기 두지 않는다(T-020). Next 가 만드는 media 별 <meta> 2개는 수동 테마를 반영 못 하고,
 * React 가 렌더한 meta 를 hydration 전에 바꾸면 중복이 생긴다(실측). <meta name="theme-color"> 는 <ThemeSync/> 가
 * hydration 뒤 만들고 lib/theme 이 갱신한다 — React 가 모르는 노드라 hoistable 충돌 없음.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // iOS safe-area (하단 입력창 고정용)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전 localStorage 테마 적용 — 깜빡임 방지 (T-020). suppressHydrationWarning 은 data-theme 때문. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="antialiased">
        <ThemeSync />
        <Providers>
          {children}
          <ToastHost />
        </Providers>
      </body>
    </html>
  );
}
