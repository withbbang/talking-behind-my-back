/**
 * 인증 쿠키 이름 (API.md#공통, api AuthCookies.java 와 동일).
 * proxy.ts(edge) 에서도 import 하므로 의존성 없이 상수만 둔다.
 * refresh_token 은 Path=/api/auth 라 페이지 요청에는 실리지 않는다 — proxy 는 access 만 본다.
 */
export const ACCESS_COOKIE = 'access_token';
