/* ============================================================
   <detail-modal> — shortage/surplus order detail
   Sections:
     1. ข้อมูลเอกสาร (document + logistics)
     2. ข้อมูลผู้รับผิดชอบ (recorders)
     3. R008 (conditional)
     4. รายการสินค้าขาด/เกิน (diff items table)
   ============================================================ */
import { closeModal } from '../state.js';
import { formatDate, formatNum, esc, diffCategoryMeta } from '../lib/helpers.js';

export class DetailModal extends HTMLElement {
  connectedCallback() {
    this.style.display = 'none';
    document.addEventListener('wms:modal-open',  e  => this._open(e.detail));
    document.addEventListener('wms:modal-close', () => this._close());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  _open(row) {
    this._render(row);
    this.style.display = '';
    document.body.style.overflow = 'hidden';
  }

  _close() {
    this.style.display = 'none';
    document.body.style.overflow = '';
  }

  _render(d) {
    const field = (label, val, mono = false, full = false) => {
      const empty = !val || val === '—';
      return `
        <div class="modal-field${full ? ' full' : ''}">
          <div class="modal-field-label">${label}</div>
          <div class="modal-field-value${mono ? '' : ' plain'}${empty ? ' empty' : ''}">
            ${esc(String(val || '—'))}
          </div>
        </div>`;
    };

    /* Diff items table */
    const hasDiff = d.diffItems.length > 0;
    const diffHtml = hasDiff
      ? d.diffItems.map(item => {
          const meta = diffCategoryMeta(item.category);
          const approvedBadge = item.empApprove
            ? `<span style="color:var(--ok-text);font-size:10px">✓ อนุมัติ</span>`
            : `<span style="color:var(--text-subtle);font-size:10px">รอ</span>`;
          return `<tr>
            <td class="td-mono">${esc(item.barcode)}</td>
            <td class="td-mono">${esc(item.product)}</td>
            <td class="td-center"><span class="diff-badge ${meta.cssClass}">${meta.label}</span></td>
            <td class="td-right td-num">${formatNum(item.diffQty)}</td>
            <td class="td-right td-num">${formatNum(item.quantity)}</td>
            <td class="td-muted">${esc(item.branchName)}</td>
            <td class="td-muted td-mono" style="font-size:10px">${esc(item.empCode)}</td>
            <td class="td-center">${approvedBadge}</td>
            <td class="td-mono td-muted" style="font-size:10px">${esc(item.saveTime)}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-subtle)">
           ไม่มีรายการ Diff ที่ตรงกับเอกสารนี้
         </td></tr>`;

    /* Summary badges for diff counts */
    const shortN = d.diffShortItems.length;
    const overN  = d.diffOverItems.length;
    const otherN = d.diffOtherItems.length;
    const shortQty = d.totalDiffShort;
    const overQty  = d.totalDiffOver;

    const summaryBadges = [
      shortN > 0 ? `<span class="diff-badge short">${shortN} รายการขาด (${shortQty} ชิ้น)</span>` : '',
      overN  > 0 ? `<span class="diff-badge over">${overN} รายการเกิน (${overQty} ชิ้น)</span>`   : '',
      otherN > 0 ? `<span class="diff-badge other">${otherN} รายการอื่นๆ</span>`                    : '',
    ].filter(Boolean).join(' ');

    /* R008 section — only rendered if R008 exists */
    const r008Section = d.r008 ? `
      <div>
        <div class="modal-section-title">⚠️ R008 — สแกนนับหยาบ</div>
        <div class="modal-grid">
          ${field('ผลการนับหยาบ',  d.r008,       false)}
          ${field('สาเหตุ',        d.r008Reason, false, false)}
          ${field('ผู้บันทึก R008', d.r008Rec,    false)}
          ${field('วันที่บันทึก',  formatDate(d.r008Date))}
        </div>
      </div>` : '';

    this.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-info">
              <div class="modal-title" id="modal-title">
                ${esc(d.branch)}
                ${summaryBadges
                  ? `<span style="margin-left:10px;display:inline-flex;gap:6px">${summaryBadges}</span>`
                  : ''}
              </div>
              <div class="modal-docno">
                เลขที่เอกสาร:&nbsp;<strong>${esc(d.docNo)}</strong>
                &nbsp;|&nbsp; คลัง:&nbsp;<strong style="color:var(--accent)">${esc(d.warehouse)}</strong>
                &nbsp;|&nbsp; วันที่:&nbsp;${formatDate(d.queueDate)}
              </div>
            </div>
            <button class="modal-close" id="modal-close-btn" aria-label="ปิด">✕</button>
          </div>

          <!-- Body -->
          <div class="modal-body">

            <!-- Section 1: ข้อมูลเอกสาร -->
            <div>
              <div class="modal-section-title">📋 ข้อมูลเอกสาร</div>
              <div class="modal-grid">
                ${field('เลขที่เอกสาร', d.docNo,    true)}
                ${field('ชื่อสาขา',    d.branch,   false)}
                ${field('วันที่คิวงาน', formatDate(d.queueDate))}
                ${field('ช่วงเวลา',    d.timeSlot, false)}
                ${field('ประเภทงาน',   d.jobType,  false)}
                ${field('ประเภทรถ',    d.truckType,false)}
                ${field('ป้ายทะเบียน', d.license,  true)}
                ${field('คนขับ',       d.driver,   false)}
              </div>
            </div>

            <!-- Section 2: ข้อมูลคลังและผู้รับผิดชอบ -->
            <div>
              <div class="modal-section-title">🏭 คลังและผู้รับผิดชอบ</div>
              <div class="modal-grid">
                ${field('ประตู T2 (ขาออก DC)',   d.gateT2 ?? '—', true)}
                ${field('ประตู T3 (ขาออก DC)',   d.gateT3 ?? '—', true)}
                ${field('คลัง (สรุป)',           d.warehouse,     false)}
                ${field('เวลา T3',               d.timeT3 ?? '—', false)}
                ${field('ผู้บันทึกจาก DC',       d.recT3  ?? '—', false)}
                ${field('คนรับสินค้าฝั่งสาขา',  d.recRecv ?? '—', false)}
                ${field('กล่องสแกนส่ง',           formatNum(d.scanSend))}
                ${field('กล่องสแกนรับ',           formatNum(d.scanRecv))}
              </div>
            </div>

            <!-- Section 3: R008 (conditional) -->
            ${r008Section}

            <!-- Section 4: รายการ Diff -->
            <div>
              <div class="modal-section-title" style="display:flex;align-items:center;justify-content:space-between">
                <span>🔍 รายการสินค้าขาด/เกิน (${d.diffItems.length} รายการ)</span>
                ${summaryBadges ? `<span style="display:flex;gap:6px">${summaryBadges}</span>` : ''}
              </div>
              <div style="overflow-x:auto">
                <table class="diff-mini-table">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>รหัสสินค้า</th>
                      <th class="td-center">ประเภท</th>
                      <th class="td-right">จำนวน Diff</th>
                      <th class="td-right">Qty</th>
                      <th>สาขา (Diff)</th>
                      <th>ผู้บันทึก</th>
                      <th class="td-center">อนุมัติ</th>
                      <th>วันที่บันทึก</th>
                    </tr>
                  </thead>
                  <tbody>${diffHtml}</tbody>
                </table>
              </div>
            </div>

          </div><!-- /modal-body -->
        </div><!-- /modal-box -->
      </div><!-- /modal-overlay -->
    `;

    this.querySelector('#modal-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    this.querySelector('#modal-close-btn')?.addEventListener('click', () => closeModal());
  }
}

customElements.define('detail-modal', DetailModal);
