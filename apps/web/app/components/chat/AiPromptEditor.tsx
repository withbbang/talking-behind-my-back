'use client';

import { useState } from 'react';
import { PillToggle } from '@/components/ui/PillToggle';
import { AI_PERSONALITY_LABEL, type AiPersonality } from '@/features/rooms/types';

const MAX = 2000;
const PRESETS = (['RATIONAL', 'EMOTIONAL'] as const).map((value) => ({ value, label: AI_PERSONALITY_LABEL[value] }));

type Props = {
  aiPersonality: AiPersonality;
  aiPrompt: string | null;
  effectiveAiPrompt: string;
  /** 개설자만 true. 참여자는 읽기 전용 표시. */
  editable: boolean;
  onSelectPreset: (p: AiPersonality) => void;
  onSavePrompt: (text: string) => void;
  onReset: () => void;
};

/**
 * AI 성격 편집 (DESIGN.md#3, D-017, D-034 6). 프리셋 필 토글 + "직접 쓰기" 접이식 textarea(≤2,000, n/2000) + 취소/저장 버튼 + "되돌리기".
 * 현재 적용 문구(effectiveAiPrompt)는 항상 위에 2줄 말줄임으로 표시. 저장은 "저장" 버튼만(blur 저장 없음 — 취소 클릭이 blur 를 먼저 일으켜 충돌).
 * 부모는 aiPrompt 가 바뀌면 key 로 다시 마운트해 draft 를 동기화한다.
 */
export function AiPromptEditor({ aiPersonality, aiPrompt, effectiveAiPrompt, editable, onSelectPreset, onSavePrompt, onReset }: Props) {
  const [openCustom, setOpenCustom] = useState(aiPrompt !== null);
  const [draft, setDraft] = useState(aiPrompt ?? '');

  const text = draft.trim();
  const dirty = text !== '' && text !== (aiPrompt ?? '');
  const save = () => {
    if (dirty) onSavePrompt(text);
  };
  const cancel = () => {
    setDraft(aiPrompt ?? '');
    setOpenCustom(false);
  };

  return (
    <section aria-label="AI 성격" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">AI 성격</h3>
        <PillToggle aria-label="AI 성격" options={PRESETS} value={aiPersonality} onChange={onSelectPreset} disabled={!editable} />
      </div>
      <p className="line-clamp-2 text-[13px] leading-snug text-muted break-keep">{effectiveAiPrompt}</p>

      {editable && !openCustom && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpenCustom(true)}
          className="self-start text-[13px] font-medium text-accent underline underline-offset-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          직접 쓰기
        </button>
      )}

      {editable && openCustom && (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="직접 쓰기"
            value={draft}
            maxLength={MAX}
            rows={4}
            placeholder="AI 성격 어떻게 설정하고 싶어?"
            onChange={(e) => setDraft(e.target.value)}
            className="w-full resize-none rounded-2xl border border-ink/12 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="flex items-center gap-3">
            {aiPrompt !== null && (
              <button
                type="button"
                onClick={onReset}
                className="text-[13px] font-medium text-muted underline underline-offset-2 outline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                되돌리기
              </button>
            )}
            <span className="flex-1 text-right text-xs text-muted tabular-nums" aria-live="polite">
              {draft.length}/{MAX}
            </span>
            <button
              type="button"
              onClick={cancel}
              className="h-9 rounded-xl border border-ink/12 px-3 text-[13px] font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="h-9 rounded-xl bg-surface px-3 text-[13px] font-semibold text-on-surface outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
