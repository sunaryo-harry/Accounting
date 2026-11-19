/**
 * Multi-Entity & LAN Server Module
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
              Kelola Holding, Anak Perusahaan, Cabang, dan Saldo Awal Masing-masing Entitas
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.Entity.showAddEntityModal()">
              <span>➕</span> Daftarkan Entitas Baru
            </button>
          </div>
        </div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Entitas Terdaftar</div>
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
                <th class="text-center" style="width: 120px;">Alihkan</th>
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
                    ${!e.isActive ? `
                      <button class="btn btn-sm btn-primary" onclick="App.switchEntity('${e.id}')">
                        Buka Entitas
                      </button>
                    ` : '<span style="color:#059669; font-weight:700;">Sedang Aktif</span>'}
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
          name, npwp, kpp, fiscal_year: year, director_name: director, address
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

  renderBackup: async function(container) {
    const lan = App.lanInfo || { lanAddresses: [] };

    container.innerHTML = `
      <div class="page-header-bar">
        <div>
          <h1 class="page-title">
            <span>💾</span> Pengaturan Server LAN & Backup Database
          </h1>
          <div class="page-subtitle">
            Konektivitas Jaringan Lokal (Local Area Network) & Cadangan Data SQLite Terpadu
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- LAN CONFIGURATION -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>🌐</span> Akses Server LAN (Multi-User Office)</div>
            <span class="badge badge-success">SERVER ONLINE</span>
          </div>
          <div style="padding: 18px;">
            <p style="margin-bottom: 14px; color: #334155; line-height: 1.5;">
              Aplikasi ini berjalan sebagai <strong>Server LAN</strong>. Seluruh komputer, laptop, dan tablet di jaringan kantor/Wi-Fi yang sama dapat mengakses aplikasi akuntansi ini secara bersamaan tanpa perlu instalasi tambahan, cukup buka tautan di bawah ini:
            </p>

            <div style="background: #F1F5F9; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #002B49; margin-bottom: 6px;">Alamat URL di Jaringan Lokal:</div>
              ${lan.lanAddresses.map(a => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #CBD5E1;">
                  <code style="font-size: 13px; font-weight: 700; color: #0B3B60;">${a.url}</code>
                  <a href="${a.url}" target="_blank" class="btn btn-sm btn-outline">Buka di Tab Baru</a>
                </div>
              `).join('') || `<div><code>http://localhost:4000</code></div>`}
            </div>

            <div style="font-size: 11.5px; color: #64748B;">
              📌 <strong>Tips Windows Firewall:</strong> Installer otomatis telah membuka Port 4000 pada firewall Windows. Jika komputer lain belum dapat membuka alamat di atas, pastikan jaringan Wi-Fi/LAN berada dalam profil Private Network.
            </div>
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
              ✓ <strong>Status Keamanan:</strong> Database tersimpan lokal pada server Anda (zero cloud dependency), menjaga kerahasiaan data keuangan dan perpajakan perusahaan sesuai prinsip kerahasiaan data fiskal.
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
