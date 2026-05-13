// BigInt JSON 직렬화 헬퍼
export function serializeProject<T extends Record<string, any>>(p: T): T {
  const out: any = { ...p };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "bigint") out[k] = out[k].toString();
    else if (out[k] instanceof Date) out[k] = out[k].toISOString();
    else if (Array.isArray(out[k])) out[k] = out[k].map(serializeProject);
    else if (out[k] && typeof out[k] === "object") out[k] = serializeProject(out[k]);
  }
  return out;
}
