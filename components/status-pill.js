/* ============================================================
   <status-pill code="s0|s1|s2|s4"> — coloured status badge
   ============================================================ */
import { CONFIG } from '../data/config.js';

const LABELS = {
  s0: 'รอจัดสินค้า',
  s1: 'จัดสินค้าเรียบร้อย',
  s2: 'ประมวลผลผ่าน',
  s4: 'ประมวลผลผิดพลาด',
};

export class StatusPill extends HTMLElement {
  static get observedAttributes() { return ['code']; }

  connectedCallback()                  { this._render(); }
  attributeChangedCallback()           { this._render(); }

  _render() {
    const code  = this.getAttribute('code') ?? 's0';
    const label = LABELS[code] ?? 'ไม่ระบุ';
    this.innerHTML = `<span class="status-pill ${code}">${label}</span>`;
  }
}

customElements.define('status-pill', StatusPill);

/**
 * Convenience function — returns HTML string for inline use inside table cells.
 */
export function pillHTML(code) {
  const label = LABELS[code] ?? 'ไม่ระบุ';
  return `<span class="status-pill ${code}">${label}</span>`;
}
