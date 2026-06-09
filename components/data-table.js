/* ============================================================
   <data-table> — shortage report table
   Columns: เลขที่เอกสาร, สาขา, วันที่, คลัง, ผู้บันทึก DC,
            ผู้บันทึก สาขา, ขาด, เกิน, R008, สาเหตุ R008,
            ผู้บันทึก R008, รายการ
   ============================================================ */
import { state, setSort, setPage, setPageSize, openModal } from '../state.js';
import { formatDate, formatNum, esc, truncate, daysAgo } from '../lib/helpers.js';
import { CONFIG } from '../data/config.js';

const COLS = [
  { key: 'docNo',      label: 'เลขที่เอกสาร',        cls: 'td-mono',    sortable: true  },
  { key: 'branch',     label: 'สาขา',                 cls: '',           sortable: true  },
  { key: 'queueDate',  label: 'วันที่คิว',              cls: 'td-mono',    sortable: true  },
  { key: 'warehouse',  label: 'คลัง',                  cls: 'td-mono',    sortable: true  },
  { key: 'recT3',      label: 'ผู้บันทึก DC',          cls: '',           sortable: true  },
  { key: 'recRecv',    label: 'ผู้บันทึก สาขา',        cls: '',           sortable: true  },
  { key: '_short',     label: 'ขาด (ชิ้น)',            cls: 'td-num td-right', sortable: true, virtual: true },
  { key: '_over',      label: 'เกิน (ชิ้น)',           cls: 'td-num td-right', sortable: true, virtual: true },
  { key: 'r008',       label: 'R008',                  cls: 'td-center',  sortable: true  },
  { key: 'r008Reason', label: 'สาเหตุ R008',           cls: '',           sortable: false },
  { key: 'r008Rec',    label: 'ผู้บันทึก R008',        cls: 'td-muted',   sortable: false },
  { key: '_diffCount', label: 'รายการ Diff',           cls: 'td-center',  sortable: true, virtual: true },
  { key: '_saveAge',   label: 'วันที่บันทึก Diff',     cls: 'td-center',  sortable: true, virtual: true },
];

export class DataTable extends HTMLElement {
  connectedCallback() {
    this._render();
    document.addEventListener('wms:data-loaded',   () => this._render());
    document.addEventListener('wms:filter-changed', () => this._render());
    document.addEventListener('wms:sort-changed',   () => this._render());
    document.addEventListener('wms:page-changed',   () => this._render());
  }

