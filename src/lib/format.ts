/**
 * 주민등록번호 마스킹: 뒷자리 첫 1자리만 노출하고 나머지 6자리는 * 처리.
 *   "9001012345678" → "900101-1******"
 *   "900101-2345678" → "900101-2******"
 */
export function maskResident(r: string | null | undefined): string {
  if (!r) return "";
  const m = String(r).match(/^(\d{6})-?(\d)/);
  if (!m) return r;
  return `${m[1]}-${m[2]}******`;
}
