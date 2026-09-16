import type { Metadata } from 'next';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = { title: '로그인' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/login?error=<code>&next=<경로>` — 서버에서 읽어 넘긴다(useSearchParams 의 Suspense 경계 불필요). next 정제는 LoginClient. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, next } = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return <LoginClient error={one(error)} next={one(next)} />;
}
