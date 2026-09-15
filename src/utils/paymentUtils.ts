export const sanitizeDecimal = (raw: string) =>
  raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

export const toNum = (v: any) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const to2 = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);

export const to2s = (v: any) => to2(toNum(v));

export const currency = (val?: string | number | null) => {
  if (val === null || val === undefined || val === "") return "RM 0.00";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (!isFinite(num)) return `RM ${String(val)}`;
  return `RM ${num.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const pickA = (obj: any, names: string[], fb: any = null) => {
  for (const n of names) {
    const v = obj[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fb;
};

export const hasAnyDet = (r: any) => {
  const detKeys = Object.keys(r).filter((k) => /^Det[_A-Z]/.test(k));
  return detKeys.some((k) => {
    const v = r[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
};

export const toDMY = (yyyyMmDd?: string) => {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

export const parseAmtLoose = (v: any) =>
  parseFloat(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
