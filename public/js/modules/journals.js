/**
 * General & Special Journals Module
 */

Modules.Journals = {
  journals: [],
  accounts: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Jurnal Transaksi...</div>`;

    try {
      const [jrnRes, accRes] = await Promise.all([
        fetch(`/api/journals?entity_id=${App.activeEntity.id}`),
        fetch(`/api/accounts?entity_id=${App.activeEntity.id}`)
      ]);

      this.journals = await jrnRes.json();
      this.accounts = await accRes.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📝</span> Jurnal Umum, Khusus & Penyesuaian
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Pencatatan Transaksi Lengkap dengan Unggah Bukti Transaksi (Source Documents)
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="CoretaxImporter.showImportModal('journals', () => Modules.Journals.render(document.getElementById('main-content-view')))">
              <span>📥</span> Template & Impor Jurnal
            </button>
            <button class="btn btn-gold" onclick="Modules.Journals.showAddJournalModal()">
              <span>➕</span> Buat Entri Jurnal Baru
            </button>
            <button class="btn btn-outline" onclick="Modules.Journals.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('DAFTAR JURNAL TRANSAKSI', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Riwayat Entri Jurnal</div>
            <div style="display: flex; gap: 8px;">
              <select id="jrn-type-filter" class="form-control" style="width: 170px;" onchange="Modules.Journals.filterJournals()">
                <option value="ALL">Semua Jenis Jurnal</option>
                <option value="GENERAL">Jurnal Umum</option>
                <option value="INVENTORY">Jurnal Persediaan</option>
                <option value="SALES">Jurnal Penjualan</option>
                <option value="PURCHASE">Jurnal Pembelian</option>
                <option value="CASH_IN">Kas Masuk</option>
                <option value="CASH_OUT">Kas Keluar</option>
                <option value="ADJUSTING">Jurnal Penyesuaian</option>
              </select>
              <input type="text" id="jrn-search-input" class="form-control" placeholder="Cari nomor, keterangan, no ref..." style="width: 250px;" oninput="Modules.Journals.filterJournals()">
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="coretax-table" id="journals-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Tanggal</th>
                  <th style="width: 140px;">No. Jurnal</th>
                  <th style="width: 90px;">Tipe</th>
                  <th style="width: 130px;">No. Referensi</th>
                  <th>Keterangan / Uraian Transaksi</th>
                  <th class="text-right" style="width: 130px;">Total Debit/Kredit</th>
                  <th class="text-center" style="width: 110px;">Bukti Fisik</th>
                  <th class="text-center" style="width: 100px;">Aksi</th>
                </tr>
              </thead>
              <tbody id="journals-table-body">
                ${this.renderRows(this.journals)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat jurnal: ${err.message}</div>`;
    }
  },

  renderRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="8" class="text-center" style="padding: 20px;">Belum ada jurnal yang tercatat.</td></tr>`;
    }

    return list.map(j => `
      <tr>
        <td>${j.date}</td>
        <td><strong>${j.journal_number}</strong></td>
        <td><span class="badge badge-neutral">${j.journal_type}</span></td>
        <td>${j.reference_no || '-'}</td>
        <td>${j.description}</td>
        <td class="text-right font-weight-bold"><strong>${App.formatIDR(j.total_amount)}</strong></td>
        <td class="text-center">
          ${j.attachment_path ? `
            <a href="${j.attachment_path}" target="_blank" class="badge badge-success" title="Lihat Bukti: ${j.attachment_name || 'File'}">
              📄 Lihat Bukti
            </a>
          ` : '<span style="color:#94A3B8;">-</span>'}
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline" onclick="Modules.Journals.viewDetail('${j.id}')">Detail</button>
        </td>
      </tr>
    `).join('');
  },

  filterJournals: function() {
    const type = document.getElementById('jrn-type-filter')?.value || 'ALL';
    const q = document.getElementById('jrn-search-input')?.value.toLowerCase() || '';

    const filtered = this.journals.filter(j => {
      const matchType = type === 'ALL' || j.journal_type === type;
      const matchQ = j.journal_number.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || (j.reference_no && j.reference_no.toLowerCase().includes(q));
      return matchType && matchQ;
    });

    document.getElementById('journals-table-body').innerHTML = this.renderRows(filtered);
  },

  viewDetail: async function(journalId) {
    try {
      const res = await fetch(`/api/journals/${journalId}`);
      const data = await res.json();

      let itemsHtml = data.items.map(it => `
        <tr>
          <td><strong>${it.account_code}</strong></td>
          <td>${it.account_name}</td>
          <td>${it.memo || '-'}</td>
          <td class="text-right">${it.debit > 0 ? App.formatIDR(it.debit) : '-'}</td>
          <td class="text-right">${it.credit > 0 ? App.formatIDR(it.credit) : '-'}</td>
        </tr>
      `).join('');

      const body = `
        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 14px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div><strong>No. Jurnal:</strong> ${data.journal_number}</div>
            <div><strong>Tanggal:</strong> ${data.date}</div>
            <div><strong>Tipe:</strong> <span class="badge badge-neutral">${data.journal_type}</span></div>
            <div><strong>No. Referensi:</strong> ${data.reference_no || '-'}</div>
            <div style="grid-column: span 2;"><strong>Keterangan:</strong> ${data.description}</div>
            <div>
              <strong>Bukti Dokumen:</strong> 
              ${data.attachment_path ? `<a href="${data.attachment_path}" target="_blank" style="color: #0284C7; font-weight: 600;">🔗 ${data.attachment_name || 'Buka Bukti Transaksi'}</a>` : '<span style="color:#94A3B8;">Tidak ada lampiran</span>'}
            </div>
          </div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 100px;">Kode Akun</th>
              <th>Nama Akun</th>
              <th>Memo</th>
              <th class="text-right" style="width: 140px;">Debit</th>
              <th class="text-right" style="width: 140px;">Kredit</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="3" class="text-right">TOTAL</td>
              <td class="text-right">${App.formatIDR(data.total_amount)}</td>
              <td class="text-right">${App.formatIDR(data.total_amount)}</td>
            </tr>
          </tbody>
        </table>
      `;

      const footer = `
        <button class="btn btn-outline" onclick="App.closeModal()">Tutup</button>
      `;

      App.showModal(`Detail Jurnal: ${data.journal_number}`, body, footer);
    } catch (err) {
      alert('Gagal memuat detail: ' + err.message);
    }
  },

  showAddJournalModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const accountOptions = this.accounts.map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-add-journal" enctype="multipart/form-data">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Transaksi *</label>
            <input type="date" id="new-jrn-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Jurnal *</label>
            <select id="new-jrn-type" class="form-control">
              <option value="GENERAL">Jurnal Umum (General Journal)</option>
              <option value="INVENTORY">Jurnal Persediaan (Multi Gudang / HPP)</option>
              <option value="SALES">Jurnal Penjualan</option>
              <option value="PURCHASE">Jurnal Pembelian</option>
              <option value="CASH_IN">Penerimaan Kas/Bank</option>
              <option value="CASH_OUT">Pengeluaran Kas/Bank</option>
              <option value="ADJUSTING">Jurnal Penyesuaian (AJP)</option>
              <option value="CLOSING">Jurnal Penutup</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Referensi / Faktur</label>
            <input type="text" id="new-jrn-ref" class="form-control" placeholder="Misal: BKK-001 / INV-123">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Keterangan Transaksi *</label>
          <input type="text" id="new-jrn-desc" class="form-control" placeholder="Contoh: Pembayaran Biaya Sewa Kantor Bulan Depan" required>
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah File Bukti Transaksi (Kwitansi / Faktur / Transfer PDF/Gambar)</label>
          <input type="file" id="new-jrn-attachment" class="form-control" accept="image/*,application/pdf">
        </div>

        <div style="margin-top: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: 700; color: #002B49;">Baris Akun Jurnal (Debit & Kredit)</div>
            <button type="button" class="btn btn-sm btn-outline" onclick="Modules.Journals.addJournalRow()">➕ Tambah Baris Akun</button>
          </div>

          <table class="coretax-table" id="new-jrn-items-table">
            <thead>
              <tr>
                <th style="width: 280px;">Akun Rekening</th>
                <th>Memo / Catatan</th>
                <th class="text-right" style="width: 140px;">Debit (Rp)</th>
                <th class="text-right" style="width: 140px;">Kredit (Rp)</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody id="new-jrn-items-tbody">
              <!-- Default 2 rows -->
              <tr>
                <td><select class="form-control jrn-acc">${accountOptions}</select></td>
                <td><input type="text" class="form-control jrn-memo" placeholder="Memo..."></td>
                <td><input type="number" step="any" class="form-control text-right jrn-debit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
                <td><input type="number" step="any" class="form-control text-right jrn-credit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
                <td class="text-center"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove(); Modules.Journals.calcNewJrnTotals();">×</button></td>
              </tr>
              <tr>
                <td><select class="form-control jrn-acc">${accountOptions}</select></td>
                <td><input type="text" class="form-control jrn-memo" placeholder="Memo..."></td>
                <td><input type="number" step="any" class="form-control text-right jrn-debit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
                <td><input type="number" step="any" class="form-control text-right jrn-credit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
                <td class="text-center"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove(); Modules.Journals.calcNewJrnTotals();">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="new-jrn-summary-box" style="margin-top: 14px; padding: 12px; border-radius: 6px; background: #F8FAFC; border: 2px solid #CBD5E1;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <div>Total Debit: <strong id="new-jrn-sum-debit" style="color: #0284C7;">Rp 0</strong></div>
            <div>Total Kredit: <strong id="new-jrn-sum-credit" style="color: #D97706;">Rp 0</strong></div>
            <div>Selisih: <strong id="new-jrn-sum-diff" style="color: #059669;">Rp 0</strong></div>
            <div id="new-jrn-status-badge"><span class="badge badge-success">SEIMBANG (BALANCED)</span></div>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Journals.saveNewJournal()">Posting Jurnal</button>
    `;

    App.showModal('Catat Jurnal Transaksi Baru', body, footer);
  },

  addJournalRow: function() {
    const accountOptions = this.accounts.map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="form-control jrn-acc">${accountOptions}</select></td>
      <td><input type="text" class="form-control jrn-memo" placeholder="Memo..."></td>
      <td><input type="number" step="any" class="form-control text-right jrn-debit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
      <td><input type="number" step="any" class="form-control text-right jrn-credit" value="0" oninput="Modules.Journals.calcNewJrnTotals()"></td>
      <td class="text-center"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove(); Modules.Journals.calcNewJrnTotals();">×</button></td>
    `;
    document.getElementById('new-jrn-items-tbody')?.appendChild(tr);
  },

  calcNewJrnTotals: function() {
    let sumDebit = 0;
    let sumCredit = 0;

    document.querySelectorAll('#new-jrn-items-tbody tr').forEach(row => {
      const d = parseFloat(row.querySelector('.jrn-debit')?.value) || 0;
      const c = parseFloat(row.querySelector('.jrn-credit')?.value) || 0;
      sumDebit += d;
      sumCredit += c;
    });

    const diff = Math.abs(sumDebit - sumCredit);
    const isBalanced = diff < 0.01 && sumDebit > 0;

    document.getElementById('new-jrn-sum-debit').textContent = App.formatIDR(sumDebit);
    document.getElementById('new-jrn-sum-credit').textContent = App.formatIDR(sumCredit);
    document.getElementById('new-jrn-sum-diff').textContent = App.formatIDR(diff);

    const badgeEl = document.getElementById('new-jrn-status-badge');
    const boxEl = document.getElementById('new-jrn-summary-box');

    if (isBalanced) {
      badgeEl.innerHTML = `<span class="badge badge-success">SEIMBANG (BALANCED)</span>`;
      boxEl.style.borderColor = '#10B981';
      boxEl.style.backgroundColor = '#ECFDF5';
    } else {
      badgeEl.innerHTML = `<span class="badge badge-danger">TIDAK BALANCE</span>`;
      boxEl.style.borderColor = '#EF4444';
      boxEl.style.backgroundColor = '#FEF2F2';
    }
  },

  saveNewJournal: async function() {
    const date = document.getElementById('new-jrn-date')?.value;
    const type = document.getElementById('new-jrn-type')?.value;
    const ref = document.getElementById('new-jrn-ref')?.value.trim();
    const desc = document.getElementById('new-jrn-desc')?.value.trim();
    const fileInput = document.getElementById('new-jrn-attachment');

    if (!date || !desc) {
      alert('Tanggal dan Keterangan transaksi wajib diisi!');
      return;
    }

    const items = [];
    let sumDebit = 0;
    let sumCredit = 0;

    document.querySelectorAll('#new-jrn-items-tbody tr').forEach(row => {
      const account_id = row.querySelector('.jrn-acc')?.value;
      const memo = row.querySelector('.jrn-memo')?.value.trim();
      const debit = parseFloat(row.querySelector('.jrn-debit')?.value) || 0;
      const credit = parseFloat(row.querySelector('.jrn-credit')?.value) || 0;

      if (debit > 0 || credit > 0) {
        sumDebit += debit;
        sumCredit += credit;
        items.push({ account_id, memo, debit, credit });
      }
    });

    if (items.length < 2) {
      alert('Jurnal minimal harus memiliki 2 baris akun!');
      return;
    }

    if (Math.abs(sumDebit - sumCredit) > 0.01) {
      alert(`Jurnal tidak balance! Total Debit: ${App.formatIDR(sumDebit)} != Total Kredit: ${App.formatIDR(sumCredit)}`);
      return;
    }

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('date', date);
    formData.append('journal_type', type);
    formData.append('reference_no', ref);
    formData.append('description', desc);
    formData.append('items', JSON.stringify(items));

    if (fileInput?.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/journals', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Jurnal berhasil dicatat dan diposting!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const headers = [
      { key: 'date', label: 'Tanggal' },
      { key: 'journal_number', label: 'Nomor Jurnal' },
      { key: 'journal_type', label: 'Tipe' },
      { key: 'reference_no', label: 'No. Referensi' },
      { key: 'description', label: 'Keterangan' },
      { key: 'total_amount', label: 'Total Nominal', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Daftar_Jurnal_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Jurnal',
      'DAFTAR JURNAL TRANSAKSI PERUSAHAAN',
      App.activeEntity,
      headers,
      this.journals
    );
  }
};
