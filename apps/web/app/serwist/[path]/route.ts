import { createSerwistRoute } from '@serwist/turbopack';
import { OFFLINE_PATH } from '@/features/pwa/caching';

/**
 * `/serwist/sw.js` (T-014, D-039 1). Turbopack 은 webpack 플러그인을 못 쓰므로 Route Handler 로 워커를 내준다.
 * `force-static` 이라 `next build` 때 한 번 번들되고, 런타임(standalone 이미지)에서는 esbuild 가 돌지 않는다.
 * `Service-Worker-Allowed: /` 헤더는 라이브러리가 붙인다.
 *
 * revision: /~offline 은 정적 HTML 이라 매니페스트 해시가 없다 — 빌드마다 바뀌는 값을 줘야 새 배포에서 갱신된다.
 * git rev 는 Docker 빌드 컨텍스트(apps/web)에 .git 이 없어 못 쓴다 → 빌드 시각.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  additionalPrecacheEntries: [{ url: OFFLINE_PATH, revision: String(Date.now()) }],
  useNativeEsbuild: true,
  esbuildOptions: { sourcemap: false }, // sw.js.map 을 공개 경로로 내지 않는다
});
