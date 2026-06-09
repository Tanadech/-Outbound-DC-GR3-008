/* ============================================================
   <stat-card> — KPI summary tile
   Attributes:
     label  — card title (string)
     value  — main metric value (string|number)
     sub    — subtitle / context line
     color  — accent bar color: ok | warn | danger | info | purple | grey | accent | brand
     icon   — emoji or text icon shown in corner
   ============================================================ */

export class StatCard extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'value', 'sub', 'color', 'icon'];
  }

  connectedCallback()        { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const label = this.getAttribute('label') ?? '';
    const value = this.getAttribute('value') ?? '—';
    const sub   = this.getAttribute('sub')   ?? '';
    const color = this.getAttribute('color') ?? 'accent';
    const icon  = this.getAttribute('icon')  ?? '';

    this.innerHTML = `
      <div class="stat-card" data-color="${color}">
        <div class="sc-header">
          <div class="sc-label">${label}</div>
          ${icon ? `<div class="sc-icon">${icon}</div>` : ''}
        </div>
        <div class="sc-value">${value}</div>
        ${sub ? `<div class="sc-sub">${sub}</div>` : ''}
      </div>
    `;
  }
}

customElements.define('stat-card', StatCard);
