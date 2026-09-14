import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Me } from './types';

export const ME_QUERY_KEY = ['me'] as const;

/** 현재 사용자. 401 은 lib/api.ts 가 refresh → 실패 시 /login 이동까지 처리한다. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<Me>('/auth/me'),
  });
}
