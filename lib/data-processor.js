/* ============================================================
   DATA PROCESSOR — shortage/surplus report
   ============================================================ */
import { CONFIG }                              from '../data/config.js';
import { deriveStatus, toDateKey, extractWarehouse, diffCategory } from './helpers.js';

/* Build column-index map from header row (falls back to hardcoded index) */
function buildColIndex(headers, nameMap, fallback) {
  const norm = headers.map(h => String(h ?? '').trim());
  const idx  = {};
  for (const [key, name] of Object.entries(nameMap)) {
    const found = norm.indexOf(String(name).trim());
    idx[key] = found >= 0 ? found : (fallback[key] ?? -1);
  }
  return idx;
}

let C  = CONFIG.COL;
let DC = CONFIG.DIFF_COL;

/* ---- Diff index builder ---------------------------------------- */

/**
 * Build lookup: outbound_docuno → diff item array
 */
export function buildDiffIndex(diffRows) {
  const idx = {};
  for (const row of diffRows) {
    const key = String(row[DC.DOC_NO] ?? '').trim();
    if (!key) continue;
    if (!idx[key]) idx[key] = [];
    idx[key].push({
      product:    String(row[DC.PRODUCT]     ?? ''),
      barcode:    String(row[DC.BARCODE]     ?? ''),
      diffQty:    Number(row[DC.DIFF_QTY]    || 0),
      reason:     String(row[DC.REASON]      ?? ''),
      category:   diffCategory(row[DC.REASON]),
      branchCode: String(row[DC.BRANCH_CODE] ?? ''),
      branchName: String(row[DC.BRANCH_NAME] ?? ''),
      empCode:    String(row[DC.EMP_CODE]    ?? ''),
      saveTime:    row[DC.SAVE_TIME] ? String(row[DC.SAVE_TIME]).slice(0, 19).replace('T', ' ') : '—',
      saveTimeRaw: row[DC.SAVE_TIME] ? new Date(String(row[DC.SAVE_TIME])) : null,
      empApprove: row[DC.EMP_APPROVE] ? String(row[DC.EMP_APPROVE]) : null,
      quantity:   Number(row[DC.QUANTITY]    || 0),
    });
  }
  return idx;
}

/* ---- Row enrichment -------------------------------------------- */

function enrichRow(raw, diffIdx) {
  const docNo  = String(raw[C.DOC_NO]  ?? '').trim();
  const status = deriveStatus(raw);

  // Scan counts — จำนวนขาดอาจเป็น negative (กล่องรับ - กล่องส่ง)
  const rawShort = Number(raw[C.DIFF_SHORT] || 0);
  const rawOver  = Number(raw[C.DIFF_OVER]  || 0);
  const scanShort = rawShort < 0 ? Math.abs(rawShort) : rawShort;
  const scanOver  = rawOver  < 0 ? Math.abs(rawOver)  : rawOver;

  const diffItems = diffIdx[docNo] ?? [];
  const diffShortItems = diffItems.filter(d => d.category === 'short');
  const diffOverItems  = diffItems.filter(d => d.category === 'over');
  const diffOtherItems = diffItems.filter(d => d.category === 'other');

  const warehouse = extractWarehouse(raw[C.GATE_T2], raw[C.GATE_T3]);

  return {
    docNo,
    queueNo:     String(raw[C.QUEUE_NO]    ?? ''),
    branch:      String(raw[C.BRANCH]      ?? ''),
    truckType:   String(raw[C.TRUCK_TYPE]  ?? ''),
    jobType:     String(raw[C.JOB_TYPE]    ?? ''),
    queueDate:   raw[C.QUEUE_DATE],
    queueDateKey: toDateKey(raw[C.QUEUE_DATE]),
    timeSlot:    String(raw[C.TIME_SLOT]   ?? ''),
    license:     String(raw[C.LICENSE]     ?? ''),
    driver:      String(raw[C.DRIVER]      ?? ''),
    phone:       String(raw[C.PHONE]       ?? ''),
    // Gate & warehouse
    gateT2:      raw[C.GATE_T2]   ? String(raw[C.GATE_T2]) : null,
    gateT3:      raw[C.GATE_T3]   ? String(raw[C.GATE_T3]) : null,
    warehouse,
    timeT3:      raw[C.TIME_T3]   ? String(raw[C.TIME_T3]) : null,
    arriveDate:  raw[C.ARRIVE_DATE] ?? null,
    // Recorders
    recT3:       raw[C.REC_T3]   ? String(raw[C.REC_T3])   : null,  // ผู้บันทึกจาก DC
    recRecv:     raw[C.REC_RECV] ? String(raw[C.REC_RECV]) : null,  // คนรับสินค้าฝั่งสาขา
    // Scan counts
    scanSend:  Number(raw[C.SCAN_SEND] || 0),
    scanRecv:  Number(raw[C.SCAN_RECV] || 0),
    scanShort,
    scanOver,
    // R008
    r008:       raw[C.R008]        ? String(raw[C.R008])        : null,
    r008Reason: raw[C.R008_REASON] ? String(raw[C.R008_REASON]) : null,
    r008Rec:    raw[C.R008_REC]    ? String(raw[C.R008_REC])    : null,
    r008Date:   raw[C.R008_DATE]   ?? null,
    // Computed
    status,
    diffItems,
    diffShortItems,
    diffOverItems,
    diffOtherItems,
    // Total diff quantities
    totalDiffShort: diffShortItems.reduce((s, d) => s + d.diffQty, 0),
    totalDiffOver:  diffOverItems.reduce((s, d)  => s + d.diffQty, 0),
    // Earliest save_time among all diff items for this document
    diffSaveTime: diffItems.reduce((earliest, d) => {
      if (!d.saveTimeRaw) return earliest;
      return (!earliest || d.saveTimeRaw < earliest) ? d.saveTimeRaw : earliest;
    }, null),
  };
}

