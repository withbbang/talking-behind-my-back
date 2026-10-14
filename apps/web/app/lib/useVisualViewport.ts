'use client';

import { useEffect } from 'react';

/**
 * 보이는 영역(visual viewport) 높이·오프셋을 `<html>` 의 CSS 변수 `--vvh`/`--vvt` 로 내린다 (T-050).
 * iOS Safari 는 키보드가 떠도 `100dvh`(layout viewport)를 줄이지 않고 visual viewport 만 줄인 뒤 페이지를 팬한다 —
 * 그래서 전송 직후(포커스 유지, T-034) 입력창이 키보드 뒤에 숨거나, 입력창을 탭하면 헤더·최근 메시지가 화면 밖으로 밀렸다.
 * 채팅 셸이 이 변수로 높이를 잡고 오프셋만큼 내려 앉으면 항상 "보이는 영역" 에 꽉 찬다. 미지원 환경은 CSS 폴백(100dvh, 0).
 */
export function useVisualViewportVars() {
  useEffect(() => {
    const vv = globalThis.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const sync = () => {
      root.setProperty('--vvh', `${vv.height}px`);
      root.setProperty('--vvt', `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      root.removeProperty('--vvh');
      root.removeProperty('--vvt');
    };
  }, []);
}
