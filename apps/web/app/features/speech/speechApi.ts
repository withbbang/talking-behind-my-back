import { apiFetch, apiFetchBlob } from '@/lib/api';
import type { Recording } from './useRecorder';

/** API.md#speech. STT 는 multipart(`audio` + `durationMs` 힌트), TTS 는 JSON → audio/mpeg Blob. */
type SttResponse = { text: string; durationMs: number; provider: string };

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };

/**
 * 이보다 작은 녹음은 오디오가 없다고 본다 — 1초짜리 opus/aac 도 수 KB. iOS 시뮬레이터처럼 빈 컨테이너(webm 5B·mp4 0B)를
 * 올리면 공급자가 400 → "시스템 오류" 가 됐다(T-052). 빈 텍스트로 돌려 "아무 말도 안 들렸는데?" 분기를 탄다.
 */
export const MIN_AUDIO_BYTES = 1024;

export async function transcribe(rec: Recording): Promise<{ text: string; durationMs: number }> {
  if (rec.blob.size < MIN_AUDIO_BYTES) return { text: '', durationMs: rec.durationMs };
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
