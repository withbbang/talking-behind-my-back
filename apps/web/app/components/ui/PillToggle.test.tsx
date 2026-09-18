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

  it('옵션에 tip 이 있으면 칸마다 tooltip + 그 칸 aria-describedby (D-037 4)', () => {
    const tipped = [
      { value: 'AI', label: 'AI', tip: 'AI와 1:1, 친구는 못 봐!' },
      { value: 'HUMAN', label: '유저끼리', tip: '친구와 1:1, AI는 못 봐!' },
    ] as const;
    render(<PillToggle aria-label="모드" options={tipped} value="AI" onChange={() => {}} />);

    const tips = screen.getAllByRole('tooltip');
    expect(tips.map((t) => t.textContent)).toEqual(['AI와 1:1, 친구는 못 봐!', '친구와 1:1, AI는 못 봐!']);
    expect(screen.getByRole('radio', { name: 'AI' })).toHaveAttribute('aria-describedby', tips[0].id);
    expect(screen.getByRole('radio', { name: '유저끼리' })).toHaveAttribute('aria-describedby', tips[1].id);
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-describedby');
  });

  it('tip 없으면 tooltip 도 aria-describedby 도 없다', () => {
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={() => {}} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('radio', { name: 'AI' })).not.toHaveAttribute('aria-describedby');
  });

  it('방향키로 이동', () => {
    const onChange = vi.fn();
    render(<PillToggle aria-label="모드" options={options} value="AI" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'AI' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('HUMAN');
  });
});