/* ---- Public API ------------------------------------------------- */

/**
 * Process all raw rows — returns all enriched rows (full dataset).
 * Pass headers arrays to enable dynamic column detection.
 */
export function processData(mainRows, diffRows, mainHeaders = [], diffHeaders = []) {
  /* Rebuild column indices from header names (if headers provided) */
  if (mainHeaders.length) {
    C = buildColIndex(mainHeaders, CONFIG.COL_NAMES, CONFIG.COL);
  }
  if (diffHeaders.length) {
    DC = buildColIndex(diffHeaders, CONFIG.DIFF_COL_NAMES, CONFIG.DIFF_COL);
  }

  const diffIdx = buildDiffIndex(diffRows);
  return mainRows
    .filter(r => r && r[C.DOC_NO])
    .map(r => enrichRow(r, diffIdx));
}

/**
 * Filter to only shortage/surplus relevant records.
 * A record qualifies if it has: diff items OR R008 OR scanShort > 0 OR scanOver > 0.
 */
export function filterShortageRecords(allData) {
  return allData.filter(d => d.scanShort > 0 || d.scanOver > 0);
}

/**
 * Compute KPIs from the shortage/surplus records.
 */
export function computeKPIs(allData, shortageData, diffRows) {
  const totalDiffShort  = diffRows.filter(r => String(r[DC.REASON] ?? '').includes('ขาด')).length;
  const totalDiffOver   = diffRows.filter(r => String(r[DC.REASON] ?? '').includes('เกิน')).length;
  const totalDiffOther  = diffRows.filter(r => {
    const r4 = String(r[DC.REASON] ?? '');
    return !r4.includes('ขาด') && !r4.includes('เกิน');
  }).length;
  const totalDiffQtyShort = diffRows
    .filter(r => String(r[DC.REASON] ?? '').includes('ขาด'))
    .reduce((s, r) => s + Number(r[DC.DIFF_QTY] || 0), 0);
  const totalDiffQtyOver = diffRows
    .filter(r => String(r[DC.REASON] ?? '').includes('เกิน'))
    .reduce((s, r) => s + Number(r[DC.DIFF_QTY] || 0), 0);

  const r008True = shortageData.filter(d => d.r008 === 'ขาดจริง').length;
  const r008OK   = shortageData.filter(d => d.r008 === 'ไม่ขาดได้ครบ').length;

  const today = new Date().toISOString().slice(0, 10);
  const clearToday   = shortageData.filter(d =>
    d.diffSaveTime && d.diffSaveTime.toISOString().slice(0, 10) === today
  ).length;
  const waitingClear = shortageData.filter(d =>
    d.r008Reason && String(d.r008Reason).includes('กำลังตรวจสอบ')
  ).length;
  const notCleared   = shortageData.filter(d => d.r008 !== 'ไม่ขาดได้ครบ').length;
  const clearedCases = shortageData.filter(d => d.r008).length;

  return {
    totalDocs:   allData.length,
    shortageDocs: shortageData.length,
    // Diff line counts
    totalDiffShort,
    totalDiffOver,
    totalDiffOther,
    // Diff quantity sums
    totalDiffQtyShort,
    totalDiffQtyOver,
    // R008
    r008True,
    r008OK,
    // diff rows total
    totalDiffRows: diffRows.length,
    // Case management
    clearToday,
    waitingClear,
    notCleared,
    clearedCases,
  };
}

/**
 * Apply filter object to a data array.
 */
export function applyFilters(data, filters) {
  return data.filter(d => {
    if (filters.date       && d.queueDateKey !== filters.date)       return false;
    if (filters.branch     && d.branch       !== filters.branch)      return false;
    if (filters.warehouse  && d.warehouse    !== filters.warehouse)   return false;
    if (filters.r008Status && d.r008         !== filters.r008Status)  return false;
    if (filters.diffType) {
      if (filters.diffType === 'short' && d.diffShortItems.length === 0) return false;
      if (filters.diffType === 'over'  && d.diffOverItems.length === 0)  return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        d.docNo.toLowerCase().includes(q)       ||
        d.branch.toLowerCase().includes(q)      ||
        d.driver.toLowerCase().includes(q)      ||
        d.license.toLowerCase().includes(q)     ||
        d.warehouse.toLowerCase().includes(q)   ||
        (d.recT3  || '').toLowerCase().includes(q) ||
        (d.recRecv || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

/**
 * Get sorted unique values for a string field.
 */
export function uniqueValues(data, field) {
  const set = new Set(data.map(d => d[field]).filter(v => v && v !== '—'));
  return [...set].sort((a, b) => String(a).localeCompare(String(b), 'th'));
}
