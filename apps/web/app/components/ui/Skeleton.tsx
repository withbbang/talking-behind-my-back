/** 스켈레톤 (DESIGN.md 컴포넌트 목록). 로딩 중 레이아웃 자리 확보. 라벨은 스크린리더 전용. */
export function Skeleton({ lines = 3, label, lineClassName = 'h-16' }: { lines?: number; label: string; lineClassName?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} data-skeleton-line aria-hidden="true" className={`animate-pulse rounded-2xl bg-ink/8 ${lineClassName}`} />
      ))}
    </div>
  );
}
