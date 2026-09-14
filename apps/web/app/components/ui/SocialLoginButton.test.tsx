import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialLoginButton } from './SocialLoginButton';

// 소셜 로그인은 a 태그 전체 페이지 이동 (T-005 acceptance). fetch/XHR 로 302 를 따라가면 OAuth 가 깨진다.
describe('SocialLoginButton', () => {
  it.each([
    ['google', '/api/oauth2/authorization/google', '구글로 시작하기'],
    ['naver', '/api/oauth2/authorization/naver', '네이버로 시작하기'],
    ['kakao', '/api/oauth2/authorization/kakao', '카카오로 시작하기'],
  ] as const)('%s → href %s, 라벨 "%s"', (provider, href, label) => {
    render(<SocialLoginButton provider={provider} />);

    const link = screen.getByRole('link', { name: label });
    expect(link).toHaveAttribute('href', href);
  });

  it('아이콘은 장식(aria-hidden)이라 접근성 이름에 섞이지 않는다', () => {
    render(<SocialLoginButton provider="kakao" />);

    const link = screen.getByRole('link', { name: '카카오로 시작하기' });
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
