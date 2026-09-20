import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

/**
 * '/api/*' rewrite 는 두지 않는다 (Homepage X21 결함에서 배움).
 * Next rewrite 로 프록시된 text/event-stream 은 0바이트로 도착해 SSE 채팅이 깨진다.
 * 로컬도 운영과 같은 구조로 nginx 가 :3000 을 잡고 next dev(:3001) / api(:8080) 로 나눠 보낸다.
 *   → infra/docker-compose.dev.yml 의 nginx-dev + infra/nginx/dev.conf
 */
const nextConfig: NextConfig = {
  output: 'standalone', // Dockerfile runner 스테이지가 .next/standalone 을 사용
  reactStrictMode: true,
};

// T-014 (D-039): 서비스워커. withSerwist 는 esbuild 를 serverExternalPackages 에 넣는 것만 한다.
// 워커 번들·프리캐시 매니페스트는 app/serwist/[path]/route.ts 가 빌드 시 만든다 (Turbopack 은 webpack 플러그인 불가).
export default withSerwist(nextConfig);
