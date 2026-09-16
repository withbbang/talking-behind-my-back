import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

/** 입력 (DESIGN.md 공통 컴포넌트). 높이 48, 라운드 16, ink 12% 테두리, 포커스 accent. */
export const Input = forwardRef<HTMLInputElement, Props>(function Input({ invalid, className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-12 w-full rounded-2xl border bg-transparent px-4 text-base text-ink outline-none placeholder:text-muted focus:border-accent ${
        invalid ? 'border-danger' : 'border-ink/12'
      } ${className}`}
      {...rest}
    />
  );
});
