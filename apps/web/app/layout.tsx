import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '뒷담 친구',
  description: '뒷담화 전문 AI 친구. 말로 걸어도 되고 글로 걸어도 됨.',
  applicationName: '뒷담 친구',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '뒷담 친구' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff4f8' },
    { media: '(prefers-color-scheme: dark)', color: '#170611' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // iOS safe-area (하단 입력창 고정용)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
