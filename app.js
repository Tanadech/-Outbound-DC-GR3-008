/* ============================================================
   APP.JS — Shortage / Surplus Report (GR3-008 DC)
   ============================================================ */
import { CONFIG }                   from './data/config.js';
import { loadXlsx }                 from './lib/xlsx-loader.js';
import { processData, filterShortageRecords, computeKPIs, applyFilters } from './lib/data-processor.js';
import { formatNum, formatDate, esc as escHtml } from './lib/helpers.js';
import { state, setData, setFilteredData, toggleTheme } from './state.js';

/* Register custom elements */
import './components/loading-spinner.js';
import './components/status-pill.js';
import './components/stat-card.js';
import './components/filter-bar.js';
import './components/data-table.js';
import './modals/detail-modal.js';


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

    <!-- Charts + Summary cards -->
    <div class="charts-row" id="charts-row" style="display:none">
      <!-- Left: daily bar chart -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">เอกสารขาด/เกิน รายวัน</div>
            <div class="card-subtitle">จำนวนเอกสารที่มีปัญหาต่อวัน</div>
          </div>
        </div>
        <div class="card-body" style="height:180px">
          <canvas id="chart-daily" style="width:100%;height:100%"></canvas>
        </div>
      </div>
      <!-- Right: case management cards -->
      <div class="case-cards-col" id="case-cards-col"></div>
    </div>

    <!-- Main table (no tab wrapper) -->
    <div class="card" id="main-card">
      <filter-bar id="main-filter-bar"></filter-bar>
      <data-table  id="main-data-table"></data-table>
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

    renderKPIs(kpis);
    renderCharts(shortageData);
    renderCaseCards(kpis);
    updateLastUpdate();

    document.getElementById('charts-row').style.display = '';

  } catch (err) {
    console.error(err);
    showLoadError(err.message);
  } finally {
    spinner.remove();
  }

  /* React to filter changes */
  document.addEventListener('wms:filter-changed', () => {
    const filtered = applyFilters(state.shortageData, state.filters);
    setFilteredData(filtered);
    document.querySelector('filter-bar')?.updateCount?.();
  });
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
      label: 'รายการสินค้าขาด',
      value: formatNum(kpis.totalDiffShort),
      color: 'danger',
      icon:  '📉',
      sub:   `รวม ${formatNum(kpis.totalDiffQtyShort)} ชิ้น`,
    },
    {
      label: 'รายการสินค้าเกิน',
      value: formatNum(kpis.totalDiffOver),
      color: 'warn',
      icon:  '📈',
      sub:   `รวม ${formatNum(kpis.totalDiffQtyOver)} ชิ้น`,
    },
    {
      label: 'ไม่มีข้อมูลในระบบ',
      value: formatNum(kpis.totalDiffOther),
      color: 'grey',
      icon:  '❓',
      sub:   'รายการที่ระบบไม่รู้จัก',
    },
    {
      label: 'R008 — ขาดจริง',
      value: formatNum(kpis.r008True),
      color: 'purple',
      icon:  '🔴',
      sub:   'DC ยืนยันสินค้าขาดจริง',
    },
    {
      label: 'R008 — ไม่ขาดได้ครบ',
      value: formatNum(kpis.r008OK),
      color: 'ok',
      icon:  '✅',
      sub:   'นับครบในใบนับละเอียด',
    },
    {
      label: 'Diff รวมทั้งหมด',
      value: formatNum(kpis.totalDiffRows),
      color: 'accent',
      icon:  '🔍',
      sub:   'รายการใน diff file',
    },
  ];

  grid.innerHTML = cards.map(c => `
    <stat-card label="${c.label}" value="${c.value}" color="${c.color}"
               icon="${c.icon}" sub="${c.sub}"></stat-card>
  `).join('');
}

/* ============================================================
   CHARTS
   ============================================================ */
