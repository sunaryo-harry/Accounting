/**
 * Coretax Enterprise Accounting Application
 * Master State & Controller
 */

window.App = {
  activeEntity: null,
  entities: [],
  currentRoute: 'dashboard',
  lanInfo: null,

  init: async function() {
    console.log('Initializing Coretax Enterprise Accounting System...');
    await this.loadLanInfo();
    await this.loadEntities();
    this.setupEventListeners();
    this.navigate(window.location.hash.replace('#', '') || 'dashboard');
  },

  loadLanInfo: async function() {
    try {
      const res = await fetch('/api/system/lan-info');
      this.lanInfo = await res.json();
      const lanEl = document.getElementById('lan-server-status');
      if (lanEl && this.lanInfo.lanAddresses.length > 0) {
        lanEl.innerHTML = `<span class="lan-dot"></span> LAN: ${this.lanInfo.lanAddresses[0].ip}:4000`;
        lanEl.title = `Server LAN Aktif. Tersedia di: ${this.lanInfo.lanAddresses.map(a => a.url).join(', ')}`;
      }
    } catch (e) {
      console.warn('LAN Info not available:', e);
    }
  },

  loadEntities: async function() {
    try {
      const res = await fetch('/api/entities');
      const data = await res.json();
      this.entities = data.entities || [];
      this.activeEntity = this.entities.find(e => e.isActive) || this.entities[0];

      this.renderEntitySelector();
    } catch (e) {
      console.error('Failed to load entities:', e);
    }
  },

  renderEntitySelector: function() {
    const sel = document.getElementById('header-entity-select');
    const badge = document.getElementById('header-npwp-badge');
    if (!sel) return;

    sel.innerHTML = this.entities.map(e => `
      <option value="${e.id}" ${e.id === this.activeEntity?.id ? 'selected' : ''}>
        ${e.name}
      </option>
    `).join('');

    if (badge && this.activeEntity) {
      badge.textContent = `NPWP: ${this.activeEntity.npwp}`;
    }
  },

  switchEntity: async function(entityId) {
    try {
      const res = await fetch(`/api/entities/active/${entityId}`, { method: 'POST' });
      if (res.ok) {
        this.activeEntity = this.entities.find(e => e.id === entityId);
        this.renderEntitySelector();
        this.toast('Entitas berhasil dialihkan ke: ' + this.activeEntity.name, 'success');
        this.reloadCurrentModule();
      }
    } catch (e) {
      this.toast('Gagal mengalihkan entitas', 'error');
    }
  },

  navigate: function(route) {
    if (!route) route = 'dashboard';
    this.currentRoute = route;
    window.location.hash = route;

    // Update active nav in sidebar
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-route') === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    const contentArea = document.getElementById('main-content-view');
    if (!contentArea) return;

    // Route dispatch
    switch (route) {
      case 'dashboard':
        Modules.Dashboard.render(contentArea);
        break;
      case 'entities':
        Modules.Entity.render(contentArea);
        break;
      case 'coa':
        Modules.COA.render(contentArea);
        break;
      case 'journals':
        Modules.Journals.render(contentArea);
        break;
      case 'ledger':
        Modules.Ledger.render(contentArea);
        break;
      case 'inventory':
        Modules.Inventory.render(contentArea);
        break;
      case 'ar_ap':
        Modules.AR_AP.render(contentArea);
        break;
      case 'assets':
        Modules.Assets.render(contentArea);
        break;
      case 'taxes':
        Modules.Taxes.render(contentArea);
        break;
      case 'psak46':
        Modules.PSAK46.render(contentArea);
        break;
      case 'spt1771':
        Modules.SPT1771.render(contentArea);
        break;
      case 'reports':
        Modules.Reports.render(contentArea);
        break;
      case 'backup':
        Modules.Entity.renderBackup(contentArea);
        break;
      default:
        Modules.Dashboard.render(contentArea);
    }
  },

  reloadCurrentModule: function() {
    this.navigate(this.currentRoute);
  },

  setupEventListeners: function() {
    // Entity switcher change
    const sel = document.getElementById('header-entity-select');
    if (sel) {
      sel.addEventListener('change', (e) => {
        this.switchEntity(e.target.value);
      });
    }

    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const route = el.getAttribute('data-route');
        this.navigate(route);
      });
    });

    // Hash change event
    window.addEventListener('hashchange', () => {
      const route = window.location.hash.replace('#', '');
      if (route && route !== this.currentRoute) {
        this.navigate(route);
      }
    });
  },

  // Formatting helpers
  formatIDR: function(val) {
    const num = Number(val) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
  },

  formatNumber: function(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('id-ID');
  },

  // Modal dialog utility
  showModal: function(title, bodyHtml, footerHtml) {
    let overlay = document.getElementById('app-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'app-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close-btn" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    overlay.style.display = 'flex';
  },

  closeModal: function() {
    const overlay = document.getElementById('app-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  // Toast notification
  toast: function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.right = '20px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }

    const t = document.createElement('div');
    t.className = `stat-card accent-${type === 'error' ? 'red' : (type === 'success' ? 'green' : 'navy')}`;
    t.style.marginTop = '10px';
    t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    t.style.padding = '12px 18px';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '10px';
    t.style.backgroundColor = '#FFFFFF';
    t.innerHTML = `<strong>${type === 'success' ? 'Berhasil' : (type === 'error' ? 'Peringatan' : 'Informasi')}:</strong> ${message}`;

    container.appendChild(t);
    setTimeout(() => {
      t.remove();
    }, 4000);
  }
};

window.Modules = {};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
