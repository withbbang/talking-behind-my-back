import { describe, expect, it } from 'vitest';
import { pickMimeType, RECORDER_MIME_CANDIDATES } from './mime';

describe('pickMimeType (MediaRecorder mime — iOS Safari 분기)', () => {
  it('webm/opus 를 최우선으로 고른다(Chrome/Firefox)', () => {
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
  });

  it('webm 이 없으면 mp4(iOS Safari)', () => {
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
  });

  it('아무것도 지원하지 않으면 undefined(브라우저 기본값에 맡김)', () => {
    expect(pickMimeType(() => false)).toBeUndefined();
  });

  it('후보 순서: webm;opus → webm → mp4 → ogg;opus', () => {
    expect(RECORDER_MIME_CANDIDATES).toEqual(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']);
  });
});
