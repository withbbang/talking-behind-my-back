import type { Metadata } from 'next';
import { JoinClient } from './JoinClient';

export const metadata: Metadata = { title: '초대장 도착' };

/** `/join/{code}` — 미인증이면 proxy.ts 가 `/login?next=/join/{code}` 로 보낸다. 코드 형식 검증은 서버(404)가 한다. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinClient code={code} />;
}
