/**
 * 서비스워커 캐시 정책의 순수 판정 (T-014, D-039 2). sw.ts 의 runtimeCaching 매처가 이 함수들을 호출한다.
 * 워커 번들(esbuild)과 vitest 양쪽에서 쓰이므로 DOM·워커 전역에 기대지 않는다.
 */

export const SW_URL = '/serwist/sw.js';
export const OFFLINE_PATH = '/~offline';

/** 절대 캐시하지 않는 경로 — API(SSE·auth 포함, D-005), 어드민(D-005 impact), 워커 파일 자신. */
const NETWORK_ONLY = [/^\/api\//, /^\/admin(\/|$)/, /^\/serwist\//];

export function isNetworkOnly(pathname: string): boolean {
  return NETWORK_ONLY.some((re) => re.test(pathname));
}

/** 해시가 붙은 빌드 산출물 — 내용이 바뀌면 이름도 바뀌므로 CacheFirst 가 안전하다. */
export function isNextStatic(pathname: string): boolean {
  return pathname.startsWith('/_next/static/');
}

/** 홈화면 설치·아이콘에 쓰이는 셸 자원 — StaleWhileRevalidate. */
const SHELL_ASSETS = [/^\/icons\//, /^\/icon\.svg$/, /^\/apple-icon\.png$/, /^\/manifest\.webmanifest$/];

export function isShellAsset(pathname: string): boolean {
  return SHELL_ASSETS.some((re) => re.test(pathname));
}

interface DocumentInput {
  destination: RequestDestination | string;
  pathname: string;
  sameOrigin: boolean;
}

/** 앱 셸 문서(navigation). NetworkFirst + 실패 시 /~offline 폴백. /admin 은 캐시 밖. */
export function isShellDocument({ destination, pathname, sameOrigin }: DocumentInput): boolean {
  return sameOrigin && destination === 'document' && !isNetworkOnly(pathname);
}

interface RscInput {
  headers: Headers;
  pathname: string;
  sameOrigin: boolean;
}

/** App Router 의 RSC 페이로드(클라이언트 내비게이션). 문서와 같은 정책. */
export function isRscRequest({ headers, pathname, sameOrigin }: RscInput): boolean {
  return sameOrigin && headers.get('RSC') === '1' && !isNetworkOnly(pathname);
}