function renderCharts(shortageData) {
  if (!window.Chart) return;
  renderDailyChart(shortageData);
}

function getTheme() {
  const isDark = state.theme !== 'light';
  return {
    isDark,
    text:      isDark ? '#9db5cc' : '#637381',
    grid:      isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
    tooltipBg: isDark ? '#0a1628' : '#ffffff',
    tooltipFg: isDark ? '#f1f5f9' : '#1C252E',
    brd:       isDark ? 'rgba(56,189,248,.3)' : 'rgba(253,169,45,.3)',
  };
}


function renderDailyChart(data) {
  const ctx = document.getElementById('chart-daily');
  if (!ctx) return;

  const byDate = {};
  for (const d of data) {
    if (!d.queueDateKey) continue;
    byDate[d.queueDateKey] = (byDate[d.queueDateKey] ?? 0) + 1;
  }
  const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
  const labels = sorted.map(([k]) =>
    new Date(k).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  );
  const values = sorted.map(([, v]) => v);
  const t = getTheme();
  const accent = t.isDark ? '#f87171' : '#FF5630';

  if (ctx._chart) ctx._chart.destroy();
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'เอกสารขาด/เกิน',
        data: values,
        backgroundColor: accent + '55',
        borderColor: accent,
        borderWidth: 1.5,
        borderRadius: 3,
        hoverBackgroundColor: accent + 'aa',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.tooltipBg, titleColor: t.tooltipFg, bodyColor: t.tooltipFg,
          borderColor: t.brd, borderWidth: 1,
          callbacks: { label: c => ` ${c.parsed.y} เอกสาร` },
        },
      },
      scales: {
        x: { ticks: { color: t.text, font: { size: 10, family: "'Sarabun',sans-serif" }, maxRotation: 45 }, grid: { color: t.grid } },
        y: { ticks: { color: t.text, font: { size: 10, family: "'Sarabun',sans-serif" }, stepSize: 1 }, grid: { color: t.grid }, beginAtZero: true },
      },
    },
  });
}

/* ============================================================
   CASE MANAGEMENT CARDS
   ============================================================ */
function renderCaseCards(kpis) {
  const col = document.getElementById('case-cards-col');
  if (!col) return;

  col.innerHTML = `
    <!-- Row 1 -->
    <div class="case-card case-card--urgent">
      <div class="case-card-icon">⏰</div>
      <div class="case-card-body">
        <div class="case-card-label">ต้องเคลียร์เคสภายในวัน</div>
        <div class="case-card-value">${formatNum(kpis.clearToday)}</div>
        <div class="case-card-sub">เอกสารที่บันทึก Diff วันนี้</div>
      </div>
    </div>
    <div class="case-card case-card--pending">
      <div class="case-card-icon">🚨</div>
      <div class="case-card-body">
        <div class="case-card-label">ยังไม่ได้เคลียร์</div>
        <div class="case-card-value">${formatNum(kpis.notCleared)}</div>
        <div class="case-card-sub">เอกสารขาด/เกินที่ยังไม่มี R008</div>
      </div>
    </div>
    <!-- Row 2 -->
    <div class="case-card case-card--waiting">
      <div class="case-card-icon">🔍</div>
      <div class="case-card-body">
        <div class="case-card-label">รอเคลียร์เคส</div>
        <div class="case-card-value">${formatNum(kpis.waitingClear)}</div>
        <div class="case-card-sub">สาเหตุ R008: กำลังตรวจสอบ</div>
      </div>
    </div>
    <div class="case-card case-card--cleared">
      <div class="case-card-icon">✅</div>
      <div class="case-card-body">
        <div class="case-card-label">เคลียร์เคสแล้ว</div>
        <div class="case-card-value">${formatNum(kpis.clearedCases)}</div>
        <div class="case-card-sub">เอกสารขาด/เกิน ที่มีผล R008 แล้ว</div>
      </div>
    </div>
  `;
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
