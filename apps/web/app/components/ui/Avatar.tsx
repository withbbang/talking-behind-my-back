import Image from 'next/image';

type Props = { size?: number } & ({ kind: 'ai'; name?: never } | { kind?: 'user'; name: string });

/**
 * 아바타 (DESIGN.md 공통 컴포넌트). AI = icon.svg 하트(먹색 배경 그대로, BRAND.md#4 색 반전 금지).
 * 사람 = 닉네임 첫 글자, ink 12% 배경.
 */
export function Avatar(props: Props) {
  const size = props.size ?? 28;
  const style = { width: `${size}px`, height: `${size}px` };

  if (props.kind === 'ai') {
    return (
      <Image
        src="/icon.svg"
        alt="AI"
        width={size}
        height={size}
        unoptimized
        style={style}
        className="shrink-0 rounded-[22%]"
      />
    );
  }

  const initial = Array.from(props.name)[0] ?? '?';
  return (
    <span
      role="img"
      aria-label={props.name}
      style={{ ...style, fontSize: `${Math.round(size * 0.46)}px` }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink/12 font-semibold text-ink"
    >
      {initial}
    </span>
  );
}
