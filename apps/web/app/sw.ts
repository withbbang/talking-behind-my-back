/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * 서비스워커 (T-014, D-039). @serwist/turbopack 이 빌드 시 esbuild 로 번들하고 __SW_MANIFEST 에
 * 프리캐시 매니페스트(빌드 산출물 + /~offline)를 주입한다. `app/serwist/[path]/route.ts` 가 `/serwist/sw.js` 로 내준다.
 *
 * 정책은 serwist `defaultCache` 를 쓰지 않는다 — 기본값은 /api/* 를 NetworkFirst 로 캐시하려 들어
 * SSE·auth 응답이 캐시에 남을 수 있다. 판정 함수는 features/pwa/caching.ts (테스트 있음).
 */
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';
import { OFFLINE_PATH, isNetworkOnly, isNextStatic, isRscRequest, isShellAsset, isShellDocument } from './features/pwa/caching';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const runtimeCaching: RuntimeCaching[] = [
  // 1. API(SSE·auth)·어드민·워커 자신 — 절대 캐시 안 함. 가장 먼저 걸러야 아래 규칙에 안 잡힌다.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && isNetworkOnly(url.pathname),
    handler: new NetworkOnly(),
  },
  // 2. 해시 빌드 산출물 — 프리캐시에 없는 것(런타임 로드 청크)도 한 번 받으면 CacheFirst.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && isNextStatic(url.pathname),
    handler: new CacheFirst({
      cacheName: 'next-static',
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * DAY })],
    }),
  },
  // 3. 아이콘·manifest — 설치 화면용. 바뀌는 일이 드물어 SWR.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && isShellAsset(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: 'shell-assets',
      plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * DAY })],
    }),
  },
  // 4. 앱 셸 문서(navigation) — 네트워크 우선, 3초 안에 안 오면 캐시. 둘 다 없으면 fallbacks → /~offline.
  {
    matcher: ({ sameOrigin, request, url }) =>
      isShellDocument({ sameOrigin, destination: request.destination, pathname: url.pathname }),
    handler: new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * DAY })],
    }),
  },
  // 5. RSC 페이로드(클라이언트 내비게이션) — 문서와 같은 정책.
  {
    matcher: ({ sameOrigin, request, url }) =>
      isRscRequest({ sameOrigin, headers: request.headers, pathname: url.pathname }),
    handler: new NetworkFirst({
      cacheName: 'pages-rsc',
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * DAY })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true, // 새 배포가 곧바로 활성화되도록 (master push = NAS 배포)
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_PATH,
        matcher: ({ request }) => {
          const url = new URL(request.url);
          return isShellDocument({
            sameOrigin: url.origin === self.location.origin,
            destination: request.destination,
            pathname: url.pathname,
          });
        },
      },
    ],
  },
});

serwist.addEventListeners();
