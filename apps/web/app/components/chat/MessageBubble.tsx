import { Microphone } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/Avatar';
import type { Message } from '@/features/messages/types';
import { formatClock } from '@/lib/time';

export type BubbleKind = 'mine' | 'other' | 'ai';

type Props = {
  message: Message;
  kind: BubbleKind;
  senderName?: string;
  /** 발신자가 바뀐 첫 말풍선만 아바타·닉네임을 보인다(연속은 생략, 간격 4px). */
  showMeta: boolean;
};

/**
 * 말풍선 3종 (DESIGN.md#3). 나 = 우측 surface/on-surface 라운드 22(우하단 6). 상대 = 좌측 bg + ink 12% 테두리, 위 닉네임.
 * AI = 상대와 같은 면 + 좌하단 꼬리(로그인 말풍선과 같은 형태 언어) + 하트 아바타. 최대 폭 78%.
 */
export function MessageBubble({ message, kind, senderName, showMeta }: Props) {
  const mine = kind === 'mine';
  const time = formatClock(message.createdAt);

  return (
    <li data-kind={kind} data-grouped={String(!showMeta)} className={`bubble-in flex gap-2 ${showMeta ? 'mt-3' : 'mt-1'} ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <span className="w-7 shrink-0 self-end">
          {showMeta && (kind === 'ai' ? <Avatar kind="ai" /> : <Avatar name={senderName ?? '?'} />)}
        </span>
      )}
      <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
        {kind === 'other' && showMeta && <span className="px-1 text-xs text-muted">{senderName}</span>}
        <div className="relative">
          <p
            className={`rounded-[22px] px-4 py-2.5 text-base leading-relaxed break-words whitespace-pre-wrap ${
              mine ? 'rounded-br-[6px] bg-surface text-on-surface' : 'border border-ink/12 bg-bg text-ink'
            } ${kind === 'other' ? 'rounded-bl-[6px]' : ''}`}
          >
            {message.content}
          </p>
          {kind === 'ai' && (
            <svg data-testid="bubble-tail" viewBox="0 0 14 10" aria-hidden="true" className="absolute -bottom-[7px] left-3 h-2.5 w-3.5">
              <path d="M0 0h14c-3 1.5-6 5-7 10C6 5 3 1.5 0 0z" className="fill-ink/12" />
              <path d="M1.5 0.9h11c-2.5 1.3-4.8 4.2-5.5 7.6C6.3 5.1 4 2.2 1.5 0.9z" className="fill-bg" />
            </svg>
          )}
        </div>
        <span className="flex items-center gap-1 px-1 text-xs text-muted tabular-nums">
          {message.inputType === 'VOICE' && <Microphone size={14} weight="bold" role="img" aria-label="음성" />}
          {time}
        </span>
      </div>
    </li>
  );
}
