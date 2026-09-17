import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { Recording } from './useRecorder';

/** API.md#speech. STT 는 multipart(`audio` + `durationMs` 힌트), TTS 는 JSON → audio/mpeg Blob. */
type SttResponse = { text: string; durationMs: number; provider: string };

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };

export async function transcribe(rec: Recording): Promise<{ text: string; durationMs: number }> {
  const type = rec.mimeType.split(';')[0].trim();
  const form = new FormData();
  form.append('audio', new File([rec.blob], `audio.${EXT[type] ?? 'bin'}`, { type }));
  form.append('durationMs', String(Math.round(rec.durationMs)));
  const res = await apiFetch<SttResponse>('/speech/stt', { method: 'POST', body: form });
  return { text: res.text.trim(), durationMs: res.durationMs };
}

export function synthesize(text: string): Promise<Blob> {
  return apiFetchBlob('/speech/tts', { method: 'POST', body: { text } });
}
