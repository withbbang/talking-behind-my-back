/**
 * 시간 표시 유틸 (D-020). 저장·전송은 UTC, 표시만 KST (CONVENTIONS.md#공통).
 * - 목록 상대시간: 방금 / n분 전 / n시간 전(같은 KST 날짜) / 어제 / M.D
 * - 말풍선: HH:mm (24시간)  - 날짜 칩: M월 D일 요일
 */
const KST = 'Asia/Seoul';

type Ymd = { y: number; m: number; d: number };

function kstYmd(date: Date): Ymd {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

const sameYmd = (a: Ymd, b: Ymd) => a.y === b.y && a.m === b.m && a.d === b.d;

export function isSameKstDay(a: string, b: string): boolean {
  return sameYmd(kstYmd(new Date(a)), kstYmd(new Date(b)));
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const minutes = Math.floor((now.getTime() - t.getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const target = kstYmd(t);
  if (sameYmd(target, kstYmd(now))) return `${Math.floor(minutes / 60)}시간 전`;
  if (sameYmd(target, kstYmd(new Date(now.getTime() - 86_400_000)))) return '어제';
  return `${target.m}.${target.d}`;
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatDateChip(iso: string): string {
  const date = new Date(iso);
  const { m, d } = kstYmd(date);
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, weekday: 'long' }).format(date);
  return `${m}월 ${d}일 ${weekday}`;
}
