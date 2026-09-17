/** MediaRecorder mime 후보 — Chrome/Firefox 는 webm/opus, iOS Safari 는 mp4(aac). 서버는 content-type 으로 확장자를 정한다(API.md#speech). */
export const RECORDER_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'] as const;

export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return RECORDER_MIME_CANDIDATES.find((t) => isSupported(t));
}
