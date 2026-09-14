/** GET /auth/me 응답 (API.md#auth). */
export type Provider = 'GOOGLE' | 'NAVER' | 'KAKAO';

export type Me = {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  provider: Provider;
};

export const PROVIDER_LABEL: Record<Provider, string> = {
  GOOGLE: '구글',
  NAVER: '네이버',
  KAKAO: '카카오',
};
