/* ============================================================
   APP.JS — Shortage / Surplus Report (GR3-008 DC)
   ============================================================ */
import { CONFIG }                   from './data/config.js';
import { loadXlsx }                 from './lib/xlsx-loader.js';
import { processData, filterShortageRecords, computeKPIs } from './lib/data-processor.js';
import { formatNum, formatDate, esc as escHtml, daysAgo, truncate } from './lib/helpers.js';
import { state, setData, toggleTheme, openModal } from './state.js';

/* Register custom elements */
import './components/loading-spinner.js';
import './components/status-pill.js';
import './components/stat-card.js';
import './components/filter-bar.js';
import './components/data-table.js';
import './modals/detail-modal.js';

let activeWhFilter = null;
let _shortageData  = [];

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderShell();
  loadData();
});

/* ============================================================
   SHELL
   ============================================================ */
function renderShell() {
  renderTopbar();
  renderSidebar();
  renderMainContent();
}

/* ---- Topbar -------------------------------------------------- */
function renderTopbar() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });
  topbar.innerHTML = `
    <span class="brand-logo">GR3-008</span>
    <div class="topbar-divider"></div>
    <span class="topbar-title">รายงานสินค้าขาด/เกิน — Outbound DC</span>
    <div class="topbar-spacer"></div>
    <span class="topbar-date">${dateStr}</span>
    <div class="live-badge"><span class="live-dot"></span>LIVE</div>
    <button class="btn-theme" id="btn-theme">🌙 Dark</button>
  `;
  topbar.querySelector('#btn-theme')?.addEventListener('click', () => {
    toggleTheme();
    const btn = topbar.querySelector('#btn-theme');
    if (btn) btn.textContent = state.theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  });
}

/* ---- Sidebar ------------------------------------------------- */
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="sidebar-section-label">รายงาน</div>
    <div class="sidebar-item active">
      <span class="si-icon">⚠️</span><span>สินค้าขาด / เกิน</span>
    </div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">คำอธิบาย</div>
    <div class="sidebar-item" style="cursor:default;font-size:11px;color:#b0bec5;flex-direction:column;align-items:flex-start;gap:4px;padding:8px 16px">
      <div>🏭 <b>ผู้บันทึก DC</b> = ผู้บันทึก T3</div>
      <div>🏪 <b>ผู้บันทึก สาขา</b> = ผู้บันทึกรับ</div>
      <div>📦 <b>คลัง</b> = จาก T2+T3 gate</div>
      <div>🔴 <b>R008</b> = ผลนับหยาบ</div>
    </div>
    <div class="sidebar-footer">GR3-008 DC Report v2.1</div>
  `;
}

/* ---- Main content skeleton ----------------------------------- */
function renderMainContent() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1>รายงานสินค้าขาด / เกิน</h1>
        <div class="ph-sub">
          ตรวจสอบรายการที่มีความคลาดเคลื่อนระหว่างการส่งออกจาก DC และการรับสินค้าที่สาขา
        </div>
      </div>
      <div class="ph-actions">
        <span id="last-update" style="font-size:11px;color:var(--text-subtle)"></span>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid" id="kpi-grid">
      <stat-card label="กำลังโหลด…" value="—" color="grey" icon="⏳"></stat-card>
    </div>

    <!-- Main table — branch summary -->
    <div class="card" id="main-card" style="padding:0;overflow:hidden">
      <div id="branch-summary-wrap" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden"></div>
    </div>

    <!-- Detail modal (always in DOM) -->
    <detail-modal id="detail-modal"></detail-modal>
  `;
}

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  const spinner = document.createElement('loading-spinner');
  document.body.appendChild(spinner);

  try {
    let mainResult, diffResult;

    /* Try data.json first (GitHub Pages / auto-update mode) */
    try {
      const jsonResp = await fetch('./data/data.json');
      if (jsonResp.ok) {
        const json = await jsonResp.json();
        mainResult = json.main;
        diffResult = json.diff;
        const el = document.getElementById('last-update');
        if (el && json.updatedAt) {
          const d = new Date(json.updatedAt);
          el.textContent = `ข้อมูล ณ ${d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`;
        }
      } else { throw new Error('no json'); }
    } catch (_) {
      /* Fallback to xlsx (local dev) */
      [mainResult, diffResult] = await Promise.all([
        loadXlsx(CONFIG.FILES.main),
        loadXlsx(CONFIG.FILES.diff),
      ]);
    }

    const allData      = processData(mainResult.rows, diffResult.rows, mainResult.headers ?? [], diffResult.headers ?? []);
    const shortageData = filterShortageRecords(allData);
    const kpis         = computeKPIs(allData, shortageData, diffResult.rows);

    setData(allData, shortageData, diffResult.rows, kpis);
    _shortageData = shortageData;
    activeWhFilter = null;

    renderKPIs(kpis);
    renderBranchSummary(shortageData);
    updateLastUpdate();

  } catch (err) {
    console.error(err);
    showLoadError(err.message);
  } finally {
    spinner.remove();
  }

}

