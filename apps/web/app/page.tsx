import { HomeClient } from './HomeClient';

// 임시 진입 페이지. T-008(채팅 셸 + draft 방)에서 교체된다. 라우트 가드는 proxy.ts.
export default function Home() {
  return <HomeClient />;
}
