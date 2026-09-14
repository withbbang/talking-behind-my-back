import type { Metadata } from 'next';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = { title: '로그인' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/login?error=<code>` — 서버에서 읽어 넘긴다(useSearchParams 의 Suspense 경계 불필요). */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const first = Array.isArray(error) ? error[0] : error;
  return <LoginClient error={first ?? null} />;
}