/* ============================================================
   KPI CARDS
   ============================================================ */
function renderKPIs(kpis) {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  const cards = [
    {
      label: 'เอกสารที่มีขาด/เกิน',
      value: formatNum(kpis.shortageDocs),
      color: 'danger',
      icon:  '📋',
      sub:   `จาก ${formatNum(kpis.totalDocs)} เอกสารทั้งหมด`,
    },
    {
      id:    'kpi-clear-today',
      label: 'ต้องเคลียร์เคสภายในวัน',
      value: formatNum(kpis.clearToday),
      color: 'warn',
      icon:  '⏰',
      sub:   'เอกสารที่บันทึก Diff วันนี้ · คลิกดูรายการ',
    },
    {
      id:    'kpi-cleared-same-day',
      label: 'เคลียร์เคสภายในวันแล้ว',
      value: formatNum(kpis.clearedSameDay),
      color: 'ok',
      icon:  '🎯',
      sub:   'R008 ตรงกับวันที่ถึงสาขา · คลิกดูรายการ',
    },
    {
      id:    'kpi-not-cleared',
      label: 'ยังไม่ได้เคลียร์',
      value: formatNum(kpis.notCleared),
      color: 'danger',
      icon:  '🚨',
      sub:   'เอกสารขาด/เกินที่ยังไม่มี R008 · คลิกดูรายการ',
    },
    {
      id:    'kpi-cleared',
      label: 'เคลียร์เคสแล้ว',
      value: formatNum(kpis.clearedCases),
      color: 'ok',
      icon:  '✅',
      sub:   'เอกสารขาด/เกิน ที่มีผล R008 แล้ว · คลิกดูรายการ',
    },
    {
      id:    'kpi-wh1',
      label: 'เอกสารขาด/เกิน คลัง WH1',
      value: formatNum(kpis.wh1Docs),
      color: 'accent',
      icon:  '📦',
      sub:   'คลิกเพื่อกรองสาขา WH1',
    },
    {
      id:    'kpi-wh2',
      label: 'เอกสารขาด/เกิน คลัง WH2',
      value: formatNum(kpis.wh2Docs),
      color: 'info',
      icon:  '📦',
      sub:   'คลิกเพื่อกรองสาขา WH2',
    },
    {
      id:    'kpi-wh3',
      label: 'เอกสารขาด/เกิน คลัง WH3',
      value: formatNum(kpis.wh3Docs),
      color: 'purple',
      icon:  '📦',
      sub:   'คลิกเพื่อกรองสาขา WH3',
    },
  ];

  const whIds       = new Set(['kpi-wh1', 'kpi-wh2', 'kpi-wh3']);
  const popupIds    = new Set(['kpi-cleared', 'kpi-clear-today', 'kpi-cleared-same-day', 'kpi-not-cleared']);

  grid.innerHTML = cards.map(c => {
    const clickable = popupIds.has(c.id) || whIds.has(c.id);
    const titleAttr = whIds.has(c.id) ? 'คลิกเพื่อกรองสาขาตามคลัง' : 'คลิกเพื่อดูรายการ';
    return `
      <stat-card ${c.id ? `id="${c.id}"` : ''} label="${c.label}" value="${c.value}"
                 color="${c.color}" icon="${c.icon}" sub="${c.sub}"
                 ${clickable ? `style="cursor:pointer" title="${titleAttr}"` : ''}></stat-card>`;
  }).join('');

  grid.querySelector('#kpi-cleared')?.addEventListener('click', () => {
    showClearedModal(kpis.clearedCasesList || []);
  });
  grid.querySelector('#kpi-clear-today')?.addEventListener('click', () => {
    showClearTodayModal(kpis.clearTodayList || []);
  });
  grid.querySelector('#kpi-cleared-same-day')?.addEventListener('click', () => {
    showClearedSameDayModal(kpis.clearedSameDayList || []);
  });
  grid.querySelector('#kpi-not-cleared')?.addEventListener('click', () => {
    showNotClearedModal(kpis.notClearedList || []);
  });

  grid.querySelector('#kpi-wh1')?.addEventListener('click', () => handleWhFilter('WH1'));
  grid.querySelector('#kpi-wh2')?.addEventListener('click', () => handleWhFilter('WH2'));
  grid.querySelector('#kpi-wh3')?.addEventListener('click', () => handleWhFilter('WH3'));
}

