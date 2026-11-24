export const STAGE_NAMES = [
  "Panen & angkut",
  "Pascapanen",
  "Green bean",
  "Roasting",
  "Kemas",
  "Distribusi",
];

export const STAGE_COLORS = [
  "#10B981", // Panen & angkut (emerald)
  "#84CC16", // Pascapanen (lime)
  "#D4A373", // Green bean (crema)
  "#E05A47", // Roasting (terracotta)
  "#F59E0B", // Kemas (amber)
  "#38BDF8", // Distribusi (sky)
];

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function fm(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "tidak tercatat";
  }
  const num = Number(value);
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!match) return String(iso);
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const mon = MONTHS_ID[monthIdx] || match[2];
  return `${day} ${mon} ${year}`;
}

export function fmtMonth(ym) {
  if (!ym) return "-";
  const [y, m] = String(ym).split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS_ID[idx] || m} ${y}`;
}
