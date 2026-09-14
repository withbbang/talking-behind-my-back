import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrorMessage';

// `/login?error=<code>` (API.md#auth) → 사용자에게 보여줄 한 줄. 순수 함수.
describe('loginErrorMessage', () => {
  it('error 없으면 null', () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage('')).toBeNull();
  });

  it('access_denied → 취소 안내', () => {
    expect(loginErrorMessage('access_denied')).toBe('로그인을 취소했어요. 다시 시도할 수 있어요.');
  });

  it('authorization_request_not_found → 시간 초과 안내', () => {
    expect(loginErrorMessage('authorization_request_not_found')).toBe(
      '로그인 시간이 지났어요. 처음부터 다시 해주세요.',
    );
  });

  it('그 외 코드는 공통 실패 메시지', () => {
    expect(loginErrorMessage('oauth_failed')).toBe('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
    expect(loginErrorMessage('server_error')).toBe('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
  });

  it('배열(중복 쿼리)이면 첫 값만 본다', () => {
    expect(loginErrorMessage(['access_denied', 'oauth_failed'])).toBe('로그인을 취소했어요. 다시 시도할 수 있어요.');
  });
});
