/**
 * General Ledger (Buku Besar) Module
 * Features running balances and interactive source document preview/download buttons.
 */

Modules.Ledger = {
  data: null,
  accounts: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Buku Besar...</div>`;

    try {
      const accRes = await fetch(`/api/accounts?entity_id=${App.activeEntity.id}`);
      this.accounts = await accRes.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📖</span> Buku Besar (General Ledger) & File Bukti Transaksi
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Saldo Berjalan Per Akun & Akses Langsung Dokumen Bukti Transaksi
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="Modules.Ledger.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('BUKU BESAR (GENERAL LEDGER)', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- FILTER BAR -->
        <div class="card-table-wrapper" style="padding: 14px 18px; margin-bottom: 20px;">
          <div style="display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
              <label class="form-label">Pilih Akun Rekening:</label>
              <select id="gl-account-select" class="form-control" onchange="Modules.Ledger.loadLedger()">
                <option value="ALL">- Semua Akun Rekening -</option>
                ${this.accounts.map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Dari Tanggal:</label>
              <input type="date" id="gl-start-date" class="form-control" onchange="Modules.Ledger.loadLedger()">
            </div>
            <div>
              <label class="form-label">Sampai Tanggal:</label>
              <input type="date" id="gl-end-date" class="form-control" onchange="Modules.Ledger.loadLedger()">
            </div>
            <div>
              <button class="btn btn-primary" onclick="Modules.Ledger.loadLedger()">
                <span>🔍</span> Tampilkan
              </button>
            </div>
          </div>
        </div>

        <div id="gl-content-area"></div>
      `;

      this.loadLedger();
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat: ${err.message}</div>`;
    }
  },

  loadLedger: async function() {
    const accId = document.getElementById('gl-account-select')?.value || 'ALL';
    const startDate = document.getElementById('gl-start-date')?.value || '';
    const endDate = document.getElementById('gl-end-date')?.value || '';
    const area = document.getElementById('gl-content-area');
    if (!area) return;

    area.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748B;">Menghitung saldo buku besar...</div>`;

    try {
      let url = `/api/general-ledger?entity_id=${App.activeEntity.id}`;
      if (accId !== 'ALL') url += `&account_id=${accId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      this.data = await res.json();

      let html = '';
      (this.data.accounts || []).forEach(acc => {
        // Only render accounts with movement or non-zero balance
        if (acc.movements.length === 0 && acc.opening_balance === 0) return;

        let rowsHtml = '';
        acc.movements.forEach(m => {
          rowsHtml += `
            <tr>
              <td>${m.date}</td>
              <td><strong>${m.journal_number}</strong></td>
              <td>${m.reference_no || '-'}</td>
              <td>
                ${m.description}
                ${m.memo ? `<div style="font-size: 11px; color: #64748B;">Memo: ${m.memo}</div>` : ''}
              </td>
              <td class="text-right">${m.debit > 0 ? App.formatIDR(m.debit) : '-'}</td>
              <td class="text-right">${m.credit > 0 ? App.formatIDR(m.credit) : '-'}</td>
              <td class="text-right" style="font-weight: 700; color: #002B49;">${App.formatIDR(m.running_balance)}</td>
              <td class="text-center">
                ${m.attachment_path ? `
                  <a href="${m.attachment_path}" target="_blank" class="badge badge-success" title="Buka File Bukti: ${m.attachment_name || 'Bukti Dokumen'}">
                    📄 ${m.attachment_name ? (m.attachment_name.length > 15 ? m.attachment_name.slice(0, 15) + '...' : m.attachment_name) : 'Buka Bukti'}
                  </a>
                ` : '<span style="color:#CBD5E1;">-</span>'}
              </td>
            </tr>
          `;
        });

        html += `
          <div class="card-table-wrapper" style="margin-bottom: 24px;">
            <div class="table-header-toolbar" style="background: #F1F5F9;">
              <div>
                <span style="font-size: 15px; font-weight: 800; color: #002B49; margin-right: 10px;">[${acc.account_code}] ${acc.account_name}</span>
                <span class="badge badge-neutral">${acc.category}</span>
                <span class="badge ${acc.normal_balance === 'DEBIT' ? 'badge-info' : 'badge-gold'}" style="margin-left: 6px;">Saldo Normal: ${acc.normal_balance}</span>
              </div>
              <div style="font-size: 12.5px;">
                Saldo Awal: <strong>${App.formatIDR(acc.opening_balance)}</strong> | Saldo Akhir: <strong style="color: #0284C7;">${App.formatIDR(acc.closing_balance)}</strong>
              </div>
            </div>

            <table class="coretax-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Tanggal</th>
                  <th style="width: 140px;">No. Jurnal</th>
                  <th style="width: 120px;">No. Referensi</th>
                  <th>Keterangan / Transaksi</th>
                  <th class="text-right" style="width: 130px;">Debit</th>
                  <th class="text-right" style="width: 130px;">Kredit</th>
                  <th class="text-right" style="width: 140px;">Saldo Berjalan</th>
                  <th class="text-center" style="width: 140px;">Bukti Dokumen</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background: #F8FAFC; font-style: italic; color: #64748B;">
                  <td colspan="4">Saldo Awal Periode</td>
                  <td class="text-right">-</td>
                  <td class="text-right">-</td>
                  <td class="text-right font-weight-bold">${App.formatIDR(acc.opening_balance)}</td>
                  <td class="text-center">-</td>
                </tr>
                ${rowsHtml || `<tr><td colspan="8" class="text-center" style="padding: 12px; color: #94A3B8;">Tidak ada mutasi transaksi pada periode ini</td></tr>`}
                <tr class="total-row">
                  <td colspan="4" class="text-right">TOTAL MUTASI PERIODE</td>
                  <td class="text-right">${App.formatIDR(acc.period_debit)}</td>
                  <td class="text-right">${App.formatIDR(acc.period_credit)}</td>
                  <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(acc.closing_balance)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      });

      if (!html) {
        html = `<div class="stat-card accent-navy" style="padding: 20px; text-align: center;">Tidak ada transaksi buku besar yang sesuai kriteria filter.</div>`;
      }

      area.innerHTML = html;
    } catch (err) {
      area.innerHTML = `<div class="stat-card accent-red">Gagal memuat buku besar: ${err.message}</div>`;
    }
  },

  exportExcel: function() {
    if (!this.data || !this.data.accounts) return;

    const flatRows = [];
    this.data.accounts.forEach(acc => {
      acc.movements.forEach(m => {
        flatRows.push({
          accCode: acc.account_code,
          accName: acc.account_name,
          date: m.date,
          journalNo: m.journal_number,
          refNo: m.reference_no,
          desc: m.description,
          debit: m.debit,
          credit: m.credit,
          balance: m.running_balance,
          attachment: m.attachment_name || '-'
        });
      });
    });

    const headers = [
      { key: 'accCode', label: 'Kode Akun' },
      { key: 'accName', label: 'Nama Akun' },
      { key: 'date', label: 'Tanggal' },
      { key: 'journalNo', label: 'No. Jurnal' },
      { key: 'refNo', label: 'No. Referensi' },
      { key: 'desc', label: 'Keterangan' },
      { key: 'debit', label: 'Debit', type: 'number' },
      { key: 'credit', label: 'Kredit', type: 'number' },
      { key: 'balance', label: 'Saldo Berjalan', type: 'number' },
      { key: 'attachment', label: 'Bukti Dokumen' }
    ];

    CoretaxExport.exportToExcel(
      `Buku_Besar_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Buku Besar',
      'BUKU BESAR PERUSAHAAN (GENERAL LEDGER)',
      App.activeEntity,
      headers,
      flatRows
    );
  }
};