/* ============================================================
   CLEARED CASES MODAL
   ============================================================ */
function showClearedModal(rows) {
  document.getElementById('cleared-list-overlay')?.remove();

  const r008Pill = r => {
    if (!r) return '<span style="color:var(--text-subtle)">—</span>';
    let cls = 's5';
    if (r === 'ขาดจริง')      cls = 's0';
    else if (r === 'ไม่ขาดได้ครบ') cls = 's2';
    return `<span class="status-pill ${cls}">${escHtml(r)}</span>`;
  };

  const overlay = document.createElement('div');
  overlay.id = 'cleared-list-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:960px">
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="modal-title">✅ เคลียร์เคสแล้ว</div>
          <div class="modal-docno">${formatNum(rows.length)} เคส &nbsp;·&nbsp; จำนวนขาด=0 / จำนวนเกิน=0 / มีสาเหตุ R008</div>
        </div>
        <button class="modal-close" id="cleared-list-close">✕</button>
      </div>
      <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        ${rows.length === 0
          ? `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:14px">ไม่มีข้อมูล</div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>เลขที่เอกสาร</th>
                  <th>ชื่อสาขา</th>
                  <th>วันที่คิวงาน</th>
                  <th>สาเหตุ R008</th>
                  <th>ผู้บันทึก R008</th>
                  <th>วันที่บันทึก R008</th>
                </tr></thead>
                <tbody>
                  ${rows.map(d => `<tr>
                    <td class="td-mono">${escHtml(d.docNo)}</td>
                    <td>${escHtml(d.branch)}</td>
                    <td class="td-mono">${formatDate(d.queueDate)}</td>
                    <td>${escHtml(d.r008Reason || '—')}</td>
                    <td class="td-muted">${escHtml(d.r008Rec || '—')}</td>
                    <td class="td-mono">${formatDate(d.r008Date)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('cleared-list-close')?.addEventListener('click', close);
  const onEsc = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
}

/* ============================================================
   CLEAR TODAY MODAL  (⏰ ต้องเคลียร์เคสภายในวัน)
   ============================================================ */
function showClearTodayModal(rows) {
  document.getElementById('clear-today-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'clear-today-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:1020px">
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="modal-title">⏰ ต้องเคลียร์เคสภายในวัน</div>
          <div class="modal-docno">${formatNum(rows.length)} เคส &nbsp;·&nbsp; เอกสารที่บันทึก Diff วันนี้</div>
        </div>
        <button class="modal-close" id="clear-today-close">✕</button>
      </div>
      <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        ${rows.length === 0
          ? `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:14px">ไม่มีข้อมูล</div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>เลขที่เอกสาร</th>
                  <th>ชื่อสาขา</th>
                  <th class="td-center">คลัง</th>
                  <th class="td-center">วันที่คิวงาน</th>
                  <th class="td-center">ขาด (ชิ้น)</th>
                  <th class="td-center">เกิน (ชิ้น)</th>
                  <th class="td-center">รายการ Diff</th>
                  <th class="td-center">วันที่ถึงสาขา</th>
                  <th class="td-center">วันที่บันทึก R008</th>
                </tr></thead>
                <tbody>
                  ${rows.map(d => {
                    const shortVal = d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort;
                    const overVal  = d.totalDiffOver  > 0 ? d.totalDiffOver  : d.scanOver;
                    const arriveKey = d.arriveDate ? formatDate(d.arriveDate) : null;
                    const r008Key   = d.r008Date   ? formatDate(d.r008Date)   : null;
                    const sameDay   = arriveKey && r008Key && arriveKey === r008Key;
                    return `<tr${sameDay ? ' style="background:var(--ok-dim,rgba(34,197,94,.08))"' : ''}>
                      <td class="td-mono">${escHtml(d.docNo)}</td>
                      <td>${escHtml(d.branch)}</td>
                      <td class="td-center td-mono" style="color:var(--accent);font-weight:600">${escHtml(d.warehouse)}</td>
                      <td class="td-center td-mono">${formatDate(d.queueDate)}</td>
                      <td class="td-center">${shortVal > 0 ? `<span class="diff-badge short">${formatNum(shortVal)}</span>` : '<span class="td-muted">—</span>'}</td>
                      <td class="td-center">${overVal  > 0 ? `<span class="diff-badge over">${formatNum(overVal)}</span>`   : '<span class="td-muted">—</span>'}</td>
                      <td class="td-center">${d.diffItems.length > 0 ? `<span class="tab-count" style="background:var(--info-dim);color:var(--info-text)">${d.diffItems.length}</span>` : '<span class="td-muted">—</span>'}</td>
                      <td class="td-center td-mono" style="font-size:11px">${arriveKey ?? '<span class="td-muted">—</span>'}</td>
                      <td class="td-center td-mono" style="font-size:11px${sameDay ? ';color:var(--ok-text);font-weight:600' : ''}">
                        ${r008Key ? (sameDay ? `🎯 ${r008Key}` : r008Key) : '<span class="td-muted">—</span>'}
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('clear-today-close')?.addEventListener('click', close);
  const onEsc = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
}

/* ============================================================
   NOT CLEARED MODAL  (🚨 ยังไม่ได้เคลียร์)
   ============================================================ */
function showNotClearedModal(rows) {
  document.getElementById('not-cleared-overlay')?.remove();

  const r008Pill = r => {
    if (!r) return '<span style="color:var(--text-subtle)">—</span>';
    let cls = 's5';
    if (r === 'ขาดจริง')         cls = 's0';
    else if (r === 'ไม่ขาดได้ครบ') cls = 's2';
    return `<span class="status-pill ${cls}">${escHtml(r)}</span>`;
  };

  const overlay = document.createElement('div');
  overlay.id = 'not-cleared-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:1100px">
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="modal-title">🚨 ยังไม่ได้เคลียร์</div>
          <div class="modal-docno">${formatNum(rows.length)} เคส &nbsp;·&nbsp; เอกสารขาด/เกินที่ยังไม่มี R008 ผ่าน</div>
        </div>
        <button class="modal-close" id="not-cleared-close">✕</button>
      </div>
      <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        ${rows.length === 0
          ? `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:14px">ไม่มีข้อมูล</div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>เลขที่เอกสาร</th>
                  <th>ชื่อสาขา</th>
                  <th class="td-center">คลัง</th>
                  <th class="td-center">วันที่คิวงาน</th>
                  <th class="td-center">ขาด (ชิ้น)</th>
                  <th class="td-center">เกิน (ชิ้น)</th>
                  <th>สาเหตุ R008</th>
                  <th class="td-center">ผู้บันทึก R008</th>
                  <th class="td-center">วันที่บันทึก Diff</th>
                </tr></thead>
                <tbody>
                  ${rows.map(d => {
                    const shortVal = d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort;
                    const overVal  = d.totalDiffOver  > 0 ? d.totalDiffOver  : d.scanOver;
                    return `<tr>
                      <td class="td-mono">${escHtml(d.docNo)}</td>
                      <td>${escHtml(d.branch)}</td>
                      <td class="td-center td-mono" style="color:var(--accent);font-weight:600">${escHtml(d.warehouse)}</td>
                      <td class="td-center td-mono">${formatDate(d.queueDate)}</td>
                      <td class="td-center">${shortVal > 0 ? `<span class="diff-badge short">${formatNum(shortVal)}</span>` : '<span class="td-muted">—</span>'}</td>
                      <td class="td-center">${overVal  > 0 ? `<span class="diff-badge over">${formatNum(overVal)}</span>`   : '<span class="td-muted">—</span>'}</td>
                      <td>${escHtml(d.r008Reason || '—')}</td>
                      <td class="td-center td-muted">${escHtml(d.r008Rec || '—')}</td>
                      <td class="td-center td-mono" style="font-size:11px">${d.diffSaveTime ? formatDate(d.diffSaveTime) : '<span class="td-muted">—</span>'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('not-cleared-close')?.addEventListener('click', close);
  const onEsc = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
}

/* ============================================================
   CLEARED SAME-DAY MODAL  (🎯 เคลียร์เคสภายในวันแล้ว)
   ============================================================ */
function showClearedSameDayModal(rows) {
  document.getElementById('cleared-same-day-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cleared-same-day-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:1060px">
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="modal-title">🎯 เคลียร์เคสภายในวันแล้ว</div>
          <div class="modal-docno">${formatNum(rows.length)} เคส &nbsp;·&nbsp; วันที่บันทึก R008 ตรงกับวันที่ถึงสาขา</div>
        </div>
        <button class="modal-close" id="cleared-same-day-close">✕</button>
      </div>
      <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        ${rows.length === 0
          ? `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:14px">ไม่มีข้อมูล</div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>เลขที่เอกสาร</th>
                  <th>ชื่อสาขา</th>
                  <th class="td-center">คลัง</th>
                  <th class="td-center">วันที่คิวงาน</th>
                  <th class="td-center">ขาด (ชิ้น)</th>
                  <th class="td-center">เกิน (ชิ้น)</th>
                  <th>สาเหตุ R008</th>
                  <th class="td-center">วันที่ถึงสาขา</th>
                  <th class="td-center">วันที่บันทึก R008</th>
                  <th>ผู้บันทึก R008</th>
                </tr></thead>
                <tbody>
                  ${rows.map(d => {
                    const shortVal = d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort;
                    const overVal  = d.totalDiffOver  > 0 ? d.totalDiffOver  : d.scanOver;
                    return `<tr>
                      <td class="td-mono">${escHtml(d.docNo)}</td>
                      <td>${escHtml(d.branch)}</td>
                      <td class="td-center td-mono" style="color:var(--accent);font-weight:600">${escHtml(d.warehouse)}</td>
                      <td class="td-center td-mono">${formatDate(d.queueDate)}</td>
                      <td class="td-center">${shortVal > 0 ? `<span class="diff-badge short">${formatNum(shortVal)}</span>` : '<span class="td-muted">—</span>'}</td>
                      <td class="td-center">${overVal  > 0 ? `<span class="diff-badge over">${formatNum(overVal)}</span>`   : '<span class="td-muted">—</span>'}</td>
                      <td>${escHtml(d.r008Reason || '—')}</td>
                      <td class="td-center td-mono" style="font-size:11px">${formatDate(d.arriveDate)}</td>
                      <td class="td-center td-mono" style="font-size:11px;color:var(--ok-text);font-weight:600">🎯 ${formatDate(d.r008Date)}</td>
                      <td class="td-muted">${escHtml(d.r008Rec || '—')}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('cleared-same-day-close')?.addEventListener('click', close);
  const onEsc = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
}

/* ============================================================
   WAREHOUSE FILTER (KPI cards → branch summary)
   ============================================================ */
function handleWhFilter(wh) {
  activeWhFilter = activeWhFilter === wh ? null : wh;
  updateWhKpiStyles();
  const data = activeWhFilter
    ? _shortageData.filter(d => d.primaryWarehouse === activeWhFilter)
    : _shortageData;
  renderBranchSummary(data, activeWhFilter);
}

function updateWhKpiStyles() {
  const whIdMap = { WH1: 'kpi-wh1', WH2: 'kpi-wh2', WH3: 'kpi-wh3' };
  Object.entries(whIdMap).forEach(([wh, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (activeWhFilter === wh) {
      el.style.outline       = '3px solid var(--accent)';
      el.style.outlineOffset = '3px';
      el.style.borderRadius  = '12px';
    } else {
      el.style.outline       = '';
      el.style.outlineOffset = '';
      el.style.borderRadius  = '';
    }
  });
}

/* ============================================================
   BRANCH SUMMARY VIEW
   ============================================================ */
function renderBranchSummary(shortageData, activeFilter = null) {
  const wrap = document.getElementById('branch-summary-wrap');
  if (!wrap) return;

  const byBranch = {};
  for (const d of shortageData) {
    const key = d.branch || '—';
    if (!byBranch[key]) byBranch[key] = { branch: key, docs: [] };
    byBranch[key].docs.push(d);
  }

  const summaries = Object.values(byBranch).map(b => ({
    branch:        b.branch,
    docCount:      b.docs.length,
    sumShort:      b.docs.reduce((s, d) => s + (d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort), 0),
    sumOver:       b.docs.reduce((s, d) => s + (d.totalDiffOver  > 0 ? d.totalDiffOver  : d.scanOver),  0),
    r008Done:      b.docs.filter(d => d.r008Rec && d.r008Date && d.diffSaveTime).length,
    r008None:      b.docs.filter(d => !(d.r008Rec && d.r008Date && d.diffSaveTime)).length,
    totalDiffItems: b.docs.reduce((s, d) => s + d.diffItems.length, 0),
    wh1:           b.docs.filter(d => d.primaryWarehouse === 'WH1').length,
    wh2:           b.docs.filter(d => d.primaryWarehouse === 'WH2').length,
    wh3:           b.docs.filter(d => d.primaryWarehouse === 'WH3').length,
    latestDiff:    b.docs.reduce((latest, d) => {
      if (!d.diffSaveTime) return latest;
      return !latest || d.diffSaveTime > latest ? d.diffSaveTime : latest;
    }, null),
    docs:          b.docs,
  })).sort((a, b) => b.docCount - a.docCount);

  const totalShort     = summaries.reduce((s, b) => s + b.sumShort, 0);
  const totalOver      = summaries.reduce((s, b) => s + b.sumOver,  0);
  const totalR008      = summaries.reduce((s, b) => s + b.r008Done, 0);
  const totalNone      = summaries.reduce((s, b) => s + b.r008None, 0);
  const totalDiffItems = summaries.reduce((s, b) => s + b.totalDiffItems, 0);
  const totalWH1       = summaries.reduce((s, b) => s + b.wh1, 0);
  const totalWH2       = summaries.reduce((s, b) => s + b.wh2, 0);
  const totalWH3       = summaries.reduce((s, b) => s + b.wh3, 0);

  const ageBadge = (dt) => {
    if (!dt) return `<span class="td-muted">—</span>`;
    const days = daysAgo(dt);
    const ageCls = days === null ? 'other' : days <= 3 ? 'age-ok' : days <= 7 ? 'age-warn' : 'age-old';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <span class="age-badge ${ageCls}">${days ?? '?'} วัน</span>
      <span style="font-size:10px;color:var(--text-subtle);font-family:var(--font-mono)">${formatDate(dt)}</span>
    </div>`;
  };

  const whCell = n => n > 0
    ? `<span style="font-family:var(--font-mono);font-size:12px;font-weight:600">${n}</span>`
    : `<span class="td-muted">—</span>`;

  const filterBadge = activeFilter
    ? `<button id="wh-filter-clear"
         style="font-size:11px;padding:3px 10px;border:1.5px solid var(--accent);background:var(--accent-dim,rgba(99,102,241,.12));color:var(--accent);border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
         กรอง: <strong>${activeFilter}</strong> &nbsp;✕ ล้าง
       </button>`
    : '';

  wrap.innerHTML = `
    <div style="padding:12px 20px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px">
      <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;flex:1">
        สาขาที่มีขาด/เกิน${activeFilter ? ` — คลัง ${activeFilter}` : ''} &nbsp;·&nbsp; ${summaries.length} สาขา
      </span>
      ${filterBadge}
      <span style="font-size:11px;color:var(--text-subtle)">คลิกที่แถวสาขาเพื่อดูรายการเอกสาร</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>สาขา</th>
          <th class="td-center">จำนวนเอกสาร</th>
          <th class="td-center">WH1</th>
          <th class="td-center">WH2</th>
          <th class="td-center">WH3</th>
          <th class="td-center">รวมขาด (ชิ้น)</th>
          <th class="td-center">รวมเกิน (ชิ้น)</th>
          <th class="td-center">รวม Diff</th>
          <th class="td-center">วันล่าช้า</th>
          <th class="td-center">บันทึก R008</th>
          <th class="td-center">ไม่บันทึก R008</th>
        </tr></thead>
        <tbody>
          ${summaries.map((b, i) => `
            <tr data-idx="${i}" style="cursor:pointer" title="คลิกดูเอกสาร ${b.docCount} รายการ">
              <td style="font-weight:600;color:var(--text-primary)">${escHtml(b.branch)}</td>
              <td class="td-center">
                <span style="font-family:var(--font-mono);font-weight:700">${formatNum(b.docCount)}</span>
              </td>
              <td class="td-center">${whCell(b.wh1)}</td>
              <td class="td-center">${whCell(b.wh2)}</td>
              <td class="td-center">${whCell(b.wh3)}</td>
              <td class="td-center">
                ${b.sumShort > 0 ? `<span class="diff-badge short">${formatNum(b.sumShort)}</span>` : `<span class="td-muted">—</span>`}
              </td>
              <td class="td-center">
                ${b.sumOver > 0 ? `<span class="diff-badge over">${formatNum(b.sumOver)}</span>` : `<span class="td-muted">—</span>`}
              </td>
              <td class="td-center">
                ${b.totalDiffItems > 0 ? `<span class="tab-count" style="background:var(--info-dim);color:var(--info-text)">${b.totalDiffItems}</span>` : `<span class="td-muted">—</span>`}
              </td>
              <td class="td-center">${ageBadge(b.latestDiff)}</td>
              <td class="td-center">
                ${b.r008Done > 0 ? `<span class="diff-badge other" style="background:var(--ok-dim);color:var(--ok-text)">${formatNum(b.r008Done)}</span>` : `<span class="td-muted">—</span>`}
              </td>
              <td class="td-center">
                ${b.r008None > 0 ? `<span class="diff-badge short">${formatNum(b.r008None)}</span>` : `<span class="td-muted">—</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;border-top:2px solid var(--border)">
            <td style="color:var(--text-muted);font-size:11px">รวมทั้งหมด</td>
            <td class="td-center"><span style="font-family:var(--font-mono)">${formatNum(shortageData.length)}</span></td>
            <td class="td-center">${whCell(totalWH1)}</td>
            <td class="td-center">${whCell(totalWH2)}</td>
            <td class="td-center">${whCell(totalWH3)}</td>
            <td class="td-center">${totalShort > 0 ? `<span class="diff-badge short">${formatNum(totalShort)}</span>` : `<span class="td-muted">—</span>`}</td>
            <td class="td-center">${totalOver  > 0 ? `<span class="diff-badge over">${formatNum(totalOver)}</span>`   : `<span class="td-muted">—</span>`}</td>
            <td class="td-center">${totalDiffItems > 0 ? `<span class="tab-count" style="background:var(--info-dim);color:var(--info-text)">${totalDiffItems}</span>` : `<span class="td-muted">—</span>`}</td>
            <td class="td-center"><span class="td-muted">—</span></td>
            <td class="td-center">${totalR008 > 0 ? `<span class="diff-badge other" style="background:var(--ok-dim);color:var(--ok-text)">${formatNum(totalR008)}</span>` : `<span class="td-muted">—</span>`}</td>
            <td class="td-center">${totalNone > 0 ? `<span class="diff-badge short">${formatNum(totalNone)}</span>` : `<span class="td-muted">—</span>`}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="pagination">
      <div class="page-info">
        สรุปตามสาขา &nbsp;·&nbsp; <strong>${summaries.length}</strong> สาขา &nbsp;·&nbsp;
        เอกสารทั้งหมด <strong>${formatNum(shortageData.length)}</strong> รายการ
      </div>
    </div>
  `;

  wrap.querySelector('#wh-filter-clear')?.addEventListener('click', () => {
    handleWhFilter(activeWhFilter);
  });

  wrap.querySelectorAll('tbody tr[data-idx]').forEach(tr => {
    tr.addEventListener('click', () => {
      const b = summaries[+tr.dataset.idx];
      if (b) showBranchDocsModal(b.docs, b.branch);
    });
  });
}

function showBranchDocsModal(docs, branchName) {
  document.getElementById('branch-docs-overlay')?.remove();

  const sorted = [...docs].sort((a, b) => {
    const av = a.queueDate instanceof Date ? a.queueDate.getTime() : Number(a.queueDate ?? 0);
    const bv = b.queueDate instanceof Date ? b.queueDate.getTime() : Number(b.queueDate ?? 0);
    return bv - av;
  });

  const renderDocRow = d => {
    const shortN = d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort;
    const overN  = d.totalDiffOver  > 0 ? d.totalDiffOver  : d.scanOver;

    let saveAgeCell;
    if (!d.diffSaveTime) {
      saveAgeCell = `<span class="td-muted">—</span>`;
    } else {
      const days = daysAgo(d.diffSaveTime);
      const ageCls  = days === null ? 'other' : days <= 3 ? 'age-ok' : days <= 7 ? 'age-warn' : 'age-old';
      const ageLabel = days === null ? '?' : `${days} วัน`;
      saveAgeCell = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <span class="age-badge ${ageCls}">${ageLabel}</span>
        <span style="font-size:10px;color:var(--text-subtle);font-family:var(--font-mono)">${formatDate(d.diffSaveTime)}</span>
      </div>`;
    }

    return `<tr data-doc="${escHtml(d.docNo)}" style="cursor:pointer" title="คลิกดูรายละเอียด">
      <td class="td-mono"><span style="font-family:var(--font-mono);font-size:11px">${escHtml(d.docNo)}</span></td>
      <td class="td-mono">${escHtml(formatDate(d.queueDate))}</td>
      <td><span style="font-family:var(--font-mono);font-size:11px;color:var(--accent)">${escHtml(d.warehouse)}</span></td>
      <td>${d.recT3   ? escHtml(truncate(String(d.recT3),   20)) : `<span class="td-muted">—</span>`}</td>
      <td>${d.recRecv ? escHtml(truncate(String(d.recRecv), 20)) : `<span class="td-muted">—</span>`}</td>
      <td class="td-num td-right">${shortN > 0 ? `<span class="diff-badge short">${formatNum(shortN)}</span>` : `<span class="td-muted">—</span>`}</td>
      <td class="td-num td-right">${overN  > 0 ? `<span class="diff-badge over">${formatNum(overN)}</span>`   : `<span class="td-muted">—</span>`}</td>
      <td>${d.r008Reason ? `<span style="font-size:11px">${escHtml(truncate(d.r008Reason, 30))}</span>` : `<span class="td-muted">—</span>`}</td>
      <td class="td-muted" style="font-size:11px">${d.r008Rec ? escHtml(truncate(d.r008Rec, 20)) : `<span class="td-muted">—</span>`}</td>
      <td class="td-center td-mono" style="font-size:11px">${d.r008Date ? formatDate(d.r008Date) : `<span class="td-muted">—</span>`}</td>
      <td class="td-center td-mono" style="font-size:11px">${d.arriveDate ? formatDate(d.arriveDate) : `<span class="td-muted">—</span>`}</td>
      <td class="td-center">${d.diffItems.length > 0 ? `<span class="tab-count" style="background:var(--info-dim);color:var(--info-text)">${d.diffItems.length}</span>` : `<span class="td-muted">—</span>`}</td>
      <td class="td-center">${saveAgeCell}</td>
    </tr>`;
  };

  const overlay = document.createElement('div');
  overlay.id = 'branch-docs-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:1200px;width:96vw">
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="modal-title">📋 ${escHtml(branchName)}</div>
          <div class="modal-docno">เอกสารที่มีขาด/เกิน &nbsp;·&nbsp; ${formatNum(docs.length)} รายการ &nbsp;·&nbsp; คลิกเอกสารเพื่อดูรายละเอียด</div>
        </div>
        <button class="modal-close" id="branch-docs-close">✕</button>
      </div>
      <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>เลขที่เอกสาร</th>
              <th>วันที่คิว</th>
              <th>คลัง</th>
              <th>ผู้บันทึก DC</th>
              <th>ผู้บันทึก สาขา</th>
              <th class="td-right">ขาด (ชิ้น)</th>
              <th class="td-right">เกิน (ชิ้น)</th>
              <th>สาเหตุ R008</th>
              <th>ผู้บันทึก R008</th>
              <th class="td-center">วันที่บันทึก R008</th>
              <th class="td-center">วันที่ถึงสาขา</th>
              <th class="td-center">รายการ Diff</th>
              <th class="td-center">วันที่บันทึก Diff</th>
            </tr></thead>
            <tbody>${sorted.map(d => renderDocRow(d)).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('branch-docs-close')?.addEventListener('click', close);
  const onEsc = e => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);

  overlay.querySelectorAll('tbody tr[data-doc]').forEach(tr => {
    tr.addEventListener('click', () => {
      const row = docs.find(d => d.docNo === tr.dataset.doc);
      if (row) openModal(row);
    });
  });
}

/* ============================================================
   HELPERS
   ============================================================ */

function updateLastUpdate() {
  const el = document.getElementById('last-update');
  if (!el) return;
  const t = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  el.textContent = `อัปเดต: ${t}`;
}

function showLoadError(msg) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px;text-align:center">
      <div style="font-size:40px">⚠️</div>
      <div style="font-size:16px;font-weight:700;color:var(--danger-text)">โหลดข้อมูลไม่สำเร็จ</div>
      <div style="font-size:13px;color:var(--text-muted);max-width:480px">${escHtml(msg)}</div>
      <div style="font-size:12px;color:var(--text-subtle)">
        ต้องเปิดผ่าน Web Server<br>
        <code style="background:var(--surface);padding:4px 10px;border-radius:4px;font-family:monospace;margin-top:8px;display:inline-block">
          ดับเบิ้ลคลิก start.bat
        </code>
      </div>
    </div>`;
}
