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
