import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar (DESIGN.md 아바타)', () => {
  it('AI 는 icon.svg 이미지, alt "AI"', () => {
    render(<Avatar kind="ai" />);
    const img = screen.getByRole('img', { name: 'AI' });
    expect(img).toHaveAttribute('src', expect.stringContaining('icon.svg'));
  });
  it('사람은 닉네임 첫 글자, 접근성 이름은 닉네임 전체', () => {
    render(<Avatar name="영희" />);
    const el = screen.getByRole('img', { name: '영희' });
    expect(el).toHaveTextContent('영');
  });
  it('size 로 크기 지정(기본 28)', () => {
    const { rerender } = render(<Avatar name="철수" />);
    expect(screen.getByRole('img')).toHaveStyle({ width: '28px', height: '28px' });
    rerender(<Avatar name="철수" size={64} />);
    expect(screen.getByRole('img')).toHaveStyle({ width: '64px', height: '64px' });
  });
});
