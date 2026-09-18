import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MessageList } from './MessageList';
import { initialStreamState, type StreamState } from '@/lib/sse';
import { aiMsg, userMsg } from '@/features/messages/testFixtures';

const members = [
  { userId: 1, nickname: '영선', role: 'OWNER' as const },
  { userId: 2, nickname: '영희', role: 'PARTICIPANT' as const },
];
const base = { meId: 1, members, stream: initialStreamState, onLoadOlder: vi.fn(), hasOlder: false, isLoadingOlder: false };

describe('MessageList (DESIGN.md#3 메시지 목록)', () => {
  it('3종 구분 + 같은 발신자 연속은 메타 생략', () => {
    render(<MessageList {...base} messages={[userMsg(1), userMsg(2), userMsg(3, { senderUserId: 2 }), aiMsg(4)]} />);
    const items = screen.getAllByRole('listitem').filter((el) => el.hasAttribute('data-kind'));
    expect(items.map((el) => el.dataset.kind)).toEqual(['mine', 'mine', 'other', 'ai']);
    expect(items.map((el) => el.dataset.grouped)).toEqual(['false', 'true', 'false', 'false']);
    expect(screen.getByText('영희')).toBeInTheDocument();
  });

  it('날짜가 바뀌면 날짜 칩', () => {
    render(
      <MessageList
        {...base}
        messages={[userMsg(1, { createdAt: '2026-09-15T12:00:00Z' }), userMsg(2, { createdAt: '2026-09-16T12:00:00Z' }), userMsg(3, { createdAt: '2026-09-16T13:00:00Z' })]}
      />,
    );
    expect(screen.getByText('9월 15일 화요일')).toBeInTheDocument();
    expect(screen.getByText('9월 16일 수요일')).toBeInTheDocument();
    expect(screen.getAllByTestId('date-chip')).toHaveLength(2);
  });

  it('시스템 라인은 시간순으로 끼워 넣는다', () => {
    const stream: StreamState = { streams: {}, notices: [{ id: 'n1', text: '영희 등장!', createdAt: '2026-09-16T12:01:30Z' }] };
    render(<MessageList {...base} stream={stream} messages={[userMsg(1), userMsg(2)]} />);
    const rows = screen.getAllByRole('listitem');
    const texts = rows.map((r) => r.textContent ?? '');
    expect(texts.findIndex((t) => t.includes('메시지 1'))).toBeLessThan(texts.findIndex((t) => t.includes('영희 등장!')));
    expect(texts.findIndex((t) => t.includes('영희 등장!'))).toBeLessThan(texts.findIndex((t) => t.includes('메시지 2')));
  });

  it('스트리밍: 대기 = 점 3개(aria-live), 진행 = 텍스트 + 커서, 오류 = 문구만("다시" 버튼 없음, D-034 9)', () => {
    const stream: StreamState = {
      notices: [],
      streams: {
        1: { replyTo: 1, senderUserId: 1, text: '', status: 'waiting', startedAt: '2026-09-16T12:01:00Z' },
        2: { replyTo: 2, senderUserId: 1, text: '안녕하', status: 'streaming', startedAt: '2026-09-16T12:02:00Z' },
        3: { replyTo: 3, senderUserId: 1, text: '', status: 'error', errorMessage: 'x', startedAt: '2026-09-16T12:03:00Z' },
      },
    };
    render(<MessageList {...base} stream={stream} messages={[userMsg(1), userMsg(2), userMsg(3)]} />);
    const live = screen.getAllByRole('status');
    expect(live.some((el) => el.getAttribute('aria-live') === 'polite')).toBe(true);
    expect(screen.getByTestId('typing-dots')).toBeInTheDocument();
    expect(screen.getByText(/안녕하/)).toHaveTextContent('안녕하▍');
    expect(screen.getByText('시스템 오류. 다시 시도해줄래?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시' })).toBeNull();
  });

  it('상단 센티널: hasOlder 면 "이전 대화" 버튼(IO 폴백)', () => {
    const onLoadOlder = vi.fn();
    render(<MessageList {...base} hasOlder onLoadOlder={onLoadOlder} messages={[userMsg(1)]} />);
    fireEvent.click(screen.getByRole('button', { name: '이전 대화' }));
    expect(onLoadOlder).toHaveBeenCalled();
  });

  it('senderNickname 이 있으면 현재 멤버 목록에 없어도 그 이름 (T-021)', () => {
    render(<MessageList {...base} messages={[userMsg(1, { senderUserId: 99, senderNickname: '나간영희' })]} />);
    const list = within(screen.getByRole('list'));
    expect(list.getByText('나간영희')).toBeInTheDocument();
    expect(list.queryByText('나간 사람')).not.toBeInTheDocument();
  });

  it('senderNickname 이 null 이면 현재 멤버 목록으로 폴백', () => {
    render(<MessageList {...base} messages={[userMsg(1, { senderUserId: 2, senderNickname: null })]} />);
    expect(within(screen.getByRole('list')).getByText('영희')).toBeInTheDocument();
  });

  it('모르는 발신자는 "나간 사람"', () => {
    render(<MessageList {...base} messages={[userMsg(1, { senderUserId: 99 })]} />);
    expect(within(screen.getByRole('list')).getByText('나간 사람')).toBeInTheDocument();
  });
});
