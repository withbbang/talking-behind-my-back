import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setUnauthenticatedHandler } from './api';

// lib/api.ts 계약 (API.md#공통, T-001 acceptance):
//  - 항상 credentials: 'include', JSON 요청/응답
//  - 401 이면 POST /api/auth/refresh 를 1회 시도 → 성공 시 원 요청 재시도
//  - refresh 실패면 onUnauthenticated 호출 + ApiError(401) throw
//  - /auth/refresh 자체는 재시도하지 않는다
//  - 에러 본문 { code, message, details } → ApiError 로 매핑

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onUnauthenticated = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    onUnauthenticated.mockReset();
    setUnauthenticatedHandler(onUnauthenticated);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('200 이면 JSON 을 파싱해 돌려주고 credentials:include 로 호출한다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 1, nickname: '영선' }));

    const me = await apiFetch<{ id: number; nickname: string }>('/auth/me');

    expect(me).toEqual({ id: 1, nickname: '영선' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init?.credentials).toBe('include');
  });

  it('body 객체는 JSON 직렬화 + Content-Type 을 붙인다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiFetch('/rooms', { method: 'POST', body: { title: '새 방' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ title: '새 방' }));
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('204 이면 undefined 를 돌려준다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('401 → refresh 성공 → 원 요청을 한 번 더 보내 결과를 돌려준다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(204)) // POST /api/auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));

    const me = await apiFetch<{ id: number }>('/auth/me');

    expect(me).toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('401 → refresh 실패 → onUnauthenticated 호출 + ApiError(401) throw', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'no refresh' }));

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('/auth/refresh 자체가 401 이면 재시도하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'x' }));

    await expect(apiFetch('/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('4xx/5xx 에러 본문을 ApiError 로 매핑한다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { code: 'ROOM_BUSY', message: '답변이 끝난 뒤 보내주세요', details: null }),
    );

    const err = (await apiFetch('/rooms/1/messages', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ROOM_BUSY');
    expect(err.message).toBe('답변이 끝난 뒤 보내주세요');
  });

  it('에러 본문이 JSON 이 아니어도 status 기반 ApiError 를 만든다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));

    const err = (await apiFetch('/rooms').catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe('HTTP_502');
  });
});
