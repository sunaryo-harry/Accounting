/**
 * User & Role Permissions Management Module
 * Credit by Harry Sunaryo
 */

Modules.Users = {
  users: [],
  availableModules: [
    { key: 'dashboard', name: 'Dashboard Eksekutif' },
    { key: 'entities', name: 'Multi Entitas Perusahaan' },
    { key: 'coa', name: 'Bagan Akun & Saldo Awal' },
    { key: 'journals', name: 'Jurnal & Unggah Bukti' },
    { key: 'ledger', name: 'Buku Besar & File Bukti' },
    { key: 'inventory', name: 'Persediaan & Kartu Stok' },
    { key: 'ar_ap', name: 'Kontrol Hutang & Piutang' },
    { key: 'assets', name: 'Daftar Aktiva & Fiskal' },
    { key: 'taxes', name: 'Perpajakan & Equalisasi' },
    { key: 'psak46', name: 'Pajak Kini & PSAK 46' },
    { key: 'spt1771', name: 'SPT Tahunan Badan 1771' },
    { key: 'reports', name: 'Laporan Keuangan & Auditor' },
    { key: 'psak69', name: 'Penilaian KJPP & PSAK 69' },
    { key: 'backup', name: 'Server LAN & Backup Database' },
    { key: 'users', name: 'Manajemen Pengguna & Hak Akses' }
  ],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Pengguna Sistem...</div>`;

    try {
      const res = await fetch('/api/auth/users');
      this.users = await res.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>👥</span> Manajemen Pengguna & Batasan Hak Akses
            </h1>
            <div class="page-subtitle">
              Sistem Multi-User Berbasis Peran (RBAC) & Pembatasan Modul Terpadu | Credit by Harry Sunaryo
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.Users.showAddUserModal()">
              <span>➕</span> Tambah Pengguna Baru
            </button>
          </div>
        </div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Pengguna Terdaftar (Total: ${this.users.length})</div>
          </div>

          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 140px;">Username</th>
                <th>Nama Lengkap</th>
                <th style="width: 130px;">Peran (Role)</th>
                <th>Batasan Modul / Hak Akses</th>
                <th class="text-center" style="width: 90px;">Status</th>
                <th class="text-center" style="width: 130px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${this.users.map(u => {
                const isAdmin = u.username.toLowerCase() === 'administrator' || u.role === 'ADMIN';
                const isAllPerms = u.permissions.includes('*') || isAdmin;
                return `
                  <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.name}</td>
                    <td>
                      <span class="badge ${isAdmin ? 'badge-gold font-weight-bold' : 'badge-neutral'}">
                        ${u.role}
                      </span>
                    </td>
                    <td>
                      ${isAllPerms 
                        ? '<span class="badge badge-success">✓ AKSES PENUH (SEMUA MODUL)</span>' 
                        : (u.permissions.length > 0 
                            ? u.permissions.map(p => {
                                const mod = Modules.Users.availableModules.find(m => m.key === p);
                                return `<span class="badge badge-info" style="margin: 2px;">${mod ? mod.name : p}</span>`;
                              }).join('')
                            : '<span class="badge badge-danger">Tidak ada akses modul</span>')}
                    </td>
                    <td class="text-center">
                      ${u.is_active 
                        ? '<span class="badge badge-success">Aktif</span>' 
                        : '<span class="badge badge-danger">Nonaktif</span>'}
                    </td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-outline" onclick="Modules.Users.showEditUserModal('${u.id}')">
                        Edit
                      </button>
                      ${!isAdmin ? `
                        <button class="btn btn-sm btn-danger" onclick="Modules.Users.deleteUser('${u.id}', '${u.username}')" style="margin-left: 4px;">
                          Hapus
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat pengguna: ${err.message}</div>`;
    }
  },

  showAddUserModal: function() {
    const modulesHtml = this.availableModules.map(m => `
      <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; padding: 4px 6px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px;">
        <input type="checkbox" name="user-module" value="${m.key}" checked>
        ${m.name}
      </label>
    `).join('');

    const body = `
      <form id="form-add-user">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Username *</label>
            <input type="text" id="add-user-name" class="form-control" placeholder="Contoh: akuntan_jkt" required>
          </div>
          <div class="form-group">
            <label class="form-label">Kata Sandi (Password) *</label>
            <input type="password" id="add-user-pwd" class="form-control" placeholder="Minimal 6 karakter" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nama Lengkap Pengguna *</label>
            <input type="text" id="add-user-fullname" class="form-control" placeholder="Nama staf / akuntan" required>
          </div>
          <div class="form-group">
            <label class="form-label">Peran Utama (Role)</label>
            <select id="add-user-role" class="form-control" onchange="Modules.Users.applyRolePreset(this.value)">
              <option value="ACCOUNTANT">Akuntan (Finance)</option>
              <option value="TAX_OFFICER">Petugas Pajak</option>
              <option value="AUDITOR">Auditor (Read-Only)</option>
              <option value="OPERATOR">Operator Gudang / Kasir</option>
              <option value="ADMIN">Administrator (Full)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label font-weight-bold" style="margin-bottom: 0;">Batasan Akses Modul:</label>
            <div style="font-size: 11px;">
              <a href="javascript:void(0)" onclick="Modules.Users.toggleAllCheckboxes(true)">Pilih Semua</a> | 
              <a href="javascript:void(0)" onclick="Modules.Users.toggleAllCheckboxes(false)">Kosongkan</a>
            </div>
          </div>
          <div id="user-module-checkboxes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 180px; overflow-y: auto; padding: 4px;">
            ${modulesHtml}
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Users.saveNewUser()">Daftarkan Pengguna</button>
    `;

    App.showModal('Tambah Pengguna & Hak Akses', body, footer);
  },

  applyRolePreset: function(role) {
    const map = {
      ADMIN: this.availableModules.map(m => m.key),
      ACCOUNTANT: ['dashboard', 'coa', 'journals', 'ledger', 'inventory', 'ar_ap', 'assets', 'reports'],
      TAX_OFFICER: ['dashboard', 'ledger', 'taxes', 'psak46', 'spt1771', 'reports'],
      AUDITOR: ['dashboard', 'coa', 'ledger', 'reports'],
      OPERATOR: ['dashboard', 'inventory', 'ar_ap']
    };

    const allowed = map[role] || [];
    document.querySelectorAll('input[name="user-module"]').forEach(cb => {
      cb.checked = allowed.includes(cb.value);
    });
  },

  toggleAllCheckboxes: function(val) {
    document.querySelectorAll('input[name="user-module"]').forEach(cb => {
      cb.checked = val;
    });
  },

  saveNewUser: async function() {
    const username = document.getElementById('add-user-name')?.value.trim();
    const password = document.getElementById('add-user-pwd')?.value.trim();
    const name = document.getElementById('add-user-fullname')?.value.trim();
    const role = document.getElementById('add-user-role')?.value;

    if (!username || !password || !name) {
      alert('Username, password, dan nama lengkap wajib diisi!');
      return;
    }

    const selectedModules = [];
    document.querySelectorAll('input[name="user-module"]:checked').forEach(cb => {
      selectedModules.push(cb.value);
    });

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          name,
          role,
          permissions: role === 'ADMIN' ? ['*'] : selectedModules
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message, 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showEditUserModal: function(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const isAdmin = user.username.toLowerCase() === 'administrator';
    const modulesHtml = this.availableModules.map(m => {
      const checked = user.permissions.includes('*') || user.permissions.includes(m.key);
      return `
        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; padding: 4px 6px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px;">
          <input type="checkbox" name="edit-user-module" value="${m.key}" ${checked ? 'checked' : ''}>
          ${m.name}
        </label>
      `;
    }).join('');

    const body = `
      <form id="form-edit-user">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-control" value="${user.username}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Ganti Kata Sandi (Kosongkan jika tidak diubah)</label>
            <input type="password" id="edit-user-pwd" class="form-control" placeholder="Kata sandi baru">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" id="edit-user-fullname" class="form-control" value="${user.name}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Peran Utama (Role)</label>
            <select id="edit-user-role" class="form-control" ${isAdmin ? 'disabled' : ''}>
              <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
              <option value="ACCOUNTANT" ${user.role === 'ACCOUNTANT' ? 'selected' : ''}>Akuntan (Finance)</option>
              <option value="TAX_OFFICER" ${user.role === 'TAX_OFFICER' ? 'selected' : ''}>Petugas Pajak</option>
              <option value="AUDITOR" ${user.role === 'AUDITOR' ? 'selected' : ''}>Auditor</option>
              <option value="OPERATOR" ${user.role === 'OPERATOR' ? 'selected' : ''}>Operator</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="edit-user-active" ${user.is_active ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}>
            Status Akun Aktif (Dapat Login ke Sistem)
          </label>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label font-weight-bold" style="margin-bottom: 0;">Batasan Akses Modul:</label>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 180px; overflow-y: auto; padding: 4px;">
            ${modulesHtml}
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Users.saveEditUser('${user.id}')">Simpan Perubahan</button>
    `;

    App.showModal(`Edit Pengguna: ${user.username}`, body, footer);
  },

  saveEditUser: async function(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const name = document.getElementById('edit-user-fullname')?.value.trim();
    const role = document.getElementById('edit-user-role')?.value || user.role;
    const password = document.getElementById('edit-user-pwd')?.value.trim();
    const isActive = document.getElementById('edit-user-active')?.checked;

    const selectedModules = [];
    document.querySelectorAll('input[name="edit-user-module"]:checked').forEach(cb => {
      selectedModules.push(cb.value);
    });

    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role,
          is_active: isActive,
          password: password || undefined,
          permissions: role === 'ADMIN' ? ['*'] : selectedModules
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message, 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  deleteUser: async function(userId, username) {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${username}"?`)) return;

    try {
      const res = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message, 'success');
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  }
};
