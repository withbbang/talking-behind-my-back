/**
 * 전체 페이지 이동. 로그인/로그아웃처럼 proxy.ts 가 쿠키를 다시 봐야 하는 전환에 쓴다.
 * 클라이언트 라우팅(router.push)은 RSC 페치라 쿠키 재평가·React Query 캐시 폐기가 보장되지 않는다.
 * 별도 모듈로 둔 이유: jsdom 은 location 이동을 구현하지 않아 테스트에서 vi.mock 으로 바꾼다.
 */
export function hardNavigate(path: string): void {
  window.location.replace(path);
}
