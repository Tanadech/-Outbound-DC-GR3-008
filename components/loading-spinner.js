/* ============================================================
   <loading-spinner> — full-screen overlay while data loads
   ============================================================ */

export class LoadingSpinner extends HTMLElement {
  connectedCallback() {
    this._render();
  }

  show(message = 'กำลังโหลดข้อมูล…') {
    this._msg = message;
    this._render();
    this.style.display = '';
  }

  hide() {
    this.style.display = 'none';
  }

  _render() {
    this.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner-ring"></div>
        <div class="loading-text">${this._msg ?? 'กำลังโหลดข้อมูล…'}</div>
      </div>
    `;
  }
}

customElements.define('loading-spinner', LoadingSpinner);
