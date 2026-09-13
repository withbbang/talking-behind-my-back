import type { MetadataRoute } from 'next';

// PWA manifest. 아이콘 파일은 public/icons/ 에 추가 필요 (DESIGN.md 미결: 앱 아이콘/스플래시).
// 서비스워커는 T-014 (Next 16 호환 확인 후).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '김영선 욕하는 앱',
    short_name: '욕하는 앱',
    description: '김영선 뒷담화 전문 AI 친구. 말로 걸어도 되고 글로 걸어도 됨.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
