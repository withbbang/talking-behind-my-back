import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/authCookies';

/**
 * 라우트 가드 (T-005). Next 16 규약: middleware.ts → proxy.ts (Homepage 와 동일).
 *
 * access 쿠키의 "존재" 만 본다. 서명·만료 검증은 API(JwtAuthFilter) 몫이고, 만료 access 는
 * lib/api.ts 가 401 → refresh → 재시도로 처리한다.
 *
 * refresh 쿠키는 Path=/api/auth 라 페이지 요청에 실리지 않는다 → 여기서 서버 재발급은 불가능.
 * access 쿠키(Max-Age 15m)가 사라진 콜드 오픈은 /login 으로 보내고, /login 페이지가 마운트 시
 * POST /api/auth/refresh 를 한 번 시도해(silent refresh) 세션을 되살린다 (TASKS.md#T-005 note).
 */
export function proxy(request: NextRequest): NextResponse {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === '/login';

  if (!hasAccess && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasAccess && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 페이지만. /api 는 nginx 가 api 로 직접 보내므로 여기 오지 않지만 next dev 직접 접근 대비 제외.
  // _next 정적 자원, manifest, 확장자 있는 파일(아이콘 등)도 제외.
  matcher: ['/((?!api|_next/static|_next/image|manifest\\.webmanifest|.*\\.[\\w]+$).*)'],
};
