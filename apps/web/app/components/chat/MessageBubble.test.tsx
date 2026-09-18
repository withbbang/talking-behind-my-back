import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { aiMsg, userMsg } from '@/features/messages/testFixtures';

describe('MessageBubble (DESIGN.md#3 말풍선 3종)', () => {
  it('나: 우측, 시간 HH:mm', () => {
    render(<MessageBubble message={userMsg(1, { createdAt: '2026-09-16T12:05:00Z' })} kind="mine" showMeta />);
    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('data-kind', 'mine');
    expect(screen.getByText('21:05')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('상대: 닉네임 + 사람 아바타, 연속이면 둘 다 생략', () => {
    const { rerender } = render(<MessageBubble message={userMsg(2, { senderUserId: 2 })} kind="other" senderName="영희" showMeta />);
    expect(screen.getByText('영희')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '영희' })).toBeInTheDocument();
    rerender(<MessageBubble message={userMsg(2, { senderUserId: 2 })} kind="other" senderName="영희" showMeta={false} />);
    expect(screen.queryByText('영희')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('AI: 하트 아바타, 상대(유저) 말풍선과 같은 모양(꼬리 없음, 좌하단 6)', () => {
    render(<MessageBubble message={aiMsg(3)} kind="ai" showMeta />);
    expect(screen.getByRole('img', { name: 'AI' })).toBeInTheDocument();
    // 사용자 요청(2026-09-18): AI 말풍선을 유저 말풍선과 동일하게 — svg 꼬리 제거
    expect(screen.queryByTestId('bubble-tail')).toBeNull();
  });

  it('AI 와 상대(other) 말풍선의 면·모서리 클래스가 동일하다', () => {
    const { container: ai } = render(<MessageBubble message={aiMsg(5, { content: '같은모양' })} kind="ai" showMeta />);
    const aiP = ai.querySelector('p');
    const { container: other } = render(<MessageBubble message={userMsg(6, { senderUserId: 2, content: '같은모양' })} kind="other" senderName="영희" showMeta />);
    const otherP = other.querySelector('p');
    const norm = (el: Element | null) => [...(el?.classList ?? [])].filter((c) => c.startsWith('rounded') || c.startsWith('border') || c.startsWith('bg-') || c.startsWith('text-')).sort().join(' ');
    expect(norm(aiP)).toBe(norm(otherP));
  });

  it('VOICE 입력은 마이크 표시', () => {
    render(<MessageBubble message={userMsg(4, { inputType: 'VOICE' })} kind="mine" showMeta />);
    expect(screen.getByRole('img', { name: '음성' })).toBeInTheDocument();
  });
});

describe('MessageBubble 듣기 버튼 (T-010)', () => {
  it('AI 말풍선에만 "듣기" 버튼, 나/상대에는 없음', () => {
    const { rerender } = render(<MessageBubble message={aiMsg(3, { content: '또?' })} kind="ai" showMeta />);
    expect(screen.getByRole('button', { name: '듣기' })).toBeInTheDocument();
    rerender(<MessageBubble message={userMsg(1)} kind="mine" showMeta />);
    expect(screen.queryByRole('button', { name: '듣기' })).toBeNull();
    rerender(<MessageBubble message={userMsg(2, { senderUserId: 2 })} kind="other" senderName="영희" showMeta />);
    expect(screen.queryByRole('button', { name: '듣기' })).toBeNull();
  });
});
