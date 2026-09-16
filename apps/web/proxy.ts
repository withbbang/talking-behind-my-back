import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/authCookies';
import { safeNextPath } from '@/lib/nextPath';

/**
 * 라우트 가드 (T-005). Next 16 규약: middleware.ts → proxy.ts (Homepage 와 동일).
 *
 * access 쿠키의 "존재" 만 본다. 서명·만료 검증은 API(JwtAuthFilter) 몫이고, 만료 access 는
 * lib/api.ts 가 401 → refresh → 재시도로 처리한다.
 *
 * refresh 쿠키는 Path=/api/auth 라 페이지 요청에 실리지 않는다 → 여기서 서버 재발급은 불가능.
 * access 쿠키(Max-Age 15m)가 사라진 콜드 오픈은 /login 으로 보내고, /login 페이지가 마운트 시
 * POST /api/auth/refresh 를 한 번 시도해(silent refresh) 세션을 되살린다 (TASKS.md#T-005 note).
 *
 * T-018 (D-021): 미인증 보호 경로는 `/login?next=<경로+쿼리>` 로 보낸다(`/` 는 기본 목적지라 생략).
 * 로그인 페이지가 그 값을 소셜 시작 URL `?next=` 로 넘기고 api 콜백이 그리로 302 한다. 이미 로그인된 채
 * `/login?next=` 로 오면 여기서 바로 next 로. next 는 상대경로만(safeNextPath) — open redirect 방지.
 */
export function proxy(request: NextRequest): NextResponse {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === '/login';

  if (!hasAccess && !isLogin) {
    const login = new URL('/login', request.url);
    const next = safeNextPath(pathname + search);
    if (next && next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }
  if (hasAccess && isLogin) {
    const next = safeNextPath(request.nextUrl.searchParams.get('next')) ?? '/';
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 페이지만. /api 는 nginx 가 api 로 직접 보내므로 여기 오지 않지만 next dev 직접 접근 대비 제외.
  // _next 정적 자원, manifest, 확장자 있는 파일(아이콘 등)도 제외.
  matcher: ['/((?!api|_next/static|_next/image|manifest\\.webmanifest|.*\\.[\\w]+$).*)'],
};
