import { useMemo } from 'react';
import { encode } from 'uqr';

/** 어두운 칸 좌표만. 테스트·렌더 공용 순수 함수. */
export function qrModules(data: boolean[][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  data.forEach((row, y) => row.forEach((dark, x) => dark && out.push({ x, y })));
  return out;
}

/**
 * QR (DESIGN.md#4, D-021). uqr 로 행렬만 받고 SVG 는 직접 그린다 — 모듈은 둥근 사각형(rx 35%), 오류정정 M, 로고 없음.
 * 여백(quiet zone)은 감싸는 카드의 패딩이 담당하므로 border 0. 색은 --qr-ink(모드 무관 고정) — 스캐너 호환.
 */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const { modules, n } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 0 });
    return { modules: qrModules(qr.data), n: qr.size };
  }, [value]);

  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="geometricPrecision">
      {modules.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} rx={0.35} fill="var(--qr-ink)" />
      ))}
    </svg>
  );
}
