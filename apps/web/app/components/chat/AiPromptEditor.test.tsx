import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiPromptEditor } from './AiPromptEditor';

const base = {
  aiPersonality: 'RATIONAL' as const,
  aiPrompt: null,
  effectiveAiPrompt: '너는 논리적이고 차분한 대화 상대다.',
  editable: true,
  onSelectPreset: vi.fn(),
  onSavePrompt: vi.fn(),
  onReset: vi.fn(),
};

describe('AiPromptEditor (DESIGN.md#3 AI 성격, D-017)', () => {
  it('프리셋 필 토글 + 현재 적용 문구 표시', () => {
    render(<AiPromptEditor {...base} />);
    expect(screen.getByRole('radio', { name: '차분한 편' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '공감형' })).toBeInTheDocument();
    expect(screen.getByText('너는 논리적이고 차분한 대화 상대다.')).toBeInTheDocument();
  });

  it('프리셋 선택 → onSelectPreset', () => {
    const onSelectPreset = vi.fn();
    render(<AiPromptEditor {...base} onSelectPreset={onSelectPreset} />);
    fireEvent.click(screen.getByRole('radio', { name: '공감형' }));
    expect(onSelectPreset).toHaveBeenCalledWith('EMOTIONAL');
  });

  it('직접 쓰기 접이식: 열면 textarea + n/2000 카운터, blur 시 onSavePrompt(trim)', () => {
    const onSavePrompt = vi.fn();
    render(<AiPromptEditor {...base} onSavePrompt={onSavePrompt} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '직접 쓰기' }));
    const ta = screen.getByRole('textbox', { name: '직접 쓰기' });
    expect(ta).toHaveAttribute('maxlength', '2000');
    expect(screen.getByText('0/2000')).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: ' 내 편만 들어 ' } });
    expect(screen.getByText('9/2000')).toBeInTheDocument();
    fireEvent.blur(ta);
    expect(onSavePrompt).toHaveBeenCalledWith('내 편만 들어');
  });

  it('내용이 바뀌지 않았거나 비어 있으면 blur 에 저장 안 함', () => {
    const onSavePrompt = vi.fn();
    render(<AiPromptEditor {...base} aiPrompt="원래 문구" onSavePrompt={onSavePrompt} />);
    const ta = screen.getByRole('textbox', { name: '직접 쓰기' }); // aiPrompt 있으면 기본 펼침
    expect(ta).toHaveValue('원래 문구');
    fireEvent.blur(ta);
    fireEvent.change(ta, { target: { value: '   ' } });
    fireEvent.blur(ta);
    expect(onSavePrompt).not.toHaveBeenCalled();
  });

  it('커스텀 프롬프트가 있으면 "프리셋으로 되돌리기" → onReset', () => {
    const onReset = vi.fn();
    render(<AiPromptEditor {...base} aiPrompt="내 편만 들어" onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: '프리셋으로 되돌리기' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('editable=false(참여자) 면 토글 비활성 + 직접 쓰기 없음, 적용 문구만', () => {
    render(<AiPromptEditor {...base} editable={false} aiPrompt="내 편만 들어" effectiveAiPrompt="내 편만 들어" />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '프리셋으로 되돌리기' })).toBeNull();
    expect(screen.getByText('내 편만 들어')).toBeInTheDocument();
  });
});
