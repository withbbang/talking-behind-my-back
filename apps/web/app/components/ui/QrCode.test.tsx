import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encode } from 'uqr';
import { QrCode, qrModules } from './QrCode';

// D-021: uqr 행렬 → 둥근 모듈 SVG 직접 렌더. 오류정정 M, 여백은 카드 패딩이 담당(border 0).
describe('QrCode', () => {
  it('qrModules: 어두운 칸만 좌표로', () => {
    const data = [
      [true, false],
      [false, true],
    ];
    expect(qrModules(data)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('svg role=img + 라벨, 모듈 수는 uqr 결과와 같고 모서리가 둥글다', () => {
    const url = 'http://localhost:3000/join/K7Q2M9XW';
    const expected = encode(url, { ecc: 'M', border: 0 });
    const { container } = render(<QrCode value={url} size={200} label="초대 QR" />);

    const svg = screen.getByRole('img', { name: '초대 QR' });
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('viewBox', `0 0 ${expected.size} ${expected.size}`);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(expected.data.flat().filter(Boolean).length);
    expect(rects[0]).toHaveAttribute('rx');
    expect(Number(rects[0].getAttribute('rx'))).toBeGreaterThan(0);
  });
});
