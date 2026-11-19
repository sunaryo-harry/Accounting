/**
 * Fixed Assets Module (Daftar Aktiva Tetap & Penyusutan Fiskal)
 */

Modules.Assets = {
  data: null,
  accounts: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Daftar Aktiva Tetap...</div>`;

    try {
      const [faRes, accRes] = await Promise.all([
        fetch(`/api/assets?entity_id=${App.activeEntity.id}`),
        fetch(`/api/accounts?entity_id=${App.activeEntity.id}`)
      ]);

      this.data = await faRes.json();
      this.accounts = await accRes.json();
      const summary = this.data.summary || {};

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>🏢</span> Daftar Perincian Aktiva Tetap & Penyusutan Fiskal
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Kelompok Masa Manfaat Fiskal UU PPh (Golongan 1 - 4 & Bangunan) vs Komersial
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.Assets.showAddAssetModal()">
              <span>➕</span> Tambah Aktiva Tetap
            </button>
            <button class="btn btn-outline" onclick="Modules.Assets.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('DAFTAR PERINCIAN AKTIVA TETAP & PENYUSUTAN FISKAL', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- STAT CARDS -->
        <div class="grid-cards">
          <div class="stat-card accent-navy">
            <div class="stat-title">Total Nilai Perolehan Aktiva</div>
            <div class="stat-value">${App.formatIDR(summary.totalAcquisitionCost || 0)}</div>
            <div class="stat-sub">${summary.totalAssets || 0} Unit Aset Tetap Terdaftar</div>
          </div>
          <div class="stat-card accent-gold">
            <div class="stat-title">Penyusutan Komersial Tahunan</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(summary.totalCommercialAnnualDeprec || 0)}</div>
            <div class="stat-sub">Metode Garis Lurus Komersial</div>
          </div>
          <div class="stat-card accent-green">
            <div class="stat-title">Penyusutan Fiskal Tahunan</div>
            <div class="stat-value" style="color: #059669;">${App.formatIDR(summary.totalFiscalAnnualDeprec || 0)}</div>
            <div class="stat-sub">Sesuai Ketentuan Pajak UU HPP</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Selisih Penyusutan (Koreksi Fiskal)</div>
            <div class="stat-value" style="color: ${summary.totalFiscalCorrection >= 0 ? '#DC2626' : '#059669'};">
              ${App.formatIDR(summary.totalFiscalCorrection || 0)}
            </div>
            <div class="stat-sub">${summary.totalFiscalCorrection >= 0 ? 'Koreksi Positif (PSAK 46 DTA)' : 'Koreksi Negatif'}</div>
          </div>
        </div>

        <!-- ASSETS TABLE -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Perincian Kelompok Aktiva Tetap & Jadwal Penyusutan</div>
          </div>

          <div style="overflow-x: auto;">
            <table class="coretax-table" id="assets-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Kode Aset</th>
                  <th>Nama Aktiva Tetap</th>
                  <th>Kelompok Fiskal UU PPh</th>
                  <th style="width: 90px;">Tgl Perolehan</th>
                  <th class="text-right" style="width: 130px;">Harga Perolehan</th>
                  <th class="text-center" style="width: 70px;">Manfaat Komersial</th>
                  <th class="text-right" style="width: 120px;">Peny. Komersial / Thn</th>
                  <th class="text-center" style="width: 70px;">Tarif Fiskal</th>
                  <th class="text-right" style="width: 120px;">Peny. Fiskal / Thn</th>
                  <th class="text-right" style="width: 120px;">Selisih Fiskal</th>
                </tr>
              </thead>
              <tbody>
                ${(this.data.assets || []).map(a => `
                  <tr>
                    <td><strong>${a.code}</strong></td>
                    <td>
                      <strong>${a.name}</strong>
                      <div style="font-size: 11px; color: #64748B;">Kategori: ${a.category}</div>
                    </td>
                    <td>
                      <span class="badge badge-info">${a.fiscal_group}</span>
                      <div style="font-size: 11px; color: #475569;">${a.fiscal_group_name}</div>
                    </td>
                    <td>${a.acquisition_date}</td>
                    <td class="text-right font-weight-bold">${App.formatIDR(a.acquisition_cost)}</td>
                    <td class="text-center">${a.commercial_useful_life_years} Thn</td>
                    <td class="text-right">${App.formatIDR(a.commercial_annual_deprec)}</td>
                    <td class="text-center font-weight-bold">${a.fiscal_rate_pct}%</td>
                    <td class="text-right" style="color: #059669;">${App.formatIDR(a.fiscal_annual_deprec)}</td>
                    <td class="text-right font-weight-bold" style="color: ${a.fiscal_difference >= 0 ? '#B45309' : '#059669'};">
                      ${App.formatIDR(a.fiscal_difference)}
                      <div style="font-size: 10px;">${a.fiscal_correction_type}</div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat aktiva tetap: ${err.message}</div>`;
    }
  },

  showAddAssetModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const accAsset = this.accounts.filter(a => a.category === 'ASET_TETAP' && a.normal_balance === 'DEBIT').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const accAccum = this.accounts.filter(a => a.category === 'ASET_TETAP' && a.normal_balance === 'KREDIT').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const accExp = this.accounts.filter(a => a.category === 'BEBAN_OPERASIONAL').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-add-asset">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode Aktiva *</label>
            <input type="text" id="new-fa-code" class="form-control" placeholder="Contoh: AST-VEH-02" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Aktiva Tetap *</label>
            <input type="text" id="new-fa-name" class="form-control" placeholder="Contoh: Truk Mitsubishi Canter Logistik" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <input type="text" id="new-fa-cat" class="form-control" value="Kendaraan">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Perolehan *</label>
            <input type="date" id="new-fa-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Perolehan (Rp) *</label>
            <input type="number" id="new-fa-cost" class="form-control" value="0" required>
          </div>
        </div>

        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-top: 6px;">
          <div style="font-weight: 700; color: #002B49; margin-bottom: 8px;">Kelompok Fiskal UU Pajak Penghasilan (UU PPh)</div>
          <div class="form-group">
            <label class="form-label">Golongan Fiskal Perpajakan *</label>
            <select id="new-fa-fiscalgroup" class="form-control" onchange="Modules.Assets.updateFiscalGroupHint()">
              <option value="GOL1">Golongan 1 (Bukan Bangunan - Masa Manfaat 4 Tahun, Tarif 25%)</option>
              <option value="GOL2" selected>Golongan 2 (Bukan Bangunan - Masa Manfaat 8 Tahun, Tarif 12.5%)</option>
              <option value="GOL3">Golongan 3 (Bukan Bangunan - Masa Manfaat 16 Tahun, Tarif 6.25%)</option>
              <option value="GOL4">Golongan 4 (Bukan Bangunan - Masa Manfaat 20 Tahun, Tarif 5%)</option>
              <option value="BANGUNAN_PERMANEN">Bangunan Permanen (Masa Manfaat 20 Tahun, Tarif 5%)</option>
              <option value="BANGUNAN_SEMI">Bangunan Tidak Permanen (Masa Manfaat 10 Tahun, Tarif 10%)</option>
              <option value="NON_DEPRECIABLE">Tanah / Tidak Disusutkan</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Masa Manfaat Komersial (Tahun) *</label>
            <input type="number" id="new-fa-commlife" class="form-control" value="8" required>
          </div>
        </div>

        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-top: 10px;">
          <div style="font-weight: 700; color: #002B49; margin-bottom: 8px;">Pemetaan Akun Akuntansi</div>
          <div class="form-group">
            <label class="form-label">Akun Aset Tetap:</label>
            <select id="new-fa-acc-asset" class="form-control">${accAsset}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Akun Akumulasi Penyusutan (Kontra Aset):</label>
            <select id="new-fa-acc-accum" class="form-control">${accAccum}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Akun Beban Penyusutan (Laba Rugi):</label>
            <select id="new-fa-acc-exp" class="form-control">${accExp}</select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Assets.saveNewAsset()">Simpan Aktiva Tetap</button>
    `;

    App.showModal('Tambah Aktiva Tetap & Kelompok Fiskal', body, footer);
  },

  updateFiscalGroupHint: function() {
    const grp = document.getElementById('new-fa-fiscalgroup')?.value;
    const commInput = document.getElementById('new-fa-commlife');
    if (!commInput) return;

    if (grp === 'GOL1') commInput.value = 4;
    else if (grp === 'GOL2') commInput.value = 8;
    else if (grp === 'GOL3') commInput.value = 16;
    else if (grp === 'GOL4' || grp === 'BANGUNAN_PERMANEN') commInput.value = 20;
    else if (grp === 'BANGUNAN_SEMI') commInput.value = 10;
  },

  saveNewAsset: async function() {
    const code = document.getElementById('new-fa-code')?.value.trim();
    const name = document.getElementById('new-fa-name')?.value.trim();
    const cat = document.getElementById('new-fa-cat')?.value.trim();
    const date = document.getElementById('new-fa-date')?.value;
    const cost = parseFloat(document.getElementById('new-fa-cost')?.value) || 0;
    const fiscalGroup = document.getElementById('new-fa-fiscalgroup')?.value;
    const commLife = parseFloat(document.getElementById('new-fa-commlife')?.value) || 4;
    const accAsset = document.getElementById('new-fa-acc-asset')?.value;
    const accAccum = document.getElementById('new-fa-acc-accum')?.value;
    const accExp = document.getElementById('new-fa-acc-exp')?.value;

    if (!code || !name || cost <= 0) {
      alert('Kode, Nama, dan Harga perolehan wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          code, name, category: cat, acquisition_date: date, acquisition_cost: cost,
          fiscal_group: fiscalGroup, commercial_useful_life_years: commLife,
          asset_account_id: accAsset, accum_deprec_account_id: accAccum, deprec_expense_account_id: accExp
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Aktiva tetap berhasil didaftarkan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    if (!this.data || !this.data.assets) return;

    const headers = [
      { key: 'code', label: 'Kode Aset' },
      { key: 'name', label: 'Nama Aktiva Tetap' },
      { key: 'category', label: 'Kategori' },
      { key: 'fiscal_group', label: 'Kelompok Fiskal' },
      { key: 'acquisition_date', label: 'Tgl Perolehan' },
      { key: 'acquisition_cost', label: 'Harga Perolehan', type: 'number' },
      { key: 'commercial_useful_life_years', label: 'Masa Manfaat Komersial (Thn)', type: 'number' },
      { key: 'commercial_annual_deprec', label: 'Peny. Komersial / Thn', type: 'number' },
      { key: 'fiscal_rate_pct', label: 'Tarif Fiskal (%)', type: 'number' },
      { key: 'fiscal_annual_deprec', label: 'Peny. Fiskal / Thn', type: 'number' },
      { key: 'fiscal_difference', label: 'Selisih Penyusutan (Koreksi)', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Daftar_Aktiva_Tetap_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Aktiva Tetap',
      'DAFTAR PERINCIAN AKTIVA TETAP & PENYUSUTAN FISKAL',
      App.activeEntity,
      headers,
      this.data.assets
    );
  }
};
