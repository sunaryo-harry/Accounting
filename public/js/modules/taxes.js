/**
 * Taxes & Tax Equalization Module (Perpajakan & Equalisasi Pajak DJP Coretax)
 */

Modules.Taxes = {
  currentTab: 'EQUALIZATION', // 'EQUALIZATION', 'RECORDS', 'PPN_SUMMARY'
  eqData: null,
  records: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Modul Perpajakan & Equalisasi...</div>`;

    try {
      await this.loadData();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>⚖️</span> Perpajakan Terkini & Equalisasi Pajak Coretax
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Equalisasi Omzet vs PPN, Beban vs PPh 21, 23, 4(2) & Kesiapan Audit Fiskus
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.Taxes.showAddTaxModal()">
              <span>➕</span> Rekam Bukti Potong / Faktur Pajak
            </button>
            <button class="btn btn-outline" onclick="Modules.Taxes.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('EQUALISASI PAJAK DAN KEPATUHAN FISKAL', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- TABS -->
        <div class="coretax-tabs">
          <button class="tab-btn ${this.currentTab === 'EQUALIZATION' ? 'active' : ''}" onclick="Modules.Taxes.switchTab('EQUALIZATION')">
            ⚖️ Equalisasi Pajak (Tax Equalization Matrix)
          </button>
          <button class="tab-btn ${this.currentTab === 'PPN_SUMMARY' ? 'active' : ''}" onclick="Modules.Taxes.switchTab('PPN_SUMMARY')">
            📑 SPT Masa PPN 1111 (Kurang/Lebih Bayar)
          </button>
          <button class="tab-btn ${this.currentTab === 'RECORDS' ? 'active' : ''}" onclick="Modules.Taxes.switchTab('RECORDS')">
            🧾 Riwayat Bukti Potong & Faktur Pajak
          </button>
        </div>

        <div id="taxes-tab-content">
          ${this.renderTabContent()}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat pajak: ${err.message}</div>`;
    }
  },

  loadData: async function() {
    const [eqRes, recRes] = await Promise.all([
      fetch(`/api/taxes/equalization?entity_id=${App.activeEntity.id}&year=${App.activeEntity.fiscal_year}`),
      fetch(`/api/taxes/records?entity_id=${App.activeEntity.id}&year=${App.activeEntity.fiscal_year}`)
    ]);

    this.eqData = await eqRes.json();
    const recData = await recRes.json();
    this.records = recData.records || [];
  },

  switchTab: function(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('main-content-view'));
  },

  renderTabContent: function() {
    if (this.currentTab === 'EQUALIZATION') {
      return this.renderEqualizationTab();
    } else if (this.currentTab === 'PPN_SUMMARY') {
      return this.renderPpnSummaryTab();
    } else {
      return this.renderRecordsTab();
    }
  },

  renderEqualizationTab: function() {
    const eqs = this.eqData?.equalizations || [];

    return `
      <div style="margin-bottom: 16px; padding: 12px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; font-size: 12.5px; color: #92400E;">
        🛡️ <strong>Prinsip Equalisasi Fiskus DJP Coretax:</strong> Equalisasi memastikan tidak terdapat potensi penghasilan yang belum dilaporkan pada SPT Masa PPN atau beban yang belum dipotong pajak (PPh 21, 23, 4(2)). Bila terdapat selisih, sistem menyediakan catatan rekonsiliasi yang siap diaudit.
      </div>

      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📊</span> Kertas Kerja Equalisasi Pajak Tahun Pajak ${this.eqData?.year || 2026}</div>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 250px;">Jenis Equalisasi</th>
                <th>Objek / Dasar Pengenaan</th>
                <th class="text-right" style="width: 140px;">Nilai Akuntansi (GL)</th>
                <th class="text-right" style="width: 140px;">Nilai SPT Dilaporkan</th>
                <th class="text-right" style="width: 130px;">Selisih (Difference)</th>
                <th class="text-center" style="width: 110px;">Status Kepatuhan</th>
                <th>Keterangan Auditor / Fiskus</th>
              </tr>
            </thead>
            <tbody>
              ${eqs.map(eq => `
                <tr>
                  <td>
                    <strong>${eq.title}</strong>
                    <div style="font-size: 11px; color: #64748B;">Pajak Terutang: ${App.formatIDR(eq.taxDue)}</div>
                  </td>
                  <td>
                    <strong>${eq.taxObject}</strong>
                    <div style="font-size: 11px; color: #64748B;">GL: ${eq.glDescription}</div>
                  </td>
                  <td class="text-right font-weight-bold">${App.formatIDR(eq.glAmount)}</td>
                  <td class="text-right font-weight-bold" style="color: #0284C7;">${App.formatIDR(eq.sptAmount)}</td>
                  <td class="text-right font-weight-bold" style="color: ${eq.difference !== 0 ? '#DC2626' : '#059669'};">
                    ${App.formatIDR(eq.difference)}
                  </td>
                  <td class="text-center">
                    <span class="badge ${eq.status === 'EQUAL' ? 'badge-success' : 'badge-warning'}">
                      ${eq.status === 'EQUAL' ? '✓ MATCH (EQUAL)' : 'SELISIH WAKTU'}
                    </span>
                  </td>
                  <td style="font-size: 11.5px; color: #334155;">${eq.explanation}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderPpnSummaryTab: function() {
    // Group tax records for PPN
    const ppnOut = this.records.filter(r => r.tax_type === 'PPN_KELUARAN');
    const ppnIn = this.records.filter(r => r.tax_type === 'PPN_MASUKAN');

    const totPpnOut = ppnOut.reduce((s, r) => s + (Number(r.tax_amount) || 0), 0);
    const totPpnIn = ppnIn.reduce((s, r) => s + (Number(r.tax_amount) || 0), 0);
    const netPpn = totPpnOut - totPpnIn;

    return `
      <div class="grid-cards">
        <div class="stat-card accent-gold">
          <div class="stat-title">PPN Keluaran (Penjualan / Penyerahan)</div>
          <div class="stat-value" style="color: #B45309;">${App.formatIDR(totPpnOut)}</div>
          <div class="stat-sub">${ppnOut.length} Faktur Pajak Keluaran</div>
        </div>
        <div class="stat-card accent-navy">
          <div class="stat-title">PPN Masukan (Dapat Dikreditkan)</div>
          <div class="stat-value">${App.formatIDR(totPpnIn)}</div>
          <div class="stat-sub">${ppnIn.length} Faktur Pajak Masukan</div>
        </div>
        <div class="stat-card ${netPpn > 0 ? 'accent-red' : 'accent-green'}">
          <div class="stat-title">Status SPT Masa PPN 1111</div>
          <div class="stat-value" style="color: ${netPpn > 0 ? '#DC2626' : '#059669'};">
            ${App.formatIDR(Math.abs(netPpn))}
          </div>
          <div class="stat-sub">${netPpn > 0 ? 'PPN Kurang Bayar (Wajib Disetor ke Kas Negara)' : (netPpn < 0 ? 'PPN Lebih Bayar (Kompensasi ke Masa Depan)' : 'PPN Nihil')}</div>
        </div>
      </div>

      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> Formulir Induk SPT Masa PPN 1111 (Ringkasan Pajak Pertambahan Nilai)</div>
        </div>
        <div style="padding: 18px;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th>Uraian Komponen PPN</th>
                <th class="text-right" style="width: 180px;">Dasar Pengenaan Pajak (DPP)</th>
                <th class="text-right" style="width: 180px;">Jumlah PPN (11%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>I. Penyerahan Barang Kena Pajak / Jasa Kena Pajak (Faktur Keluaran)</strong></td>
                <td class="text-right">${App.formatIDR(ppnOut.reduce((s, r) => s + (Number(r.dpp) || 0), 0))}</td>
                <td class="text-right font-weight-bold" style="color: #B45309;">${App.formatIDR(totPpnOut)}</td>
              </tr>
              <tr>
                <td><strong>II. Perolehan BKP / JKP yang Dapat Dikreditkan (Faktur Masukan)</strong></td>
                <td class="text-right">${App.formatIDR(ppnIn.reduce((s, r) => s + (Number(r.dpp) || 0), 0))}</td>
                <td class="text-right font-weight-bold" style="color: #0284C7;">${App.formatIDR(totPpnIn)}</td>
              </tr>
              <tr class="total-row" style="background: #FEF3C7;">
                <td style="font-weight: 800; color: #002B49;">
                  III. JUMLAH PPN KURANG / (LEBIH) BAYAR TAHUN BERJALAN
                </td>
                <td class="text-right">-</td>
                <td class="text-right font-weight-bold" style="font-size: 14px; color: ${netPpn > 0 ? '#DC2626' : '#059669'};">
                  ${App.formatIDR(netPpn)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderRecordsTab: function() {
    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>🧾</span> Daftar Bukti Potong & Faktur Pajak Terdaftar</div>
        </div>
        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 90px;">Masa/Thn</th>
                <th style="width: 100px;">Tanggal</th>
                <th style="width: 110px;">Jenis Pajak</th>
                <th style="width: 140px;">No. Bukti / Faktur</th>
                <th>Nama Wajib Pajak / Mitra</th>
                <th class="text-right" style="width: 130px;">Dasar Pengenaan (DPP)</th>
                <th class="text-center" style="width: 60px;">Tarif</th>
                <th class="text-right" style="width: 130px;">Pajak Terutang</th>
              </tr>
            </thead>
            <tbody>
              ${this.records.map(r => `
                <tr>
                  <td>${r.period_month}/${r.period_year}</td>
                  <td>${r.date}</td>
                  <td><span class="badge badge-info">${r.tax_type}</span></td>
                  <td><strong>${r.faktur_pajak_no || r.bukti_potong_no || '-'}</strong></td>
                  <td>
                    <strong>${r.name || r.contact_name || '-'}</strong>
                    ${r.npwp ? `<div style="font-size: 11px; color: #64748B;">NPWP: ${r.npwp}</div>` : ''}
                  </td>
                  <td class="text-right">${App.formatIDR(r.dpp)}</td>
                  <td class="text-center">${r.tax_rate}%</td>
                  <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(r.tax_amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  showAddTaxModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const body = `
      <form id="form-add-tax">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Jenis Pajak *</label>
            <select id="new-tax-type" class="form-control">
              <option value="PPN_KELUARAN">PPN Keluaran (Faktur Keluaran)</option>
              <option value="PPN_MASUKAN">PPN Masukan (Faktur Masukan)</option>
              <option value="PPH21">PPh Pasal 21 (Gaji / Upah / Jasa)</option>
              <option value="PPH23">PPh Pasal 23 (Jasa / Sewa / Royalti)</option>
              <option value="PPH4_2">PPh Final Pasal 4(2) (Sewa Gedung / Bunga)</option>
              <option value="PPH22">PPh Pasal 22 (Impor / Pengadaan)</option>
              <option value="PPH25">PPh Pasal 25 (Angsuran Pajak)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Masa Pajak (Bulan) *</label>
            <input type="number" id="new-tax-month" class="form-control" value="${month}" min="1" max="12" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tahun Pajak *</label>
            <input type="number" id="new-tax-year" class="form-control" value="${year}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nomor Faktur Pajak / Bupot *</label>
            <input type="text" id="new-tax-docno" class="form-control" placeholder="Contoh: 010.001-26.98765432" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Dokumen *</label>
            <input type="date" id="new-tax-date" class="form-control" value="${today}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nama Lawan Transaksi / Karyawan *</label>
            <input type="text" id="new-tax-name" class="form-control" placeholder="Nama entitas atau orang pribadi" required>
          </div>
          <div class="form-group">
            <label class="form-label">NPWP / NIK</label>
            <input type="text" id="new-tax-npwp" class="form-control" placeholder="01.234.567.8-012.000">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Dasar Pengenaan Pajak (DPP) (Rp) *</label>
            <input type="number" id="new-tax-dpp" class="form-control" value="0" oninput="Modules.Taxes.calcTaxAmount()" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tarif Pajak (%) *</label>
            <input type="number" id="new-tax-rate" class="form-control" value="11" oninput="Modules.Taxes.calcTaxAmount()" required>
          </div>
        </div>

        <div style="background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <div>Pajak Terutang / Dipotong:</div>
            <strong id="new-tax-calc" style="font-size: 16px; color: #002B49;">Rp 0</strong>
          </div>
        </div>

        <div class="form-group" style="margin-top: 10px;">
          <label class="form-label">Catatan / Uraian</label>
          <input type="text" id="new-tax-notes" class="form-control" placeholder="Keterangan transaksi perpajakan...">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Taxes.saveNewTaxRecord()">Simpan Pajak</button>
    `;

    App.showModal('Rekam Bukti Potong / Faktur Pajak Baru', body, footer);
  },

  calcTaxAmount: function() {
    const dpp = parseFloat(document.getElementById('new-tax-dpp')?.value) || 0;
    const rate = parseFloat(document.getElementById('new-tax-rate')?.value) || 0;
    const tax = (dpp * rate) / 100;
    document.getElementById('new-tax-calc').textContent = App.formatIDR(tax);
  },

  saveNewTaxRecord: async function() {
    const type = document.getElementById('new-tax-type')?.value;
    const month = parseInt(document.getElementById('new-tax-month')?.value) || 1;
    const year = parseInt(document.getElementById('new-tax-year')?.value) || 2026;
    const docNo = document.getElementById('new-tax-docno')?.value.trim();
    const date = document.getElementById('new-tax-date')?.value;
    const name = document.getElementById('new-tax-name')?.value.trim();
    const npwp = document.getElementById('new-tax-npwp')?.value.trim();
    const dpp = parseFloat(document.getElementById('new-tax-dpp')?.value) || 0;
    const rate = parseFloat(document.getElementById('new-tax-rate')?.value) || 0;
    const notes = document.getElementById('new-tax-notes')?.value.trim();

    if (!docNo || !name || dpp <= 0) {
      alert('Nomor dokumen, nama, dan DPP wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/taxes/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          tax_type: type,
          period_month: month,
          period_year: year,
          faktur_pajak_no: type.startsWith('PPN') ? docNo : null,
          bukti_potong_no: !type.startsWith('PPN') ? docNo : null,
          date,
          name,
          npwp,
          dpp,
          tax_rate: rate,
          notes
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Data perpajakan berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const headers = [
      { key: 'title', label: 'Jenis Equalisasi' },
      { key: 'taxObject', label: 'Objek Pajak' },
      { key: 'glAmount', label: 'Nilai Akuntansi (GL)', type: 'number' },
      { key: 'sptAmount', label: 'Nilai SPT Dilaporkan', type: 'number' },
      { key: 'difference', label: 'Selisih (Difference)', type: 'number' },
      { key: 'status', label: 'Status' },
      { key: 'explanation', label: 'Keterangan Auditor' }
    ];

    CoretaxExport.exportToExcel(
      `Equalisasi_Pajak_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Equalisasi Pajak',
      'KERTAS KERJA EQUALISASI PAJAK DAN KEPATUHAN FISKUS',
      App.activeEntity,
      headers,
      this.eqData?.equalizations || []
    );
  }
};
