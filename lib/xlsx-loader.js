/* ============================================================
   XLSX LOADER — wraps SheetJS (loaded via CDN as window.XLSX)
   ============================================================ */

/**
 * Fetch an xlsx file and parse it into row arrays.
 * Returns { headers: string[], rows: any[][] }
 *
 * Requires SheetJS to be loaded as window.XLSX before calling.
 */
export async function loadXlsx(path) {
  const resp = await fetch(path);
  if (!resp.ok) {
    throw new Error(`ไม่สามารถโหลดไฟล์ ${path} (HTTP ${resp.status})`);
  }

  const arrayBuffer = await resp.arrayBuffer();

  const wb = window.XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,   // parse date cells into JS Date objects
    raw: false,        // let SheetJS coerce values
  });

  const sheet = wb.Sheets[wb.SheetNames[0]];

  const all = window.XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (all.length === 0) return { headers: [], rows: [] };

  return {
    headers: (all[0] ?? []).map(h => String(h ?? '')),
    rows: all.slice(1),
  };
}
