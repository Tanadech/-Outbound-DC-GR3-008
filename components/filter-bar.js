/* ============================================================
   <filter-bar> — shortage report filters
   Filters: search, date, branch, warehouse, diff type, R008 status
   ============================================================ */
import { state, setFilter, clearFilters } from '../state.js';
import { uniqueValues } from '../lib/data-processor.js';

const R008_STATUSES = ['ขาดจริง', 'ไม่ขาดได้ครบ'];
const DIFF_TYPES    = [
  { value: 'short', label: 'สินค้าขาด' },
  { value: 'over',  label: 'สินค้าเกิน' },
];

export class FilterBar extends HTMLElement {
  connectedCallback() {
    this._render();
    document.addEventListener('wms:data-loaded', () => this._render());
  }

  /** Update the result count label — called by app.js after filter applied */
  updateCount() {
    const el = this.querySelector('#fb-count');
    if (!el) return;
    const total    = state.shortageData.length;
    const filtered = state.filteredData.length;
    el.innerHTML =
      `แสดง <strong>${filtered.toLocaleString()}</strong> จาก <strong>${total.toLocaleString()}</strong> รายการ`;
  }

  _render() {
    const { filters, shortageData } = state;

    const dates      = this._uniqueDates(shortageData);
    const branches   = uniqueValues(shortageData, 'branch');
    const warehouses = uniqueValues(shortageData, 'warehouse');

    const opt = (val, label, sel) =>
      `<option value="${val}"${sel === val ? ' selected' : ''}>${label}</option>`;

    this.innerHTML = `
      <div class="filter-bar">

        <div class="search-wrap">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="fb-search" class="search-input" type="text"
            placeholder="ค้นหา เลขที่เอกสาร, สาขา, คลัง, ผู้บันทึก…"
            value="${filters.search}" autocomplete="off">
        </div>

        <div class="filter-group">
          <label>วันที่</label>
          <select id="fb-date" class="filter-control" style="min-width:160px">
            <option value="">ทั้งหมด</option>
            ${dates.map(d => opt(d, this._labelDate(d), filters.date)).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label>สาขา</label>
          <select id="fb-branch" class="filter-control" style="min-width:150px">
            <option value="">ทั้งหมด</option>
            ${branches.map(v => opt(v, v, filters.branch)).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label>คลัง</label>
          <select id="fb-warehouse" class="filter-control">
            <option value="">ทั้งหมด</option>
            ${warehouses.map(v => opt(v, v, filters.warehouse)).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label>ประเภทขาด/เกิน</label>
          <select id="fb-difftype" class="filter-control">
            <option value="">ทั้งหมด</option>
            ${DIFF_TYPES.map(t => opt(t.value, t.label, filters.diffType)).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label>สถานะ R008</label>
          <select id="fb-r008" class="filter-control">
            <option value="">ทั้งหมด</option>
            ${R008_STATUSES.map(v => opt(v, v, filters.r008Status)).join('')}
          </select>
        </div>

        <button id="fb-clear" class="btn-clear-filter">✕ ล้าง</button>
        <span id="fb-count" class="filter-result-count"></span>
      </div>
    `;

    this._attachEvents();
    this.updateCount();
  }

  _attachEvents() {
    const bindings = [
      ['#fb-search',    'input',  e => setFilter('search',     e.target.value)],
      ['#fb-date',      'change', e => setFilter('date',        e.target.value)],
      ['#fb-branch',    'change', e => setFilter('branch',      e.target.value)],
      ['#fb-warehouse', 'change', e => setFilter('warehouse',   e.target.value)],
      ['#fb-difftype',  'change', e => setFilter('diffType',    e.target.value)],
      ['#fb-r008',      'change', e => setFilter('r008Status',  e.target.value)],
    ];
    for (const [sel, evt, fn] of bindings) {
      this.querySelector(sel)?.addEventListener(evt, fn);
    }
    this.querySelector('#fb-clear')?.addEventListener('click', () => {
      clearFilters();
      this._render();
    });
  }

  _uniqueDates(data) {
    const set = new Set(data.map(d => d.queueDateKey).filter(Boolean));
    return [...set].sort().reverse();
  }

  _labelDate(key) {
    if (!key) return key;
    const d = new Date(key);
    return d.toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
    });
  }
}

customElements.define('filter-bar', FilterBar);
