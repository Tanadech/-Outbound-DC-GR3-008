/* ============================================================
   GLOBAL STATE — shortage/surplus report
   Custom DOM event bus (no circular imports):

     wms:data-loaded     — initial data ready
     wms:filter-changed  — any filter value updated
     wms:sort-changed    — sort column/direction changed
     wms:page-changed    — page or page-size changed
     wms:tab-changed     — active tab switched
     wms:modal-open      — detail modal should open  (detail: row)
     wms:modal-close     — detail modal should close
     wms:theme-changed   — dark/light toggled
   ============================================================ */

export const state = {
  loading: true,

  /* full enriched dataset */
  allData:      [],   // all rows from main xlsx

  /* shortage-filtered view (qualifies: has diff / R008 / short / over) */
  shortageData: [],

  /* current filtered + paginated view */
  filteredData: [],

  /* raw diff rows for the Diff tab */
  rawDiffRows:  [],

  /* computed KPIs */
  kpis: null,

  /* filter state */
  filters: {
    date:       '',
    branch:     '',
    warehouse:  '',
    r008Status: '',
    diffType:   '',   // '' | 'short' | 'over'
    search:     '',
  },

  /* table state */
  sort:     { field: 'queueDate', dir: 'desc' },
  page:     1,
  pageSize: 50,

  activeTab:   'shortage',
  selectedRow: null,
  theme:       'light',
};

/* ---- Mutation helpers ----------------------------------------- */

export function setLoading(flag) {
  state.loading = flag;
}

export function setData(allData, shortageData, rawDiffRows, kpis) {
  state.allData      = allData;
  state.shortageData = shortageData;
  state.filteredData = shortageData;
  state.rawDiffRows  = rawDiffRows;
  state.kpis         = kpis;
  state.loading      = false;
  document.dispatchEvent(new CustomEvent('wms:data-loaded'));
}

export function setFilteredData(data) {
  state.filteredData = data;
  state.page = 1;
}

export function setFilter(key, value) {
  state.filters[key] = value;
  state.page = 1;
  document.dispatchEvent(new CustomEvent('wms:filter-changed'));
}

export function clearFilters() {
  Object.keys(state.filters).forEach(k => { state.filters[k] = ''; });
  state.page = 1;
  document.dispatchEvent(new CustomEvent('wms:filter-changed'));
}

export function setSort(field, dir) {
  state.sort = { field, dir };
  state.page = 1;
  document.dispatchEvent(new CustomEvent('wms:sort-changed'));
}

export function setPage(page) {
  state.page = page;
  document.dispatchEvent(new CustomEvent('wms:page-changed'));
}

export function setPageSize(size) {
  state.pageSize = size;
  state.page = 1;
  document.dispatchEvent(new CustomEvent('wms:page-changed'));
}

export function setTab(tab) {
  state.activeTab = tab;
  document.dispatchEvent(new CustomEvent('wms:tab-changed'));
}

export function openModal(row) {
  state.selectedRow = row;
  document.dispatchEvent(new CustomEvent('wms:modal-open', { detail: row }));
}

export function closeModal() {
  state.selectedRow = null;
  document.dispatchEvent(new CustomEvent('wms:modal-close'));
}

export function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : '');
  document.dispatchEvent(new CustomEvent('wms:theme-changed'));
}
