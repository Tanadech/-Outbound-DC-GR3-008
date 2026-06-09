/* ============================================================
   UTILITY HELPERS
   ============================================================ */
import { CONFIG } from '../data/config.js';

const C = CONFIG.COL;

/**
 * Format any date value (Date object, Excel serial, string) → Thai locale string.
 */
export function formatDate(val, includeTime = false) {
  if (val === null || val === undefined || val === '') return '—';
  let d;
  if (val instanceof Date)       d = val;
  else if (typeof val === 'number') d = new Date((val - 25569) * 86400000);
  else if (typeof val === 'string') d = new Date(val);
  else return String(val);
  if (isNaN(d.getTime())) return String(val);
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('th-TH', opts);
}

/**
 * Return ISO date string (YYYY-MM-DD) for grouping/filtering.
 */
export function toDateKey(val) {
  if (!val) return null;
  let d;
  if (val instanceof Date)       d = val;
  else if (typeof val === 'number') d = new Date((val - 25569) * 86400000);
  else if (typeof val === 'string') d = new Date(val);
  else return null;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Format number with Thai locale thousand separators.
 */
export function formatNum(n, decimals = 0) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Derive status from a raw main data row.
 *
 *   s4 — has R008 value
 *   s2 — has arrival date, no R008
 *   s1 — has T3 gate, no arrival
 *   s0 — no T3 gate
 */
export function deriveStatus(row) {
  if (row[C.R008])        return CONFIG.STATUS.S4;
  if (row[C.ARRIVE_DATE]) return CONFIG.STATUS.S2;
  if (row[C.GATE_T3])     return CONFIG.STATUS.S1;
  return CONFIG.STATUS.S0;
}

/**
 * Extract warehouse label from T2 and T3 gate values.
 *
 *   "WH2-69" → "WH2"
 *   "WH1-37" → "WH1"
 *   "SUM 1,2-XX" → "SUM 1,2"
 *   T2="WH1-31" T3="WH2-68" → "WH1, WH2"   (different → show both)
 *   T2="WH2-69" T3="WH2-74" → "WH2"         (same prefix → show once)
 */
export function extractWarehouse(t2, t3) {
  const prefix = gate => {
    if (!gate) return null;
    const s = String(gate).trim();
    const idx = s.lastIndexOf('-');
    return idx > 0 ? s.slice(0, idx).trim() : s;
  };
  const w2 = prefix(t2);
  const w3 = prefix(t3);
  if (!w2 && !w3) return '—';
  if (!w2) return w3;
  if (!w3) return w2;
  return w2 === w3 ? w2 : `${w2}, ${w3}`;
}

/**
 * Safely escape HTML special characters.
 */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

/**
 * Truncate string and append ellipsis if longer than maxLen.
 */
export function truncate(str, maxLen = 28) {
  if (!str) return '—';
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

/**
 * Return number of full days between a date and today.
 * Returns null if date is invalid.
 */
export function daysAgo(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today - target) / 86400000);
}

/**
 * Classify diff reason into category key.
 */
export function diffCategory(reason) {
  if (!reason) return 'other';
  const r = String(reason);
  if (r.includes('ขาด')) return 'short';
  if (r.includes('เกิน')) return 'over';
  return 'other';
}

/**
 * Return display metadata for a diff category key.
 */
export function diffCategoryMeta(category) {
  return {
    short: { label: 'สินค้าขาด',        cssClass: 'short' },
    over:  { label: 'สินค้าเกิน',       cssClass: 'over'  },
    other: { label: 'ไม่มีข้อมูลในระบบ', cssClass: 'other' },
  }[category] ?? { label: category, cssClass: 'other' };
}
