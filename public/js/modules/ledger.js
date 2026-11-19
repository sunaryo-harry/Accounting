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
                  <div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">
                    <a href="${m.attachment_path}" target="_blank" class="btn btn-sm btn-outline-success" style="padding: 2px 6px; font-size: 11px;" title="Buka File Bukti PDF: ${m.attachment_name || 'Dokumen'}">
                      👁️ Buka PDF
                    </a>
                    <a href="${m.attachment_path}" download="${m.attachment_name || 'Bukti-' + m.journal_number + '.pdf'}" class="btn btn-sm btn-outline-primary" style="padding: 2px 6px; font-size: 11px;" title="Unduh File Bukti PDF: ${m.attachment_name || 'Dokumen'}">
                      ⬇️ Unduh
                    </a>
                    <button class="btn btn-sm btn-outline" style="padding: 2px 5px; font-size: 10px;" onclick="Modules.Ledger.showUploadModal('${m.journal_id}', '${m.journal_number}')" title="Ganti Bukti PDF">
                      ✏️
                    </button>
                  </div>
                ` : `
                  <button class="btn btn-sm btn-gold" style="padding: 3px 8px; font-size: 11px;" onclick="Modules.Ledger.showUploadModal('${m.journal_id}', '${m.journal_number}')" title="Unggah Bukti PDF untuk transaksi voucher ini">
                    📤 Unggah Bukti PDF
                  </button>
                `}
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
  },

  // Modal to Upload PDF Proof for a Ledger Transaction
  showUploadModal: async function(journalId, journalNumber) {
    App.showModal('Memuat Transaksi...', `<div style="text-align: center; padding: 20px;">Memuat detail transaksi voucher...</div>`);

    try {
      const res = await fetch(`/api/general-ledger/voucher/${journalId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const j = data.journal;
      const items = data.items || [];

      const body = `
        <div style="margin-bottom: 16px;">
          <!-- SHARED PROOF NOTICE -->
          <div style="background: #EFF6FF; border-left: 4px solid #0284C7; padding: 12px 16px; border-radius: 4px; margin-bottom: 14px;">
            <div style="font-weight: 700; color: #002B49; font-size: 13px;">💡 Ketentuan Satu Bukti Terpadu:</div>
            <div style="font-size: 12px; color: #334155; margin-top: 4px; line-height: 1.5;">
              Voucher transaksi ini memiliki <strong>${items.length} baris mutasi akun</strong> dalam satu transaksi. <strong>Cukup satu file bukti PDF yang diunggah</strong>, dan bukti tersebut akan otomatis terhubung ke seluruh mutasi akun di bawah ini serta dapat langsung dibuka maupun diunduh dari Buku Besar masing-masing akun.
            </div>
          </div>

          <!-- TRANSACTION SUMMARY -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; margin-bottom: 14px; font-size: 12.5px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
              <div><strong>No. Jurnal:</strong> <span class="badge badge-gold">${j.journal_number}</span></div>
              <div><strong>Tanggal:</strong> ${j.date}</div>
              <div><strong>No. Referensi:</strong> ${j.reference_no || '-'}</div>
              <div><strong>Tipe Jurnal:</strong> ${j.journal_type}</div>
            </div>
            <div><strong>Keterangan:</strong> ${j.description}</div>
            <div style="margin-top: 6px; font-weight: 700; color: #002B49;">Total Transaksi: ${App.formatIDR(j.total_amount)}</div>
          </div>

          <!-- LIST OF MOVEMENTS IN THIS VOUCHER -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">Mutasi Akun Terkait Dalam Bukti Ini (${items.length} Akun):</div>
            <div style="max-height: 140px; overflow-y: auto; border: 1px solid #CBD5E1; border-radius: 4px;">
              <table class="coretax-table" style="font-size: 11px; margin: 0;">
                <thead>
                  <tr style="background: #F1F5F9;">
                    <th>Kode & Nama Akun</th>
                    <th class="text-right" style="width: 100px;">Debit</th>
                    <th class="text-right" style="width: 100px;">Kredit</th>
                    <th>Memo</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td><strong>[${it.account_code}]</strong> ${it.account_name}</td>
                      <td class="text-right">${it.debit > 0 ? App.formatIDR(it.debit) : '-'}</td>
                      <td class="text-right">${it.credit > 0 ? App.formatIDR(it.credit) : '-'}</td>
                      <td>${it.memo || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- CURRENT ATTACHMENT IF ANY -->
          ${j.attachment_path ? `
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="color: #065F46; font-weight: 700; font-size: 12.5px;">✓ Bukti Saat Ini Terpasang:</span>
                <div style="font-size: 12px; color: #047857; margin-top: 2px;">📄 ${j.attachment_name || 'Dokumen Bukti'}</div>
              </div>
              <div style="display: flex; gap: 6px;">
                <a href="${j.attachment_path}" target="_blank" class="btn btn-sm btn-outline-success">👁️ Buka PDF</a>
                <a href="${j.attachment_path}" download="${j.attachment_name || 'bukti.pdf'}" class="btn btn-sm btn-outline-primary">⬇️ Unduh</a>
              </div>
            </div>
          ` : ''}

          <!-- UPLOAD FORM -->
          <form id="form-upload-ledger-proof">
            <input type="hidden" id="upload-proof-journal-id" value="${j.id}">
            <div class="form-group">
              <label class="form-label font-weight-bold">Pilih Dokumen Bukti Format PDF *</label>
              <input type="file" id="upload-proof-file" class="form-control" accept=".pdf,application/pdf" required>
              <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
                Format yang didukung: Dokumen PDF (Maksimal 30 MB). Hasil unggah dapat langsung dibuka dan diunduh oleh staf atau auditor.
              </div>
            </div>
          </form>
        </div>
      `;

      const footer = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-size: 11px; color: #64748B;">Credit by Harry Sunaryo</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline" onclick="App.closeModal()">Tutup</button>
            <button id="btn-submit-proof" class="btn btn-gold" onclick="Modules.Ledger.submitUploadProof()">
              <span>📤</span> ${j.attachment_path ? 'Ganti & Simpan Bukti PDF' : 'Unggah & Pasang Bukti PDF'}
            </button>
          </div>
        </div>
      `;

      App.showModal(`Unggah Dokumen Bukti PDF [${j.journal_number}]`, body, footer);
    } catch (err) {
      App.showModal('Kesalahan', `<div class="stat-card accent-red">Gagal memuat transaksi: ${err.message}</div>`);
    }
  },

  submitUploadProof: async function() {
    const journalId = document.getElementById('upload-proof-journal-id')?.value;
    const fileInput = document.getElementById('upload-proof-file');
    const file = fileInput?.files?.[0];

    if (!file) {
      alert('Silakan pilih file bukti berformat PDF terlebih dahulu!');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('File harus berformat PDF (.pdf)!');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-proof');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Mengunggah File PDF...`;
    }

    try {
      const formData = new FormData();
      formData.append('journal_id', journalId);
      formData.append('attachment', file);

      const res = await fetch('/api/general-ledger/upload-proof', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message || 'Bukti PDF berhasil diunggah dan terhubung ke seluruh mutasi akun!', 'success');
      App.closeModal();
      this.loadLedger();
    } catch (err) {
      alert('Gagal mengunggah bukti: ' + err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>📤</span> Coba Unggah Lagi`;
      }
    }
  }
};
