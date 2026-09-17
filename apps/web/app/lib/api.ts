/**
 * API 클라이언트 — 모든 백엔드 호출은 이 파일만 경유한다 (CONVENTIONS.md#프론트).
 *
 * - base: 같은 오리진 `/api` (D-004). 서버 컴포넌트에서는 API_INTERNAL_URL 을 쓴다.
 * - 인증: HttpOnly 쿠키 → credentials: 'include'. 토큰을 JS 에서 다루지 않는다.
 * - 401: POST /api/auth/refresh 1회 → 성공 시 원 요청 재시도, 실패 시 onUnauthenticated().
 * - SSE 스트림(POST /rooms/{id}/messages)은 여기 아님 → lib/sse.ts (T-008).
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiInit = Omit<RequestInit, 'body'> & {
  /** 객체를 넘기면 JSON 직렬화. string/FormData/Blob 은 그대로 전달. */
  body?: unknown;
  /** 401 시 refresh 후 재시도 여부 (기본 true) */
  retryOn401?: boolean;
};

const API_BASE = '/api';
const REFRESH_PATH = '/auth/refresh';

let unauthenticatedHandler: () => void = () => {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
};

/** 테스트/앱 초기화에서 401 최종 실패 시 동작을 바꿀 때 사용 */
export function setUnauthenticatedHandler(handler: () => void) {
  unauthenticatedHandler = handler;
}

function apiBase(): string {
  // 서버 컴포넌트/route handler 에서는 compose 내부 주소로 직접 호출
  if (typeof window === 'undefined' && process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL;
  }
  return API_BASE;
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  );
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { code?: string; message?: string; details?: unknown };
    return new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.message ?? res.statusText, body.details);
  } catch {
    return new ApiError(res.status, `HTTP_${res.status}`, res.statusText || `HTTP ${res.status}`);
  }
}

// 동시에 여러 요청이 401 을 받아도 refresh 는 한 번만 날린다.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${apiBase()}${REFRESH_PATH}`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function rawFetch(path: string, init: ApiInit): Promise<Response> {
  const { body, retryOn401: _retry, headers, ...rest } = init;
  const h = new Headers(headers);
  let payload: BodyInit | undefined;

  if (body !== undefined && body !== null) {
    if (isRawBody(body)) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
    }
  }
  if (!h.has('Accept')) h.set('Accept', 'application/json');

  return fetch(`${apiBase()}${path}`, { ...rest, headers: h, body: payload, credentials: 'include' });
}

/** 401 → refresh 1회 → 재시도까지 끝낸 응답. 비 2xx 는 ApiError. apiFetch/apiFetchBlob 공통. */
async function fetchWithRefresh(path: string, init: ApiInit): Promise<Response> {
  const retryOn401 = init.retryOn401 ?? true;
  let res = await rawFetch(path, init);

  if (res.status === 401 && retryOn401 && path !== REFRESH_PATH) {
    const firstError = await parseError(res.clone());
    const refreshed = await tryRefresh();
    if (!refreshed) {
      unauthenticatedHandler();
      throw firstError;
    }
    res = await rawFetch(path, init);
  }

  if (!res.ok) {
    throw await parseError(res);
  }
  return res;
}

/**
 * JSON API 호출. 2xx 면 파싱된 본문(204 는 undefined), 아니면 ApiError throw.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await fetchWithRefresh(path, init);
  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * 바이너리 응답(TTS `audio/mpeg`, T-010). 401/refresh·에러 매핑은 apiFetch 와 같고, 본문은 Blob(응답 Content-Type 유지).
 */
export async function apiFetchBlob(path: string, init: ApiInit = {}): Promise<Blob> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'audio/mpeg');
  const res = await fetchWithRefresh(path, { ...init, headers });
  return res.blob();
}
