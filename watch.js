/**
 * watch.js — File watcher: Excel changed → convert → git push
 * Usage: node watch.js
 * Stop:  Ctrl+C
 */
const chokidar = require('chokidar');
const { spawnSync } = require('child_process');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT      = __dirname;
const DATA_DIR  = path.join(ROOT, 'data');
const LOG_DIR   = path.join(ROOT, 'logs');
const LOG_FILE  = path.join(LOG_DIR, 'update.log');
const HASH_FILE = path.join(LOG_DIR, '.last-hash');

const WATCH_FILES = [
  path.join(DATA_DIR, 'data outbound dc.xlsx'),
  path.join(DATA_DIR, 'data outbound diff.xlsx'),
];

/* ---- Helpers ---------------------------------------------------- */

function log(msg) {
  const ts   = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
}

function fileHash() {
  return WATCH_FILES.map(f => {
    try { return crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); }
    catch (_) { return 'missing'; }
  }).join(':');
}

function lastHash() {
  try { return fs.readFileSync(HASH_FILE, 'utf8').trim(); } catch (_) { return ''; }
}

function saveHash(h) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(HASH_FILE, h, 'utf8');
}

function notify(title, msg) {
  try {
    spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; ` +
      `[System.Windows.Forms.MessageBox]::Show('${msg.replace(/'/g, '"')}','${title}')`
    ], { timeout: 8000 });
  } catch (_) {}
}

/* ---- Core update logic ------------------------------------------ */

function runUpdate() {
  const current = fileHash();
  if (current === lastHash()) {
    log('ไม่มีการเปลี่ยนแปลง — ข้าม');
    return;
  }

  log('ตรวจพบการเปลี่ยนแปลง — เริ่ม convert...');

  // 1. Convert Excel → JSON
  const conv = spawnSync('node', ['convert.js'], {
    cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
  });
  if (conv.status !== 0) {
    const err = (conv.stderr || conv.stdout || 'unknown').trim();
    log(`convert FAILED: ${err}`);
    notify('GR3-008 Update Error', `convert.js failed:\n${err.slice(0, 300)}`);
    return;
  }
  log('convert สำเร็จ');

  // 2. git add
  const add = spawnSync('git', ['add', 'data/data.json'], { cwd: ROOT, encoding: 'utf8' });
  if (add.status !== 0) {
    log(`git add FAILED: ${add.stderr}`);
    return;
  }

  // 3. Check if anything staged
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT });
  if (diff.status === 0) {
    log('data.json ไม่เปลี่ยนแปลง — ไม่ commit');
    saveHash(current);
    return;
  }

  // 4. Commit
  const now       = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const gitCommit = spawnSync('git', ['commit', '-m', `auto-update: data.json [${now}]`], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (gitCommit.status !== 0) {
    log(`git commit FAILED: ${gitCommit.stderr}`);
    return;
  }

  // 5. Push
  const push = spawnSync('git', ['push'], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  if (push.status !== 0) {
    log(`git push FAILED: ${push.stderr}`);
    notify('GR3-008 Update ไม่สำเร็จ', `git push failed:\n${push.stderr.slice(0, 300)}`);
    return;
  }

  saveHash(current);
  log('git push สำเร็จ ✓');
}

/* ---- Main ------------------------------------------------------- */

log('=== watch.js started ===');
WATCH_FILES.forEach(f => log(`monitoring: ${path.basename(f)}`));

// Run once immediately on start
runUpdate();

// Watch for file changes
let debounce = null;
const watcher = chokidar.watch(WATCH_FILES, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 },
});

watcher.on('change', file => {
  log(`changed: ${path.basename(file)}`);
  clearTimeout(debounce);
  debounce = setTimeout(runUpdate, 5000); // รอ 5s หลัง Excel ถูกปิด
});

watcher.on('error', err => log(`watcher error: ${err.message}`));

log('กำลัง monitor ไฟล์ Excel... (Ctrl+C เพื่อหยุด)');
