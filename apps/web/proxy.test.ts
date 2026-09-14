// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { ACCESS_COOKIE } from '@/lib/authCookies';

// proxy.ts 계약 (T-005 acceptance): access 쿠키 "존재" 만 검사한다. 유효성 검증은 API 몫.
//  - 쿠키 없음 + 보호 경로 → 302 /login
//  - 쿠키 없음 + /login → 통과
//  - 쿠키 있음 + /login → 302 /
//  - 쿠키 있음 + 보호 경로 → 통과

function request(path: string, withAccess: boolean): NextRequest {
  const headers = withAccess ? { cookie: `${ACCESS_COOKIE}=dummy` } : undefined;
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('proxy', () => {
  it('access 쿠키 없이 보호 경로 접근 → /login 으로 302', () => {
    const res = proxy(request('/', false));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('access 쿠키 없이 /rooms/1 접근 → /login 으로', () => {
    const res = proxy(request('/rooms/1', false));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('access 쿠키 없이 /login 접근 → 통과', () => {
    const res = proxy(request('/login', false));
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('access 쿠키 있고 /login 접근 → / 로 302', () => {
    const res = proxy(request('/login', true));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('access 쿠키 있고 보호 경로 접근 → 통과', () => {
    const res = proxy(request('/', true));
    expect(res.headers.get('location')).toBeNull();
  });

  it('빈 값 access 쿠키는 없는 것으로 본다', () => {
    const res = proxy(new NextRequest('http://localhost:3000/', { headers: { cookie: `${ACCESS_COOKIE}=` } }));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });
});
