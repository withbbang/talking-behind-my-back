'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/queryClient';
import { PwaProvider } from '@/features/pwa/PwaProvider';

export function Providers({ children }: { children: ReactNode }) {
  // useState 가 아닌 getQueryClient: Suspense 로 첫 렌더가 버려져도 브라우저 캐시는 유지 (B-6b).
  const queryClient = getQueryClient();
  return (
    <PwaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PwaProvider>
  );
}
