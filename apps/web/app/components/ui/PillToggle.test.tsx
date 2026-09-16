import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PillToggle } from './PillToggle';

const options = [
  { value: 'AI', label: 'AI' },
  { value: 'HUMAN', label: '유저끼리' },
] as const;

describe('PillToggle (DESIGN.md 필 토글)', () => {
  it('radiogroup + 활성 칸 aria-checked, 클릭 시 onChange', () => {
    const onChange = vi.fn();
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '모드' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '유저끼리' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: '유저끼리' }));
    expect(onChange).toHaveBeenCalledWith('HUMAN');
  });

  it('같은 값 클릭은 onChange 안 부름', () => {
    const onChange = vi.fn();
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'AI' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled 면 aria-disabled + onChange 안 부름', () => {
    const onChange = vi.fn();
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={onChange} disabled />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '유저끼리' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('방향키로 이동', () => {
    const onChange = vi.fn();
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'AI' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('HUMAN');
  });
});
