import { Microphone } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/Avatar';
import { ListenButton } from '@/components/voice/ListenButton';
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
 * AI = 상대(other) 말풍선과 완전히 같은 모양(면·모서리) + 하트 아바타 + 시간 줄 앞 듣기 버튼. 꼬리 없음(2026-09-18 사용자 요청). 최대 폭 78%.
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
            } ${!mine ? 'rounded-bl-[6px]' : ''}`}
          >
            {message.content}
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-1 text-xs text-muted tabular-nums">
          {kind === 'ai' && <ListenButton messageId={message.id} text={message.content} />}
          {message.inputType === 'VOICE' && <Microphone size={14} weight="bold" role="img" aria-label="음성" />}
          {time}
        </span>
      </div>
    </li>
  );
}
