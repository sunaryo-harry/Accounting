/**
 * COA & Saldo Awal Module
 */

Modules.COA = {
  accounts: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Bagan Akun...</div>`;

    try {
      const res = await fetch(`/api/accounts?entity_id=${App.activeEntity.id}`);
      this.accounts = await res.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📚</span> Bagan Akun Standar PSAK & Saldo Awal
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Susunan Akun 5 Level Standar Akuntansi & Perpajakan Indonesia
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.COA.showInitialBalancesModal()">
              <span>⚖️</span> Input / Edit Saldo Awal Entitas
            </button>
            <button class="btn btn-primary" onclick="Modules.COA.showAddAccountModal()">
              <span>➕</span> Tambah Akun Baru
            </button>
            <button class="btn btn-outline" onclick="Modules.COA.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('BAGAN AKUN PERUSAHAAN', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Bagan Akun (Chart of Accounts)</div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="coa-search-input" class="form-control" placeholder="Cari kode atau nama akun..." style="width: 250px;" oninput="Modules.COA.filterTable()">
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="coretax-table" id="coa-table">
              <thead>
                <tr>
                  <th style="width: 110px;">Kode Akun</th>
                  <th>Nama Akun</th>
                  <th>Kategori</th>
                  <th>Sub-Klasifikasi</th>
                  <th class="text-center" style="width: 90px;">Saldo Normal</th>
                  <th class="text-center" style="width: 100px;">Objek Pajak</th>
                  <th class="text-right" style="width: 140px;">Saldo Awal (D)</th>
                  <th class="text-right" style="width: 140px;">Saldo Awal (K)</th>
                  <th class="text-center" style="width: 90px;">Aksi</th>
                </tr>
              </thead>
              <tbody id="coa-table-body">
                ${this.renderRows(this.accounts)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat bagan akun: ${err.message}</div>`;
    }
  },

  renderRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="9" class="text-center" style="padding: 20px;">Tidak ada data akun.</td></tr>`;
    }

    return list.map(a => `
      <tr data-code="${a.code}" data-name="${a.name.toLowerCase()}">
        <td><strong>${a.code}</strong></td>
        <td>
          <strong>${a.name}</strong>
          ${a.is_tax_deductible === 0 ? '<span class="badge badge-warning" style="margin-left: 6px;">Koreksi Fiskal Positif</span>' : ''}
        </td>
        <td><span class="badge badge-neutral">${a.category}</span></td>
        <td>${a.sub_category || '-'}</td>
        <td class="text-center">
          <span class="badge ${a.normal_balance === 'DEBIT' ? 'badge-info' : 'badge-gold'}">${a.normal_balance}</span>
        </td>
        <td class="text-center">
          ${a.is_tax_object ? `<span class="badge badge-success">${a.tax_type || 'OBJEK'}</span>` : '<span style="color:#94A3B8;">-</span>'}
        </td>
        <td class="text-right">${a.initial_debit > 0 ? App.formatIDR(a.initial_debit) : '-'}</td>
        <td class="text-right">${a.initial_credit > 0 ? App.formatIDR(a.initial_credit) : '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline" onclick="Modules.COA.showEditAccountModal('${a.id}')">Edit</button>
        </td>
      </tr>
    `).join('');
  },

  filterTable: function() {
    const q = document.getElementById('coa-search-input')?.value.toLowerCase() || '';
    const filtered = this.accounts.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
    document.getElementById('coa-table-body').innerHTML = this.renderRows(filtered);
  },

  showAddAccountModal: function() {
    const body = `
      <form id="form-add-acc">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode Akun *</label>
            <input type="text" id="acc-code" class="form-control" placeholder="Contoh: 1116" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Akun *</label>
            <input type="text" id="acc-name" class="form-control" placeholder="Contoh: Kas Operasional Cabang" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kategori *</label>
            <select id="acc-category" class="form-control" required>
              <option value="ASET_LANCAR">ASET_LANCAR</option>
              <option value="ASET_TETAP">ASET_TETAP</option>
              <option value="KEWAJIBAN_LANCAR">KEWAJIBAN_LANCAR</option>
              <option value="KEWAJIBAN_JK_PANJANG">KEWAJIBAN_JK_PANJANG</option>
              <option value="EKUITAS">EKUITAS</option>
              <option value="PENDAPATAN">PENDAPATAN</option>
              <option value="HPP">HPP</option>
              <option value="BEBAN_OPERASIONAL">BEBAN_OPERASIONAL</option>
              <option value="PENDAPATAN_LAIN">PENDAPATAN_LAIN</option>
              <option value="BEBAN_LAIN">BEBAN_LAIN</option>
              <option value="PAJAK">PAJAK</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Saldo Normal *</label>
            <select id="acc-normal" class="form-control" required>
              <option value="DEBIT">DEBIT</option>
              <option value="KREDIT">KREDIT</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Sub-Klasifikasi Laporan</label>
          <input type="text" id="acc-sub" class="form-control" placeholder="Misal: Kas & Setara Kas, Beban Personalia">
        </div>

        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #E2E8F0; margin-top: 8px;">
          <div style="font-weight: 700; margin-bottom: 8px; color: #002B49;">Atribut Perpajakan Indonesia (Coretax / SPT)</div>
          <div style="display: flex; gap: 20px; align-items: center;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="acc-deductible" checked>
              Dapat Dikurangkan Secara Fiskal (Deductible)
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="acc-tax-object">
              Objek Pajak / Withholding Tax
            </label>
          </div>
          <div class="form-group" style="margin-top: 10px;">
            <label class="form-label">Jenis Objek Pajak (Jika Objek Pajak)</label>
            <select id="acc-tax-type" class="form-control">
              <option value="">- Bukan Objek Pajak Khusus -</option>
              <option value="PPN">PPN (Faktur Pajak)</option>
              <option value="PPH21">PPh Pasal 21 (Gaji/Imbalan)</option>
              <option value="PPH23">PPh Pasal 23 (Jasa/Sewa)</option>
              <option value="PPH4_2">PPh Final Pasal 4(2)</option>
              <option value="PPH22">PPh Pasal 22 (Impor/Pengadaan)</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.COA.saveNewAccount()">Simpan Akun</button>
    `;

    App.showModal('Tambah Akun Baru', body, footer);
  },

  saveNewAccount: async function() {
    const code = document.getElementById('acc-code')?.value.trim();
    const name = document.getElementById('acc-name')?.value.trim();
    const category = document.getElementById('acc-category')?.value;
    const normal = document.getElementById('acc-normal')?.value;
    const sub = document.getElementById('acc-sub')?.value.trim();
    const deductible = document.getElementById('acc-deductible')?.checked;
    const taxObject = document.getElementById('acc-tax-object')?.checked;
    const taxType = document.getElementById('acc-tax-type')?.value;

    if (!code || !name) {
      alert('Kode dan Nama akun wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          code, name, category, normal_balance: normal, sub_category: sub,
          is_tax_deductible: deductible ? 1 : 0,
          is_tax_object: taxObject ? 1 : 0,
          tax_type: taxType || null
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Akun berhasil dibuat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showEditAccountModal: function(accId) {
    const acc = this.accounts.find(a => a.id === accId);
    if (!acc) return;

    const body = `
      <form id="form-edit-acc">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode Akun</label>
            <input type="text" class="form-control" value="${acc.code}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Akun *</label>
            <input type="text" id="edit-acc-name" class="form-control" value="${acc.name}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kategori *</label>
            <select id="edit-acc-category" class="form-control" required>
              <option value="ASET_LANCAR" ${acc.category === 'ASET_LANCAR' ? 'selected' : ''}>ASET_LANCAR</option>
              <option value="ASET_TETAP" ${acc.category === 'ASET_TETAP' ? 'selected' : ''}>ASET_TETAP</option>
              <option value="KEWAJIBAN_LANCAR" ${acc.category === 'KEWAJIBAN_LANCAR' ? 'selected' : ''}>KEWAJIBAN_LANCAR</option>
              <option value="KEWAJIBAN_JK_PANJANG" ${acc.category === 'KEWAJIBAN_JK_PANJANG' ? 'selected' : ''}>KEWAJIBAN_JK_PANJANG</option>
              <option value="EKUITAS" ${acc.category === 'EKUITAS' ? 'selected' : ''}>EKUITAS</option>
              <option value="PENDAPATAN" ${acc.category === 'PENDAPATAN' ? 'selected' : ''}>PENDAPATAN</option>
              <option value="HPP" ${acc.category === 'HPP' ? 'selected' : ''}>HPP</option>
              <option value="BEBAN_OPERASIONAL" ${acc.category === 'BEBAN_OPERASIONAL' ? 'selected' : ''}>BEBAN_OPERASIONAL</option>
              <option value="PENDAPATAN_LAIN" ${acc.category === 'PENDAPATAN_LAIN' ? 'selected' : ''}>PENDAPATAN_LAIN</option>
              <option value="BEBAN_LAIN" ${acc.category === 'BEBAN_LAIN' ? 'selected' : ''}>BEBAN_LAIN</option>
              <option value="PAJAK" ${acc.category === 'PAJAK' ? 'selected' : ''}>PAJAK</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Saldo Normal *</label>
            <select id="edit-acc-normal" class="form-control" required>
              <option value="DEBIT" ${acc.normal_balance === 'DEBIT' ? 'selected' : ''}>DEBIT</option>
              <option value="KREDIT" ${acc.normal_balance === 'KREDIT' ? 'selected' : ''}>KREDIT</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Sub-Klasifikasi Laporan</label>
          <input type="text" id="edit-acc-sub" class="form-control" value="${acc.sub_category || ''}">
        </div>

        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #E2E8F0; margin-top: 8px;">
          <div style="font-weight: 700; margin-bottom: 8px; color: #002B49;">Atribut Perpajakan Indonesia (Coretax / SPT)</div>
          <div style="display: flex; gap: 20px; align-items: center;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="edit-acc-deductible" ${acc.is_tax_deductible !== 0 ? 'checked' : ''}>
              Dapat Dikurangkan Secara Fiskal (Deductible)
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="edit-acc-tax-object" ${acc.is_tax_object === 1 ? 'checked' : ''}>
              Objek Pajak / Withholding Tax
            </label>
          </div>
          <div class="form-group" style="margin-top: 10px;">
            <label class="form-label">Jenis Objek Pajak</label>
            <select id="edit-acc-tax-type" class="form-control">
              <option value="">- Bukan Objek Pajak Khusus -</option>
              <option value="PPN" ${acc.tax_type === 'PPN' ? 'selected' : ''}>PPN (Faktur Pajak)</option>
              <option value="PPH21" ${acc.tax_type === 'PPH21' ? 'selected' : ''}>PPh Pasal 21 (Gaji/Imbalan)</option>
              <option value="PPH23" ${acc.tax_type === 'PPH23' ? 'selected' : ''}>PPh Pasal 23 (Jasa/Sewa)</option>
              <option value="PPH4_2" ${acc.tax_type === 'PPH4_2' ? 'selected' : ''}>PPh Final Pasal 4(2)</option>
              <option value="PPH22" ${acc.tax_type === 'PPH22' ? 'selected' : ''}>PPh Pasal 22 (Impor/Pengadaan)</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-right: auto;" onclick="Modules.COA.deleteAccount('${acc.id}')">Hapus Akun</button>
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.COA.saveEditAccount('${acc.id}')">Simpan Perubahan</button>
    `;

    App.showModal(`Edit Akun [${acc.code}] ${acc.name}`, body, footer);
  },

  saveEditAccount: async function(accId) {
    const name = document.getElementById('edit-acc-name')?.value.trim();
    const category = document.getElementById('edit-acc-category')?.value;
    const normal = document.getElementById('edit-acc-normal')?.value;
    const sub = document.getElementById('edit-acc-sub')?.value.trim();
    const deductible = document.getElementById('edit-acc-deductible')?.checked;
    const taxObject = document.getElementById('edit-acc-tax-object')?.checked;
    const taxType = document.getElementById('edit-acc-tax-type')?.value;

    try {
      const res = await fetch(`/api/accounts/${accId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, category, normal_balance: normal, sub_category: sub,
          is_tax_deductible: deductible ? 1 : 0,
          is_tax_object: taxObject ? 1 : 0,
          tax_type: taxType || null
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Akun berhasil diperbarui!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  deleteAccount: async function(accId) {
    if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;

    try {
      const res = await fetch(`/api/accounts/${accId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Akun berhasil dihapus!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // SALDO AWAL (OPENING BALANCES) INPUT & REALTIME VALIDATION
  showInitialBalancesModal: async function() {
    try {
      const res = await fetch(`/api/accounts/initial-balances?entity_id=${App.activeEntity.id}`);
      const data = await res.json();

      let tableRows = data.items.map(it => `
        <tr data-acc-id="${it.account_id}">
          <td style="font-weight: 700;">${it.code}</td>
          <td>${it.name}</td>
          <td><span class="badge ${it.normal_balance === 'DEBIT' ? 'badge-info' : 'badge-gold'}">${it.normal_balance}</span></td>
          <td>
            <input type="number" step="any" class="form-control text-right ib-debit" value="${it.debit || 0}" oninput="Modules.COA.calcIBTotals()">
          </td>
          <td>
            <input type="number" step="any" class="form-control text-right ib-credit" value="${it.credit || 0}" oninput="Modules.COA.calcIBTotals()">
          </td>
        </tr>
      `).join('');

      const body = `
        <div style="margin-bottom: 12px; padding: 10px; background: #E0F2FE; border: 1px solid #BAE6FD; border-radius: 6px; font-size: 12px; color: #0369A1;">
          📌 <strong>Petunjuk Saldo Awal:</strong> Masukkan saldo awal Neraca per 1 Januari ${App.activeEntity.fiscal_year}. Total Debit harus SAMA PERSIS dengan Total Kredit agar pembukuan Neraca seimbang (Balanced).
        </div>

        <div style="max-height: 50vh; overflow-y: auto; border: 1px solid #CBD5E1; border-radius: 6px;">
          <table class="coretax-table" id="ib-table">
            <thead>
              <tr>
                <th style="width: 90px;">Kode</th>
                <th>Nama Akun</th>
                <th style="width: 80px;">Saldo Normal</th>
                <th class="text-right" style="width: 160px;">Saldo Awal Debit (Rp)</th>
                <th class="text-right" style="width: 160px;">Saldo Awal Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div id="ib-summary-box" style="margin-top: 14px; padding: 14px; border-radius: 6px; background: #F8FAFC; border: 2px solid #CBD5E1;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <div>Total Debit: <strong id="ib-sum-debit" style="color: #0284C7;">Rp 0</strong></div>
            <div>Total Kredit: <strong id="ib-sum-credit" style="color: #D97706;">Rp 0</strong></div>
            <div>Selisih: <strong id="ib-sum-diff" style="color: #059669;">Rp 0</strong></div>
            <div id="ib-status-badge"><span class="badge badge-success">SEIMBANG (BALANCED)</span></div>
          </div>
        </div>
      `;

      const footer = `
        <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
        <button class="btn btn-gold" onclick="Modules.COA.saveInitialBalances()">Simpan Saldo Awal</button>
      `;

      App.showModal(`Input Saldo Awal Entitas: ${App.activeEntity.name}`, body, footer);
      setTimeout(() => this.calcIBTotals(), 100);
    } catch (err) {
      alert('Gagal memuat saldo awal: ' + err.message);
    }
  },

  calcIBTotals: function() {
    let sumDebit = 0;
    let sumCredit = 0;

    document.querySelectorAll('#ib-table tbody tr').forEach(row => {
      const d = parseFloat(row.querySelector('.ib-debit')?.value) || 0;
      const c = parseFloat(row.querySelector('.ib-credit')?.value) || 0;
      sumDebit += d;
      sumCredit += c;
    });

    const diff = Math.abs(sumDebit - sumCredit);
    const isBalanced = diff < 0.01;

    document.getElementById('ib-sum-debit').textContent = App.formatIDR(sumDebit);
    document.getElementById('ib-sum-credit').textContent = App.formatIDR(sumCredit);
    document.getElementById('ib-sum-diff').textContent = App.formatIDR(diff);

    const badgeEl = document.getElementById('ib-status-badge');
    const boxEl = document.getElementById('ib-summary-box');

    if (isBalanced) {
      badgeEl.innerHTML = `<span class="badge badge-success">SEIMBANG (BALANCED)</span>`;
      boxEl.style.borderColor = '#10B981';
      boxEl.style.backgroundColor = '#ECFDF5';
    } else {
      badgeEl.innerHTML = `<span class="badge badge-danger">BELUM SEIMBANG (TIDAK BALANCE)</span>`;
      boxEl.style.borderColor = '#EF4444';
      boxEl.style.backgroundColor = '#FEF2F2';
    }
  },

  saveInitialBalances: async function() {
    const entries = [];
    document.querySelectorAll('#ib-table tbody tr').forEach(row => {
      const account_id = row.getAttribute('data-acc-id');
      const debit = parseFloat(row.querySelector('.ib-debit')?.value) || 0;
      const credit = parseFloat(row.querySelector('.ib-credit')?.value) || 0;
      entries.push({ account_id, debit, credit });
    });

    try {
      const res = await fetch('/api/accounts/initial-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          fiscal_year: App.activeEntity.fiscal_year,
          entries
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message, result.isBalanced ? 'success' : 'warning');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const headers = [
      { key: 'code', label: 'Kode Akun' },
      { key: 'name', label: 'Nama Akun' },
      { key: 'category', label: 'Kategori' },
      { key: 'sub_category', label: 'Sub-Kategori' },
      { key: 'normal_balance', label: 'Saldo Normal', align: 'center' },
      { key: 'initial_debit', label: 'Saldo Awal Debit', type: 'number' },
      { key: 'initial_credit', label: 'Saldo Awal Kredit', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Bagan_Akun_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Bagan Akun',
      'BAGAN AKUN PERUSAHAAN (CHART OF ACCOUNTS)',
      App.activeEntity,
      headers,
      this.accounts
    );
  }
};
