/** 필 배지 (DESIGN.md 공통 컴포넌트). 높이 20, 12px 600. 색만으로 구분하지 않도록 텍스트가 곧 의미다. */
const KIND = {
  owner: { label: '주인', className: 'bg-accent/12 text-accent' },
  closed: { label: '닫힘', className: 'bg-danger-bg text-danger' },
} as const;

export type BadgeKind = keyof typeof KIND;

export function Badge({ kind }: { kind: BadgeKind }) {
  const { label, className } = KIND[kind];
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
