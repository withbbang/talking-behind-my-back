'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';
import { SW_URL } from './caching';

/**
 * 서비스워커 등록 (T-014, D-039 4).
 * - development 는 등록하지 않는다 — HMR 과 로컬 실측이 캐시에 오염되는 것을 막는다.
 * - reloadOnOnline=false: 온라인 복귀 시 통째로 새로고침하면 SSE 스트림·입력 중 텍스트가 날아간다.
 *   재연결은 lib/sse.ts 의 백오프가 담당한다.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const disable = process.env.NODE_ENV !== 'production';
  return (
    <SerwistProvider swUrl={SW_URL} disable={disable} reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
