// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { ACCESS_COOKIE } from '@/lib/authCookies';

// proxy.ts 계약 (T-005 acceptance): access 쿠키 "존재" 만 검사한다. 유효성 검증은 API 몫.
//  - 쿠키 없음 + 보호 경로 → 302 /login
//  - 쿠키 없음 + /login → 통과
//  - 쿠키 있음 + /login → 302 / (또는 유효한 ?next=)
//  - 쿠키 있음 + 보호 경로 → 통과
//  T-022/T-018 (D-021): 미인증 보호 경로(/ 제외)는 /login?next=<경로+쿼리> 로. next 는 상대경로만.

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

  it('access 쿠키 없이 /join/{code} → /login?next=/join/{code}', () => {
    const res = proxy(request('/join/K7Q2M9XW', false));
    const url = new URL(res.headers.get('location')!);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/join/K7Q2M9XW');
  });

  it('쿼리가 있는 보호 경로는 쿼리까지 next 에 싣는다', () => {
    const res = proxy(request('/rooms/1?tab=info', false));
    expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/rooms/1?tab=info');
  });

  it('/ 는 next 없이 /login 으로 (기본 목적지라 불필요)', () => {
    const res = proxy(request('/', false));
    expect(new URL(res.headers.get('location')!).searchParams.has('next')).toBe(false);
  });

  it('access 쿠키 있고 /login?next=/join/X → /join/X 로', () => {
    const res = proxy(request('/login?next=%2Fjoin%2FK7Q2M9XW', true));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/join/K7Q2M9XW');
  });

  it('access 쿠키 있고 /login?next=<절대URL> → / 로 (open redirect 방지)', () => {
    const res = proxy(request('/login?next=https%3A%2F%2Fevil.example', true));
    const url = new URL(res.headers.get('location')!);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe('/');
  });

  it('빈 값 access 쿠키는 없는 것으로 본다', () => {
    const res = proxy(new NextRequest('http://localhost:3000/', { headers: { cookie: `${ACCESS_COOKIE}=` } }));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });
});
