import type { MetadataRoute } from 'next';

// PWA manifest. 아이콘은 public/icons/*.png(192/512/maskable), 파비콘은 app/icon.svg, iOS 는 app/apple-icon.png.
// 서비스워커는 T-014 (Next 16 호환 확인 후).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '뒷담 친구',
    short_name: '뒷담 친구',
    description: '뒷담화 전문 AI 친구. 말로 걸어도 되고 글로 걸어도 됨.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff4f8',
    theme_color: '#ff3d7f',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
