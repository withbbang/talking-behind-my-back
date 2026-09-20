import { describe, expect, it } from 'vitest';
import { isNetworkOnly, isNextStatic, isShellAsset, isShellDocument, isRscRequest } from './caching';

// sw.ts 의 runtimeCaching 매처가 쓰는 순수 판정 (T-014, D-039 2).
//  - /api/**, /admin/**, /serwist/** 는 절대 캐시하지 않는다(SSE·auth·워커 자신).
//  - 앱 셸 문서(navigation)·RSC 는 NetworkFirst + /~offline 폴백. /admin 문서는 제외.
//  - /_next/static/** 은 해시 파일이라 CacheFirst. 아이콘·manifest 는 StaleWhileRevalidate.

describe('isNetworkOnly', () => {
  it.each(['/api/rooms', '/api/rooms/1/events', '/api/auth/refresh', '/admin', '/admin/users', '/serwist/sw.js'])(
    '%s → 네트워크 전용',
    (p) => expect(isNetworkOnly(p)).toBe(true),
  );
  it.each(['/', '/rooms/1', '/login', '/~offline', '/apiary', '/administrator-guide'])('%s → 캐시 대상 후보', (p) =>
    expect(isNetworkOnly(p)).toBe(false),
  );
});

describe('isNextStatic', () => {
  it('/_next/static/** 만', () => {
    expect(isNextStatic('/_next/static/chunks/app.js')).toBe(true);
    expect(isNextStatic('/_next/image?url=x')).toBe(false);
    expect(isNextStatic('/static/x.js')).toBe(false);
  });
});

describe('isShellAsset', () => {
  it.each(['/icons/icon-192.png', '/icon.svg', '/apple-icon.png', '/manifest.webmanifest'])('%s', (p) =>
    expect(isShellAsset(p)).toBe(true),
  );
  it('그 외 이미지·문서는 아님', () => {
    expect(isShellAsset('/rooms/1')).toBe(false);
    expect(isShellAsset('/api/x.png')).toBe(false);
  });
});

describe('isShellDocument', () => {
  it('같은 오리진 navigation 문서만', () => {
    expect(isShellDocument({ destination: 'document', pathname: '/rooms/1', sameOrigin: true })).toBe(true);
    expect(isShellDocument({ destination: 'document', pathname: '/', sameOrigin: true })).toBe(true);
  });
  it('/admin 문서·다른 오리진·문서 아닌 요청은 제외', () => {
    expect(isShellDocument({ destination: 'document', pathname: '/admin/users', sameOrigin: true })).toBe(false);
    expect(isShellDocument({ destination: 'document', pathname: '/', sameOrigin: false })).toBe(false);
    expect(isShellDocument({ destination: 'script', pathname: '/', sameOrigin: true })).toBe(false);
  });
});

describe('isRscRequest', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('RSC 헤더 + 같은 오리진 + 네트워크 전용 아님', () => {
    expect(isRscRequest({ headers: h({ RSC: '1' }), pathname: '/rooms/1', sameOrigin: true })).toBe(true);
  });
  it('헤더 없음·/api·다른 오리진은 제외', () => {
    expect(isRscRequest({ headers: h({}), pathname: '/rooms/1', sameOrigin: true })).toBe(false);
    expect(isRscRequest({ headers: h({ RSC: '1' }), pathname: '/api/rooms', sameOrigin: true })).toBe(false);
    expect(isRscRequest({ headers: h({ RSC: '1' }), pathname: '/rooms/1', sameOrigin: false })).toBe(false);
  });
});
