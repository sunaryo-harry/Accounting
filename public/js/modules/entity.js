/**
 * Multi-Entity & LAN Server Module
 * Full Edit, Delete, Import Template & LAN Access Configuration
 * Credit by Harry Sunaryo
 */

Modules.Entity = {
  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Entitas Perusahaan...</div>`;

    try {
      const res = await fetch('/api/entities');
      const data = await res.json();
      const entities = data.entities || [];

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>🏢</span> Manajemen Multi Entitas Perusahaan
            </h1>
            <div class="page-subtitle">
              Kelola Holding, Anak Perusahaan, Cabang, dan Saldo Awal Masing-masing Entitas | Credit by Harry Sunaryo
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="CoretaxImporter.showImportModal('entities', () => App.loadEntities().then(() => Modules.Entity.render(document.getElementById('main-content-view'))))">
              <span>📥</span> Template & Impor Entitas
            </button>
            <button class="btn btn-gold" onclick="Modules.Entity.showAddEntityModal()">
              <span>➕</span> Daftarkan Entitas Baru
            </button>
          </div>
        </div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Entitas Terdaftar (${entities.length} Perusahaan)</div>
          </div>

          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 140px;">Status Aktif</th>
                <th>Nama Entitas Perusahaan</th>
                <th>NPWP (16 Digit Coretax)</th>
                <th>KPP Terdaftar</th>
                <th>Tahun Buku</th>
                <th>Direktur Utama</th>
                <th class="text-center" style="width: 190px;">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              ${entities.map(e => `
                <tr style="${e.isActive ? 'background: #EFF6FF;' : ''}">
                  <td>
                    ${e.isActive 
                      ? '<span class="badge badge-success">✓ AKTIF DIGUNAKAN</span>' 
                      : '<span class="badge badge-neutral">Standby</span>'}
                  </td>
                  <td><strong>${e.name}</strong><div style="font-size: 11px; color: #64748B;">${e.address || '-'}</div></td>
                  <td><span class="badge badge-gold font-weight-bold">${e.npwp}</span></td>
                  <td>${e.kpp || '-'}</td>
                  <td><strong>${e.fiscal_year}</strong> (${e.currency})</td>
                  <td>${e.director_name || '-'}</td>
                  <td class="text-center">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                      ${!e.isActive ? `
                        <button class="btn btn-sm btn-primary" onclick="App.switchEntity('${e.id}')" title="Alihkan ke entitas ini">
                          Buka
                        </button>
                      ` : '<span class="badge badge-info" style="font-size:10px;">Aktif</span>'}
                      <button class="btn btn-sm btn-outline" onclick="Modules.Entity.showEditEntityModal('${e.id}')" title="Edit Data Entitas">
                        ✏️ Edit
                      </button>
                      ${entities.length > 1 ? `
                        <button class="btn btn-sm btn-danger" onclick="Modules.Entity.deleteEntity('${e.id}', '${e.name}')" title="Hapus Entitas">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat entitas: ${err.message}</div>`;
    }
  },

  showAddEntityModal: function() {
    const body = `
      <form id="form-add-entity">
        <div class="form-group">
          <label class="form-label">Nama Entitas Perusahaan (PT / CV / Holding) *</label>
          <input type="text" id="new-ent-name" class="form-control" placeholder="Contoh: PT Surya Pratama Semesta" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">NPWP 16 Digit Format Coretax *</label>
            <input type="text" id="new-ent-npwp" class="form-control" placeholder="01.234.567.8-012.000" required>
          </div>
          <div class="form-group">
            <label class="form-label">KPP Wajib Pajak Terdaftar *</label>
            <input type="text" id="new-ent-kpp" class="form-control" placeholder="KPP Pratama ..." required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tahun Buku / Fiskal *</label>
            <input type="number" id="new-ent-year" class="form-control" value="2026" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mata Uang Pembukuan</label>
            <input type="text" id="new-ent-curr" class="form-control" value="IDR" disabled>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nama Direktur Utama / Penanggung Jawab *</label>
          <input type="text" id="new-ent-director" class="form-control" placeholder="Nama direksi penandatangan SPT" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Telepon Kantor</label>
            <input type="text" id="new-ent-phone" class="form-control" placeholder="021-xxxxxx">
          </div>
          <div class="form-group">
            <label class="form-label">Email Perusahaan</label>
            <input type="email" id="new-ent-email" class="form-control" placeholder="finance@perusahaan.com">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat Kantor</label>
          <textarea id="new-ent-address" class="form-control" rows="2"></textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Entity.saveNewEntity()">Buat Entitas & Klon Bagan Akun</button>
    `;

    App.showModal('Daftarkan Entitas Baru', body, footer);
  },

  saveNewEntity: async function() {
    const name = document.getElementById('new-ent-name')?.value.trim();
    const npwp = document.getElementById('new-ent-npwp')?.value.trim();
    const kpp = document.getElementById('new-ent-kpp')?.value.trim();
    const year = parseInt(document.getElementById('new-ent-year')?.value) || 2026;
    const director = document.getElementById('new-ent-director')?.value.trim();
    const phone = document.getElementById('new-ent-phone')?.value.trim();
    const email = document.getElementById('new-ent-email')?.value.trim();
    const address = document.getElementById('new-ent-address')?.value.trim();

    if (!name || !npwp) {
      alert('Nama dan NPWP entitas wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, npwp, kpp, fiscal_year: year, director_name: director, phone, email, address
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Entitas baru dan bagan akun otomatis berhasil dibuat!', 'success');
      App.closeModal();
      await App.loadEntities();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showEditEntityModal: function(entityId) {
    const ent = App.entities.find(e => e.id === entityId);
    if (!ent) return;

    const body = `
      <form id="form-edit-entity">
        <div class="form-group">
          <label class="form-label">Nama Entitas Perusahaan *</label>
          <input type="text" id="edit-ent-name" class="form-control" value="${ent.name}" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">NPWP 16 Digit Format Coretax *</label>
            <input type="text" id="edit-ent-npwp" class="form-control" value="${ent.npwp}" required>
          </div>
          <div class="form-group">
            <label class="form-label">KPP Wajib Pajak Terdaftar *</label>
            <input type="text" id="edit-ent-kpp" class="form-control" value="${ent.kpp || ''}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tahun Buku / Fiskal *</label>
            <input type="number" id="edit-ent-year" class="form-control" value="${ent.fiscal_year || 2026}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mata Uang Pembukuan</label>
            <input type="text" id="edit-ent-curr" class="form-control" value="${ent.currency || 'IDR'}" disabled>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nama Direktur Utama / Penanggung Jawab *</label>
          <input type="text" id="edit-ent-director" class="form-control" value="${ent.director_name || ''}" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Telepon Kantor</label>
            <input type="text" id="edit-ent-phone" class="form-control" value="${ent.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email Perusahaan</label>
            <input type="email" id="edit-ent-email" class="form-control" value="${ent.email || ''}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat Kantor</label>
          <textarea id="edit-ent-address" class="form-control" rows="2">${ent.address || ''}</textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Entity.saveEditEntity('${ent.id}')">Simpan Perubahan</button>
    `;

    App.showModal(`Edit Data Entitas: ${ent.name}`, body, footer);
  },

  saveEditEntity: async function(entityId) {
    const name = document.getElementById('edit-ent-name')?.value.trim();
    const npwp = document.getElementById('edit-ent-npwp')?.value.trim();
    const kpp = document.getElementById('edit-ent-kpp')?.value.trim();
    const year = parseInt(document.getElementById('edit-ent-year')?.value) || 2026;
    const director = document.getElementById('edit-ent-director')?.value.trim();
    const phone = document.getElementById('edit-ent-phone')?.value.trim();
    const email = document.getElementById('edit-ent-email')?.value.trim();
    const address = document.getElementById('edit-ent-address')?.value.trim();

    if (!name || !npwp) {
      alert('Nama dan NPWP wajib diisi!');
      return;
    }

    try {
      const res = await fetch(`/api/entities/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, npwp, kpp, fiscal_year: year, currency: 'IDR', director_name: director, phone, email, address
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Data entitas berhasil diperbarui!', 'success');
      App.closeModal();
      await App.loadEntities();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal memperbarui entitas: ' + err.message);
    }
  },

  deleteEntity: async function(entityId, name) {
    if (!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus entitas "${name}" beserta seluruh data akun, jurnal, dan transaksinya? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/entities/${entityId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message || 'Entitas berhasil dihapus', 'success');
      await App.loadEntities();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal menghapus entitas: ' + err.message);
    }
  },

  renderBackup: async function(container) {
    await App.loadLanInfo();
    const lan = App.lanInfo || { lanAddresses: [] };

    container.innerHTML = `
      <div class="page-header-bar">
        <div>
          <h1 class="page-title">
            <span>💾</span> Pengaturan Server LAN & Backup Database
          </h1>
          <div class="page-subtitle">
            Konektivitas Jaringan Lokal (Local Area Network) & Cadangan Data SQLite Terpadu | Credit by Harry Sunaryo
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-gold" onclick="Modules.Entity.showEditLanModal()">
            <span>⚙️</span> Edit Pengaturan Akses LAN
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- LAN CONFIGURATION -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>🌐</span> Akses Server LAN (Multi-User Office)</div>
            <span class="badge badge-success">PORT: ${lan.port || 4000} ONLINE</span>
          </div>
          <div style="padding: 18px;">
            <p style="margin-bottom: 14px; color: #334155; line-height: 1.5;">
              Aplikasi ini berjalan sebagai <strong>Server LAN</strong> pada Port <strong>${lan.port || 4000}</strong>. Seluruh komputer, laptop, dan smartphone di jaringan kantor yang sama dapat mengakses aplikasi akuntansi ini secara bersamaan tanpa perlu instalasi tambahan:
            </p>

            <div style="background: #F1F5F9; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #002B49; margin-bottom: 6px;">Alamat URL di Jaringan Lokal:</div>
              ${lan.lanAddresses.map(a => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #CBD5E1;">
                  <code style="font-size: 13px; font-weight: 700; color: #0B3B60;">${a.url}</code>
                  <a href="${a.url}" target="_blank" class="btn btn-sm btn-outline">Buka di Tab Baru</a>
                </div>
              `).join('') || `<div><code>http://localhost:${lan.port || 4000}</code></div>`}
            </div>

            ${lan.alias ? `
              <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 12px; color: #1E40AF;">
                🏷️ <strong>Domain / Alias Khusus:</strong> <code>http://${lan.alias}:${lan.port || 4000}</code>
              </div>
            ` : ''}

            <div style="font-size: 11.5px; color: #64748B; margin-bottom: 12px;">
              📌 <strong>Tips Port & Akses:</strong> Anda dapat mengubah Port Server LAN atau Host Binding kapan saja dengan mengeklik tombol <strong>Edit Pengaturan Akses LAN</strong> di atas.
            </div>

            <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center;" onclick="Modules.Entity.showEditLanModal()">
              <span>✏️</span> Ubah Port & Pengaturan Server LAN
            </button>
          </div>
        </div>

        <!-- DATABASE BACKUP & RESTORE -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>💾</span> Backup & Restore Database SQLite</div>
          </div>
          <div style="padding: 18px;">
            <p style="margin-bottom: 14px; color: #334155; line-height: 1.5;">
              Seluruh data akuntansi, jurnal, persediaan, perpajakan, dan aset tersimpan dalam satu file database SQLite mandiri berkecepatan tinggi dengan mode Write-Ahead-Logging (WAL).
            </p>

            <div style="margin-bottom: 20px;">
              <a href="/api/system/download-database" class="btn btn-gold" style="width: 100%; justify-content: center; padding: 10px;">
                <span>⬇️</span> Download File Backup Database (.sqlite)
              </a>
              <div style="font-size: 11px; color: #64748B; margin-top: 6px; text-align: center;">
                File backup dapat disimpan ke flashdisk, Google Drive, atau harddisk eksternal setiap hari.
              </div>
            </div>

            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 12px; font-size: 12px; color: #065F46;">
              ✓ <strong>Status Keamanan:</strong> Database tersimpan lokal pada server Anda (zero cloud dependency), menjaga kerahasiaan data keuangan dan perpajakan perusahaan sesuai prinsip kerahasiaan fiskal Coretax.
            </div>
            
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B; text-align: right;">
              Sistem Akuntansi Enterprise - Credit by Harry Sunaryo
            </div>
          </div>
        </div>
      </div>
    `;
  },

  showEditLanModal: function() {
    const lan = App.lanInfo || { port: 4000, host: '0.0.0.0', alias: '', mode: 'OPEN' };

    const body = `
      <form id="form-edit-lan">
        <div class="form-group">
          <label class="form-label">Nomor Port Server LAN *</label>
          <input type="number" id="lan-port-input" class="form-control" value="${lan.port || 4000}" min="80" max="65535" required>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Port default adalah 4000. Anda dapat mengubahnya ke port lain (misal: 5000, 8080, 8000) jika port 4000 digunakan aplikasi lain.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Host Binding (IP Yang Didengarkan) *</label>
          <select id="lan-host-input" class="form-control">
            <option value="0.0.0.0" ${lan.host === '0.0.0.0' ? 'selected' : ''}>0.0.0.0 (Seluruh Komputer di Jaringan LAN / Wi-Fi)</option>
            <option value="127.0.0.1" ${lan.host === '127.0.0.1' ? 'selected' : ''}>127.0.0.1 (Hanya Komputer Lokal / Localhost)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Nama Alias / Domain Lokal (Opsional)</label>
          <input type="text" id="lan-alias-input" class="form-control" value="${lan.alias || ''}" placeholder="Contoh: akuntansi-kantor.local atau 192.168.1.100">
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Tampilkan alamat alias atau nama DNS lokal bagi pengguna di kantor.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Mode Akses Jaringan</label>
          <select id="lan-mode-input" class="form-control">
            <option value="OPEN" ${lan.mode === 'OPEN' ? 'selected' : ''}>Terbuka (Seluruh Komputer Kantor Diizinkan Masuk)</option>
            <option value="RESTRICTED" ${lan.mode === 'RESTRICTED' ? 'selected' : ''}>Dibatasi (Hanya Komputer dengan Otorisasi)</option>
          </select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Entity.saveLanConfig()">Simpan Konfigurasi LAN</button>
    `;

    App.showModal('Edit Pengaturan Akses Server LAN', body, footer);
  },

  saveLanConfig: async function() {
    const port = parseInt(document.getElementById('lan-port-input')?.value) || 4000;
    const host = document.getElementById('lan-host-input')?.value || '0.0.0.0';
    const alias = document.getElementById('lan-alias-input')?.value.trim();
    const mode = document.getElementById('lan-mode-input')?.value || 'OPEN';

    try {
      const res = await fetch('/api/system/lan-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, host, alias, mode })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message, 'success');
      App.closeModal();
      await App.loadLanInfo();
      this.renderBackup(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal menyimpan konfigurasi LAN: ' + err.message);
    }
  }
};
