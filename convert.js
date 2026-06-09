/**
 * convert.js — Excel → data/data.json
 * Usage: node convert.js
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT     = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const LOG_DIR  = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'update.log');
const OUT_FILE = path.join(DATA_DIR, 'data.json');

const FILES = {
  main: path.join(DATA_DIR, 'data outbound dc.xlsx'),
  diff: path.join(DATA_DIR, 'data outbound diff.xlsx'),
};

function log(msg) {
  const ts = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
}

function readSheet(filepath) {
  const wb  = XLSX.readFile(filepath, { cellDates: true, raw: false });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const rows = all.slice(1).map(row =>
    row.map(cell => (cell instanceof Date ? cell.toISOString() : cell))
  );
  return { headers: all[0] ?? [], rows };
}

try {
  log('=== convert start ===');

  for (const [key, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) throw new Error(`ไม่พบไฟล์ ${key}: ${file}`);
  }

  const main = readSheet(FILES.main);
  const diff = readSheet(FILES.diff);

  const output = { updatedAt: new Date().toISOString(), main, diff };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output), 'utf8');

  log(`convert OK — main: ${main.rows.length} rows, diff: ${diff.rows.length} rows`);
  log(`output: ${OUT_FILE}`);
  process.exit(0);
} catch (err) {
  log(`ERROR: ${err.message}`);
  process.exit(1);
}
