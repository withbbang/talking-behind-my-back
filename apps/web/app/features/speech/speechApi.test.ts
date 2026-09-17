import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn(), apiFetchBlob: vi.fn() };
});

import { apiFetch, apiFetchBlob } from '@/lib/api';
import { synthesize, transcribe } from './speechApi';

const apiFetchMock = vi.mocked(apiFetch);
const apiFetchBlobMock = vi.mocked(apiFetchBlob);

describe('speechApi (API.md#speech)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobMock.mockReset();
  });

  it('transcribe: multipart audio(확장자는 mime 기준) + durationMs → text', async () => {
    apiFetchMock.mockResolvedValueOnce({ text: ' 진짜 짜증나 ', durationMs: 5880, provider: 'omniroute' });
    const blob = new Blob([new Uint8Array(3)], { type: 'audio/mp4' });
    const result = await transcribe({ blob, mimeType: 'audio/mp4', durationMs: 5900, hitLimit: false });
    expect(result).toEqual({ text: '진짜 짜증나', durationMs: 5880 });
    const [path, init] = apiFetchMock.mock.calls[0];
    expect(path).toBe('/speech/stt');
    expect(init?.method).toBe('POST');
    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('audio') as File).name).toBe('audio.mp4');
    expect((form.get('audio') as File).type).toBe('audio/mp4');
    expect(form.get('durationMs')).toBe('5900');
  });

  it('transcribe: webm 은 audio.webm, codecs 파라미터는 떼고 content-type 을 보낸다', async () => {
    apiFetchMock.mockResolvedValueOnce({ text: 'x', durationMs: 1000, provider: 'omniroute' });
    await transcribe({ blob: new Blob([]), mimeType: 'audio/webm;codecs=opus', durationMs: 1000, hitLimit: false });
    const file = (apiFetchMock.mock.calls[0][1]?.body as FormData).get('audio') as File;
    expect(file.name).toBe('audio.webm');
    expect(file.type).toBe('audio/webm');
  });

  it('synthesize: JSON text → Blob', async () => {
    const blob = new Blob([new Uint8Array(2)], { type: 'audio/mpeg' });
    apiFetchBlobMock.mockResolvedValueOnce(blob);
    await expect(synthesize('안녕')).resolves.toBe(blob);
    expect(apiFetchBlobMock).toHaveBeenCalledWith('/speech/tts', { method: 'POST', body: { text: '안녕' } });
  });
});