  _render() {
    const { filteredData, sort, page, pageSize } = state;
    const sorted     = this._sort(filteredData, sort);
    const totalRows  = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage   = Math.min(Math.max(1, page), totalPages);
    const slice      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    this.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${this._renderHeaders(sort)}</tr></thead>
          <tbody>
            ${slice.length
              ? slice.map(r => this._renderRow(r)).join('')
              : `<tr class="no-data-row"><td colspan="${COLS.length}">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${totalRows > 0 ? this._renderPagination(safePage, totalPages, totalRows, pageSize) : ''}
    `;

    this._attachEvents();
  }

  _renderHeaders(sort) {
    return COLS.map(col => {
      let cls = col.sortable ? 'sortable' : '';
      const sortKey = col.virtual ? col.key : col.key;
      if (col.sortable && sort.field === sortKey) {
        cls += sort.dir === 'asc' ? ' sort-asc' : ' sort-desc';
      }
      const arrow = col.sortable
        ? `<span class="sort-icon">${sort.field === sortKey ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>`
        : '';
      return `<th class="${cls}" data-col="${sortKey}" ${col.sortable ? '' : 'style="cursor:default"'}>${col.label}${arrow}</th>`;
    }).join('');
  }

  _renderRow(d) {
    const cells = COLS.map(col => {
      let val = '';
      switch (col.key) {
        case 'queueDate':
          val = esc(formatDate(d.queueDate));
          break;

        case 'warehouse':
          val = `<span style="font-family:var(--font-mono);font-size:11px;color:var(--accent)">${esc(d.warehouse)}</span>`;
          break;

        case 'recT3':
          val = d.recT3 ? esc(truncate(String(d.recT3), 20)) : `<span class="td-muted">—</span>`;
          break;

        case 'recRecv':
          val = d.recRecv ? esc(truncate(String(d.recRecv), 20)) : `<span class="td-muted">—</span>`;
          break;

        case '_short': {
          // Use diff file total if available, else fall back to scanShort
          const n = d.totalDiffShort > 0 ? d.totalDiffShort : d.scanShort;
          val = n > 0
            ? `<span class="diff-badge short">${formatNum(n)}</span>`
            : `<span class="td-muted">—</span>`;
          break;
        }

        case '_over': {
          const n = d.totalDiffOver > 0 ? d.totalDiffOver : d.scanOver;
          val = n > 0
            ? `<span class="diff-badge over">${formatNum(n)}</span>`
            : `<span class="td-muted">—</span>`;
          break;
        }

        case 'r008': {
          if (!d.r008) { val = `<span class="td-muted">—</span>`; break; }
          const isShort = d.r008 === 'ขาดจริง';
          const isOK    = d.r008 === 'ไม่ขาดได้ครบ';
          const cls = isShort ? 'short' : isOK ? 'over' : 'other';
          val = `<span class="diff-badge ${cls}">${esc(d.r008)}</span>`;
          break;
        }

        case 'r008Reason':
          val = d.r008Reason
            ? `<span style="font-size:11px">${esc(truncate(d.r008Reason, 30))}</span>`
            : `<span class="td-muted">—</span>`;
          break;

        case 'r008Rec':
          val = d.r008Rec
            ? `<span style="font-size:11px">${esc(truncate(String(d.r008Rec), 20))}</span>`
            : `<span class="td-muted">—</span>`;
          break;

        case '_diffCount': {
          const n = d.diffItems.length;
          val = n > 0
            ? `<span class="tab-count" style="background:var(--info-dim);color:var(--info-text)">${n}</span>`
            : `<span class="td-muted">—</span>`;
          break;
        }

        case '_saveAge': {
          if (!d.diffSaveTime) { val = `<span class="td-muted">—</span>`; break; }
          const days = daysAgo(d.diffSaveTime);
          const dateStr = formatDate(d.diffSaveTime);
          const ageCls  = days === null ? 'other'
                        : days <= 3    ? 'age-ok'
                        : days <= 7    ? 'age-warn'
                        : 'age-old';
          const ageLabel = days === null ? '?' : `${days} วัน`;
          val = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span class="age-badge ${ageCls}">${ageLabel}</span>
            <span style="font-size:10px;color:var(--text-subtle);font-family:var(--font-mono)">${dateStr}</span>
          </div>`;
          break;
        }

        case 'branch':
          val = esc(truncate(d.branch, 20));
          break;

        case 'docNo':
          val = `<span style="font-family:var(--font-mono);font-size:11px">${esc(d.docNo)}</span>`;
          break;

        default:
          val = esc(String(d[col.key] ?? '—'));
      }
      return `<td class="${col.cls ?? ''}">${val}</td>`;
    }).join('');

    return `<tr data-doc="${esc(d.docNo)}" title="คลิกเพื่อดูรายละเอียด">${cells}</tr>`;
  }

  _renderPagination(page, totalPages, total, pageSize) {
    const start = (page - 1) * pageSize + 1;
    const end   = Math.min(page * pageSize, total);
    const nums  = this._pageNumbers(page, totalPages);

    const sizeOpts = CONFIG.PAGE_SIZE_OPTIONS.map(n =>
      `<option value="${n}"${n === pageSize ? ' selected' : ''}>${n} ต่อหน้า</option>`
    ).join('');

    return `
      <div class="pagination">
        <div class="page-info">
          แสดง <strong>${start.toLocaleString()}–${end.toLocaleString()}</strong>
          จาก <strong>${total.toLocaleString()}</strong> รายการ
        </div>
        <div class="page-btns">
          <button class="page-btn" data-pg="prev" ${page <= 1 ? 'disabled' : ''}>‹</button>
          ${nums.map(n =>
            n === '…'
              ? `<button class="page-btn" disabled>…</button>`
              : `<button class="page-btn${n === page ? ' active' : ''}" data-pg="${n}">${n}</button>`
          ).join('')}
          <button class="page-btn" data-pg="next" ${page >= totalPages ? 'disabled' : ''}>›</button>
        </div>
        <select class="per-page-select" id="per-page-sel">${sizeOpts}</select>
      </div>
    `;
  }

  _pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('…');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  _sort(data, { field, dir }) {
    if (!field || !data?.length) return data ?? [];
    return [...data].sort((a, b) => {
      let av, bv;
      /* virtual sort keys */
      if (field === '_short')          { av = a.totalDiffShort || a.scanShort; bv = b.totalDiffShort || b.scanShort; }
      else if (field === '_over')      { av = a.totalDiffOver  || a.scanOver;  bv = b.totalDiffOver  || b.scanOver; }
      else if (field === '_diffCount') { av = a.diffItems.length; bv = b.diffItems.length; }
      else if (field === '_saveAge')   { av = a.diffSaveTime ?? new Date(0); bv = b.diffSaveTime ?? new Date(0); }
      else { av = a[field]; bv = b[field]; }

      if (av instanceof Date) av = av.getTime();
      if (bv instanceof Date) bv = bv.getTime();
      av = av ?? '';
      bv = bv ?? '';

      const cmp = (typeof av === 'number' && typeof bv === 'number')
        ? av - bv
        : String(av).localeCompare(String(bv), 'th');
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  _attachEvents() {
    /* Sort header clicks */
    this.querySelectorAll('th.sortable[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        const dir = state.sort.field === col && state.sort.dir === 'asc' ? 'desc' : 'asc';
        setSort(col, dir);
      });
    });

    /* Row click → open modal */
    this.querySelectorAll('tbody tr[data-doc]').forEach(tr => {
      tr.addEventListener('click', () => {
        const row = state.filteredData.find(d => d.docNo === tr.dataset.doc);
        if (row) openModal(row);
      });
    });

    /* Pagination */
    this.querySelectorAll('.page-btn[data-pg]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const val = btn.dataset.pg;
        const cur = state.page;
        const tot = Math.ceil(state.filteredData.length / state.pageSize);
        const next = val === 'prev' ? cur - 1 : val === 'next' ? cur + 1 : Number(val);
        if (next >= 1 && next <= tot) setPage(next);
      });
    });

    this.querySelector('#per-page-sel')?.addEventListener('change', e => {
      setPageSize(Number(e.target.value));
    });
  }
}

customElements.define('data-table', DataTable);
