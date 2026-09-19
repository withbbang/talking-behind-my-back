import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Composer } from './Composer';

describe('Composer (DESIGN.md#3 입력창)', () => {
  it('모드별 플레이스홀더', () => {
    const { rerender } = render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveAttribute('placeholder', '무슨 얘기 하고싶어?');
    rerender(<Composer mode="HUMAN" lock={null} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'AI 몰래 얘기하기');
  });

  it('내 잡 대기 중이면 입력·전송 비활성 + "뒷담 친구 기다리는 중..."', () => {
    render(<Composer mode="AI" lock="pending" onSend={vi.fn()} />);
    const box = screen.getByRole('textbox');
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('placeholder', '뒷담 친구 기다리는 중...');
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('주인 없는 방이면 "방장이 도망간 방이야!" 로 잠김', () => {
    render(<Composer mode="AI" lock="orphaned" onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '방장이 도망간 방이야!');
  });

  it('Enter 로 전송(trim) 후 비움, Shift+Enter 는 줄바꿈, 빈 내용은 전송 안 함', () => {
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    const box = screen.getByRole('textbox');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: '  그 사람이 또 그랬어 ' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('그 사람이 또 그랬어');
    expect(box).toHaveValue('');
  });

  it('전송 버튼 클릭, 4,000자 상한', () => {
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('maxlength', '4000');
    fireEvent.change(box, { target: { value: '안녕' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(onSend).toHaveBeenCalledWith('안녕');
  });

  it('IME 조합 중 Enter 는 전송하지 않는다', () => {
    const onSend = vi.fn();
    render(<Composer mode="AI" lock={null} onSend={onSend} />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: '안녕' } });
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('Composer 보이스 모드 토글 (D-034 1)', () => {
  it('voiceRoomId 가 있으면 마이크와 전송 사이에 "음성" 토글, 없거나 잠기면 없음', () => {
    const { rerender } = render(<Composer mode="AI" lock={null} voiceRoomId={10} onSend={vi.fn()} />);
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['마이크', '음성', '전송']);
    rerender(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
    rerender(<Composer mode="AI" lock="pending" voiceRoomId={10} onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '음성' })).toBeNull();
  });

  it('글자가 있을 때만 "지우기" X, 탭하면 전부 지우고 포커스 유지 (D-035 4)', () => {
    render(<Composer mode="AI" lock={null} voiceRoomId={10} onSend={vi.fn()} />);
    const box = screen.getByRole('textbox', { name: '메시지' });
    expect(screen.queryByRole('button', { name: '지우기' })).toBeNull();
    fireEvent.change(box, { target: { value: '그 사람이' } });
    const clear = screen.getByRole('button', { name: '지우기' });
    const order = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(order).toEqual(['지우기', '마이크', '음성', '전송']);
    fireEvent.click(clear);
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(screen.queryByRole('button', { name: '지우기' })).toBeNull();
  });
});

describe('Composer 전송 후 포커스 (T-034)', () => {
  it('Enter 전송 → 잠김 → 잠금 해제 시 입력창으로 포커스가 돌아온다', () => {
    const { rerender } = render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    const box = screen.getByRole('textbox', { name: '메시지' });
    box.focus();
    fireEvent.change(box, { target: { value: '그 사람이 또 그랬어' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    box.blur(); // 브라우저가 disabled 되는 엘리먼트의 포커스를 떼는 지점 (jsdom 은 흉내내지 않는다)
    rerender(<Composer mode="AI" lock="pending" onSend={vi.fn()} />);
    expect(box).not.toHaveFocus();

    rerender(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveFocus();
  });

  it('전송 버튼 클릭 후에도 포커스는 입력창에 남는다', () => {
    render(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    const box = screen.getByRole('textbox', { name: '메시지' });
    fireEvent.change(box, { target: { value: '안녕' } });
    const sendButton = screen.getByRole('button', { name: '전송' });
    sendButton.focus();
    fireEvent.click(sendButton);
    expect(box).toHaveFocus();
  });

  it('잠금이 풀릴 때 다른 곳에 포커스가 있으면 뺏지 않는다', () => {
    const { rerender } = render(
      <>
        <button type="button">다른 버튼</button>
        <Composer mode="AI" lock={null} onSend={vi.fn()} />
      </>,
    );
    const box = screen.getByRole('textbox', { name: '메시지' });
    box.focus();
    fireEvent.change(box, { target: { value: '안녕' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    box.blur(); // 브라우저가 disabled 로 포커스를 뗀 뒤
    rerender(
      <>
        <button type="button">다른 버튼</button>
        <Composer mode="AI" lock="pending" onSend={vi.fn()} />
      </>,
    );
    const other = screen.getByRole('button', { name: '다른 버튼' });
    other.focus(); // 대기 중 사용자가 다른 곳을 누른다

    rerender(
      <>
        <button type="button">다른 버튼</button>
        <Composer mode="AI" lock={null} onSend={vi.fn()} />
      </>,
    );
    expect(other).toHaveFocus();
  });

  it('보내지 않고 잠긴 방(orphaned → 해제)은 자동 포커스하지 않는다', () => {
    const { rerender } = render(<Composer mode="AI" lock="orphaned" onSend={vi.fn()} />);
    rerender(<Composer mode="AI" lock={null} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: '메시지' })).not.toHaveFocus();
  });
});
