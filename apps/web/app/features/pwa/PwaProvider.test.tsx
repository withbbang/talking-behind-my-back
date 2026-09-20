import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// 서비스워커 등록 (T-014, D-039 4). production 에서만 /serwist/sw.js 를 등록한다.
// development 는 HMR·실측 오염 방지로 등록하지 않는다.

// @serwist/window 가 register() 결과의 waiting/installing/active 를 읽는다 — 최소 형태의 registration.
const registration = { waiting: null, installing: null, active: null, addEventListener: vi.fn(), update: vi.fn() };
const register = vi.fn().mockResolvedValue(registration);

beforeEach(() => {
  register.mockClear();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, controller: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), getRegistration: vi.fn() },
  });
  // @serwist/window 는 window.serwist 에 인스턴스를 캐시한다 — 케이스 간 격리.
  delete (window as unknown as { serwist?: unknown }).serwist;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('PwaProvider', () => {
  it('production: /serwist/sw.js 를 scope / 로 등록', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { PwaProvider } = await import('./PwaProvider');
    render(<PwaProvider><span>x</span></PwaProvider>);
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register.mock.calls[0][0]).toBe('/serwist/sw.js');
    expect(register.mock.calls[0][1]).toMatchObject({ scope: '/' });
  });

  it('development: 등록하지 않는다', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { PwaProvider } = await import('./PwaProvider');
    const { getByText } = render(<PwaProvider><span>x</span></PwaProvider>);
    await new Promise((r) => setTimeout(r, 20));
    expect(register).not.toHaveBeenCalled();
    expect(getByText('x')).toBeInTheDocument();
  });
});
