/**
 * Coretax Enterprise Accounting Application
 * Master State & Controller
 * Credit by Harry Sunaryo
 */

window.App = {
  activeEntity: null,
  entities: [],
  currentRoute: 'dashboard',
  lanInfo: null,
  currentUser: null,

  init: async function() {
    console.log('Initializing Coretax Enterprise Accounting System - Credit by Harry Sunaryo...');
    this.initAuth();
    await this.loadLanInfo();
    await this.loadEntities();
    this.setupEventListeners();

    if (this.currentUser) {
      this.navigate(window.location.hash.replace('#', '') || 'dashboard');
    }
  },

  initAuth: function() {
    const saved = localStorage.getItem('coretax_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }

    const overlay = document.getElementById('login-screen-overlay');
    if (!this.currentUser) {
      if (overlay) overlay.style.display = 'flex';
    } else {
      if (overlay) overlay.style.display = 'none';
      this.updateHeaderUserUI();
      this.filterSidebarNav();
    }
  },

  // Safe fetch helper to prevent "Unexpected token '<', <!DOCTYPE... is not valid JSON"
  fetchJson: async function(url, options = {}) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (netErr) {
      throw new Error(`Koneksi ke backend gagal (${netErr.message}). Pastikan server aplikasi telah dijalankan.`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (res.status === 404) {
        throw new Error(`Endpoint API tidak ditemukan (HTTP 404). Kemungkinan server backend versi lama masih aktif di port 4000. Jalankan 'start-server.bat' untuk memuat versi terbaru.`);
      }
      throw new Error(`Server backend tidak merespons JSON (HTTP ${res.status}). Pastikan server aplikasi telah berjalan normal.`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Kesalahan HTTP ${res.status}`);
    }
    return data;
  },

  handleLogin: async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const alertEl = document.getElementById('login-error-alert');
    const submitBtn = document.getElementById('btn-login-submit');

    if (!username || !password) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Memeriksa Kredensial...`;
    }
    if (alertEl) alertEl.style.display = 'none';

    try {
      const data = await this.fetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      this.currentUser = data.user;
      localStorage.setItem('coretax_user', JSON.stringify(this.currentUser));

      const overlay = document.getElementById('login-screen-overlay');
      if (overlay) overlay.style.display = 'none';

      this.updateHeaderUserUI();
      this.filterSidebarNav();
      this.toast(`Selamat datang, ${this.currentUser.name}!`, 'success');
      this.navigate(window.location.hash.replace('#', '') || 'dashboard');
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message;
        alertEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>🔐</span> Masuk ke Sistem (Log In)`;
      }
    }
  },

  logout: function() {
    if (!confirm('Apakah Anda yakin ingin keluar dari sistem?')) return;
    localStorage.removeItem('coretax_user');
    this.currentUser = null;
    const overlay = document.getElementById('login-screen-overlay');
    if (overlay) overlay.style.display = 'flex';
  },

  updateHeaderUserUI: function() {
    const nameEl = document.getElementById('header-user-display');
    const roleEl = document.getElementById('header-role-display');
    if (nameEl && this.currentUser) {
      nameEl.textContent = this.currentUser.name || this.currentUser.username;
    }
    if (roleEl && this.currentUser) {
      roleEl.textContent = this.currentUser.role || 'USER';
    }
  },

  hasAccess: function(route) {
    if (!this.currentUser) return false;
    const perms = this.currentUser.permissions || [];
    if (perms.includes('*') || this.currentUser.role === 'ADMIN' || this.currentUser.username.toLowerCase() === 'administrator') {
      return true;
    }
    return perms.includes(route);
  },

  filterSidebarNav: function() {
    if (!this.currentUser) return;
    document.querySelectorAll('.nav-item').forEach(el => {
      const route = el.getAttribute('data-route');
      if (route && !this.hasAccess(route)) {
        el.style.opacity = '0.4';
        el.title = 'Akses dibatasi oleh Administrator';
      } else {
        el.style.opacity = '1';
        el.title = '';
      }
    });
  },

  loadLanInfo: async function() {
    try {
      this.lanInfo = await this.fetchJson('/api/system/lan-info');
      const lanEl = document.getElementById('lan-server-status');
      const port = this.lanInfo?.port || 4000;
      if (lanEl) {
        if (this.lanInfo?.lanAddresses?.length > 0) {
          lanEl.innerHTML = `<span class="lan-dot"></span> LAN: ${this.lanInfo.lanAddresses[0].ip}:${port}`;
          lanEl.title = `Server LAN Aktif. Tersedia di: ${this.lanInfo.lanAddresses.map(a => a.url).join(', ')}. Klik untuk mengedit pengaturan LAN.`;
        } else {
          lanEl.innerHTML = `<span class="lan-dot"></span> LAN: :${port}`;
        }
      }
    } catch (e) {
      console.warn('LAN Info not available:', e);
    }
  },

  loadEntities: async function() {
    try {
      const data = await this.fetchJson('/api/entities');
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

    // Check Access Permission
    if (!this.hasAccess(route)) {
      const contentArea = document.getElementById('main-content-view');
      if (contentArea) {
        contentArea.innerHTML = `
          <div style="padding: 60px 20px; text-align: center;">
            <div style="font-size: 56px; margin-bottom: 14px;">🔒</div>
            <h2 style="color: #002B49; margin-bottom: 8px;">Akses Modul Dibatasi</h2>
            <p style="color: #64748B; max-width: 520px; margin: 0 auto 20px auto; font-size: 13.5px; line-height: 1.6;">
              Akun Anda (<strong>${this.currentUser?.name || this.currentUser?.username}</strong> - Role: <strong>${this.currentUser?.role}</strong>) tidak memiliki hak akses untuk membuka modul <strong>"${route}"</strong>.<br>
              Silakan hubungi Administrator untuk memperluas batasan hak akses Anda.
            </p>
            <button class="btn btn-primary" onclick="App.navigate('dashboard')">
              <span>📊</span> Kembali ke Dashboard Eksekutif
            </button>
          </div>
        `;
      }
      return;
    }

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
      case 'users':
        Modules.Users.render(contentArea);
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
