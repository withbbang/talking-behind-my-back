import { RootRedirect } from './RootRedirect';

// `/` — 라우트 가드는 proxy.ts. 최신 방으로 이동하거나 빈 상태 (D-020).
export default function Home() {
  return <RootRedirect />;
}
