import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '김영선 욕하는 앱',
  description: '김영선 뒷담화 전문 AI 친구. 말로 걸어도 되고 글로 걸어도 됨.',
  applicationName: '김영선 욕하는 앱',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '욕하는 앱' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // iOS safe-area (하단 입력창 고정용)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
