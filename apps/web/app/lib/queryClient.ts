import { QueryClient, isServer } from '@tanstack/react-query';

/**
 * React Query 클라이언트 (CONVENTIONS.md#프론트, Homepage B-6b).
 * 서버에서는 요청마다 새 인스턴스 — 모듈 최상위 싱글턴이면 SSR 시 사용자 간 캐시가 샌다.
 * 브라우저에서는 하나를 재사용해 Suspense 재렌더 때 캐시가 날아가지 않게 한다.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // 401 은 lib/api.ts 가 refresh 로 처리하므로 쿼리 레벨 재시도는 불필요.
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
