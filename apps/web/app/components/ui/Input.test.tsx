import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Input } from './Input';

describe('Input (DESIGN.md 입력)', () => {
  it('네이티브 input 속성을 그대로 전달하고 ref 를 노출한다', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="제목" defaultValue="오늘 뭐 먹지" maxLength={100} />);
    const el = screen.getByRole('textbox', { name: '제목' });
    expect(el).toHaveValue('오늘 뭐 먹지');
    expect(el).toHaveAttribute('maxlength', '100');
    expect(ref.current).toBe(el);
  });
  it('invalid 면 aria-invalid', () => {
    render(<Input aria-label="제목" invalid />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
