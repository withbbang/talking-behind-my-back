/** "{닉}이(가)" — 마지막 글자 받침으로 이/가 선택. 한글이 아니면 "이(가)" 병기 (BRAND.md#5 입장 소개문). */
export function iGa(name: string): string {
  const last = Array.from(name).at(-1);
  const code = last?.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  return `${name}${(code - 0xac00) % 28 === 0 ? '가' : '이'}`;
}
