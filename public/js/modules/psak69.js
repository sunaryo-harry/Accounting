/**
 * PSAK 69 (Agrikultur) & Modul Pelaporan KJPP
 * Sesuai Standar Akuntansi Keuangan PSAK 69 / IAS 41 & Standar Penilaian Indonesia (SPI 2024)
 * Credit by Harry Sunaryo
 */

Modules.Psak69 = {
  assets: [],
  appraisals: [],
  reconciliation: null,
  accounts: [],
  activeTab: 'assets', // 'assets', 'appraisals', 'reconciliation', 'dcf', 'disclosure'

  getAssets: function() {
    return Array.isArray(this.assets) ? this.assets : [];
  },
  getAppraisals: function() {
    return Array.isArray(this.appraisals) ? this.appraisals : [];
  },

  render: async function(container) {
    container.innerHTML = `<div style="padding: 24px; text-align: center;"><div class="loading-spinner"></div> Memuat Modul Penilaian KJPP & PSAK 69...</div>`;

    try {
      const entityId = App.activeEntity?.id;
      if (!entityId) {
        throw new Error('Entitas perusahaan belum aktif. Silakan pilih entitas di bilah atas aplikasi.');
      }

      const fetchApi = async (url) => {
        if (typeof App.fetchJson === 'function') {
          return await App.fetchJson(url);
        }
        const res = await fetch(url);
        if (!res.ok) {
          const errObj = await res.json().catch(() => ({}));
          throw new Error(errObj.error || `HTTP ${res.status}: Gagal memanggil ${url}`);
        }
        return await res.json();
      };

      const [assetsData, appraisalsData, recData, accData] = await Promise.all([
        fetchApi(`/api/psak69/assets?entity_id=${entityId}`),
        fetchApi(`/api/psak69/appraisals?entity_id=${entityId}`),
        fetchApi(`/api/psak69/reconciliation?entity_id=${entityId}&fiscal_year=2026`),
        fetchApi(`/api/accounts?entity_id=${entityId}`)
      ]);

      this.assets = Array.isArray(assetsData?.assets) ? assetsData.assets : [];
      this.appraisals = Array.isArray(appraisalsData) ? appraisalsData : [];
      this.reconciliation = recData || null;
      this.accounts = Array.isArray(accData) ? accData : [];

      const summary = assetsData?.summary || {
        totalCost: 0,
        totalFairValue: 0,
        totalAdjustment: 0,
        matureCount: 0,
        immatureCount: 0,
        totalHectares: 0,
        totalLivestock: 0
      };

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>🌿</span> Penilaian KJPP & Aset Biologis (PSAK 69)
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Standar Penilaian Indonesia (SPI 2024) | Standar Akuntansi PSAK 69 (IAS 41 Agrikultur) | Kantor Jasa Penilai Publik (KJPP)
            </div>
          </div>
          <div class="page-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-gold" onclick="Modules.Psak69.showAddAppraisalModal()">
              <span>📋</span> Input Laporan KJPP Baru
            </button>
            <button class="btn btn-primary" onclick="Modules.Psak69.showAddAssetModal()">
              <span>➕</span> Tambah Aset Biologis
            </button>
            <button class="btn btn-outline" onclick="Modules.Psak69.switchTab('dcf')">
              <span>🧮</span> Simulator Model DCF
            </button>
            <button class="btn btn-outline" onclick="Modules.Psak69.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('LAPORAN ASET BIOLOGIS & PENILAIAN KJPP (PSAK 69)', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- STAT CARDS -->
        <div class="grid-cards" style="margin-bottom: 20px;">
          <div class="stat-card accent-gold">
            <div class="stat-title">Nilai Wajar Bersih Aset Biologis (FVLCTS)</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(summary.totalFairValue)}</div>
            <div class="stat-sub">Sesuai Nilai Pasar Penilai Independen KJPP</div>
          </div>
          <div class="stat-card accent-navy">
            <div class="stat-title">Akumulasi Penyesuaian Nilai Wajar</div>
            <div class="stat-value" style="color: ${summary.totalAdjustment >= 0 ? '#059669' : '#DC2626'};">
              ${summary.totalAdjustment >= 0 ? '+' : ''}${App.formatIDR(summary.totalAdjustment)}
            </div>
            <div class="stat-sub">Keuntungan / (Kerugian) Nilai Wajar di Laba Rugi</div>
          </div>
          <div class="stat-card accent-blue">
            <div class="stat-title">Luas Lahan & Populasi Biologis</div>
            <div class="stat-value" style="color: #0284C7;">
              ${summary.totalHectares} Ha / ${summary.totalLivestock} Ekor
            </div>
            <div class="stat-sub">${summary.matureCount} Mature (TM) | ${summary.immatureCount} Immature (TBM)</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Laporan Penilai Independen (KJPP)</div>
            <div class="stat-value" style="color: #002B49;">
              ${this.getAppraisals().length} Laporan
            </div>
            <div class="stat-sub">Model Pendapatan DCF & SPI 2024 Terverifikasi</div>
          </div>
        </div>

        <!-- TAB NAVIGATION -->
        <div style="display: flex; gap: 4px; border-bottom: 2px solid #CBD5E1; margin-bottom: 16px; flex-wrap: wrap;">
          <button id="tab-psak69-assets" class="btn ${this.activeTab === 'assets' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Psak69.switchTab('assets')">
            🌿 Master Aset Biologis & Valuasi (${this.getAssets().length})
          </button>
          <button id="tab-psak69-appraisals" class="btn ${this.activeTab === 'appraisals' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Psak69.switchTab('appraisals')">
            📋 Kertas Kerja & Laporan KJPP (${this.getAppraisals().length})
          </button>
          <button id="tab-psak69-reconciliation" class="btn ${this.activeTab === 'reconciliation' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Psak69.switchTab('reconciliation')">
            📈 Rekonsiliasi Paragraf 50 PSAK 69
          </button>
          <button id="tab-psak69-dcf" class="btn ${this.activeTab === 'dcf' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Psak69.switchTab('dcf')">
            🧮 Model Penilaian DCF & Sensitivitas WACC
          </button>
          <button id="tab-psak69-disclosure" class="btn ${this.activeTab === 'disclosure' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Psak69.switchTab('disclosure')">
            📑 Pengungkapan CALK & Paket Auditor
          </button>
        </div>

        <!-- TAB CONTENT VIEW -->
        <div id="psak69-tab-content">
          ${this.renderTabContent()}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="stat-card accent-red" style="padding: 20px; text-align: left; margin: 16px 0;">
          <h3 style="color: #DC2626; margin-top: 0; font-size: 16px;">⚠️ Gagal Memuat Modul Penilaian KJPP & PSAK 69</h3>
          <p style="margin-bottom: 12px; font-size: 13px;"><strong>Detail Kendala:</strong> ${err.message}</p>
          <div style="background: #FFF5F5; border: 1px solid #FED7D7; padding: 12px; border-radius: 6px; font-size: 12px; color: #742A2A; line-height: 1.5;">
            Pastikan server backend di <code>start-server.bat</code> telah di-restart untuk memuat rute API <code>/api/psak69</code>.
          </div>
          <div style="margin-top: 14px;">
            <button class="btn btn-primary" onclick="Modules.Psak69.render(document.getElementById('main-content-view'))">
              🔄 Muat Ulang Modul
            </button>
          </div>
        </div>
      `;
    }
  },

  switchTab: function(tabName) {
    this.activeTab = tabName;
    ['assets', 'appraisals', 'reconciliation', 'dcf', 'disclosure'].forEach(t => {
      const btn = document.getElementById(`tab-psak69-${t}`);
      if (btn) {
        btn.className = (t === tabName) ? 'btn btn-primary' : 'btn btn-outline';
      }
    });
    const content = document.getElementById('psak69-tab-content');
    if (content) content.innerHTML = this.renderTabContent();
  },

  renderTabContent: function() {
    switch (this.activeTab) {
      case 'appraisals':
        return this.renderAppraisalsTab();
      case 'reconciliation':
        return this.renderReconciliationTab();
      case 'dcf':
        return this.renderDcfTab();
      case 'disclosure':
        return this.renderDisclosureTab();
      default:
        return this.renderAssetsTab();
    }
  },

  // =============================================================
  // TAB 1: MASTER ASET BIOLOGIS & VALUASI
  // =============================================================

  renderAssetsTab: function() {
    const assetList = this.getAssets();

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>🌿</span> Daftar Master Aset Biologis & Nilai Wajar Bersih Terkini</div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="bio-search" class="form-control" placeholder="Cari kode, nama, komoditas..." style="width: 260px;" oninput="Modules.Psak69.filterAssets()">
            <button class="btn btn-sm btn-primary" onclick="Modules.Psak69.showAddAssetModal()">
              <span>➕</span> Tambah Aset Biologis
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table" id="bio-assets-table">
            <thead>
              <tr>
                <th style="width: 110px;">Kode Aset</th>
                <th>Nama Aset Biologis</th>
                <th style="width: 140px;">Kategori / Komoditas</th>
                <th class="text-center" style="width: 100px;">Tahap (Stage)</th>
                <th class="text-center" style="width: 100px;">Kuantitas</th>
                <th style="width: 140px;">Lokasi Blok Lahan</th>
                <th class="text-right" style="width: 140px;">Biaya Historis (Cost)</th>
                <th class="text-right" style="width: 150px;">Nilai Wajar Bersih (FVLCTS)</th>
                <th class="text-right" style="width: 150px;">Akumulasi Penyesuaian</th>
                <th class="text-center" style="width: 90px;">Aksi</th>
              </tr>
            </thead>
            <tbody id="bio-assets-tbody">
              ${this.renderAssetRows(assetList)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAssetRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada data aset biologis terdaftar.</td></tr>`;
    }

    return list.map(ast => {
      const isMature = ast.maturity_stage === 'MATURE';
      const adj = Number(ast.accumulated_fair_value_adjustment) || 0;
      const isGain = adj >= 0;

      return `
        <tr>
          <td><strong style="color: #002B49;">${ast.code}</strong></td>
          <td>
            <strong>${ast.name}</strong>
            <div style="font-size: 11px; color: #64748B;">Tahun Tanam: ${ast.planted_year || '-'} | Akun: ${ast.account_code ? `[${ast.account_code}] ${ast.account_name}` : '-'}</div>
          </td>
          <td>
            <span class="badge badge-neutral">${ast.category}</span>
            <div style="font-size: 11px; color: #0284C7; font-weight: 600; margin-top: 2px;">${ast.sub_category || '-'}</div>
          </td>
          <td class="text-center">
            <span class="badge ${isMature ? 'badge-success' : 'badge-warning'}" style="font-size: 11px;">
              ${isMature ? 'Mature (TM)' : 'Immature (TBM)'}
            </span>
          </td>
          <td class="text-center font-weight-bold">
            ${ast.quantity} ${ast.unit}
          </td>
          <td><span style="font-size: 12px; color: #475569;">${ast.location || '-'}</span></td>
          <td class="text-right">${App.formatIDR(ast.cost_balance)}</td>
          <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(ast.fair_value_balance)}</td>
          <td class="text-right font-weight-bold" style="color: ${isGain ? '#059669' : '#DC2626'};">
            ${isGain ? '+' : ''}${App.formatIDR(adj)}
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline" onclick="Modules.Psak69.showAddAssetModal('${ast.id}')" title="Edit Aset">
              ✏️
            </button>
            <button class="btn btn-sm btn-outline" style="color: #DC2626;" onclick="Modules.Psak69.deleteAsset('${ast.id}')" title="Hapus Aset">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterAssets: function() {
    const q = document.getElementById('bio-search')?.value.toLowerCase() || '';
    const filtered = this.getAssets().filter(a => 
      a.code.toLowerCase().includes(q) || 
      a.name.toLowerCase().includes(q) || 
      a.category.toLowerCase().includes(q) || 
      (a.sub_category && a.sub_category.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q))
    );
    const tbody = document.getElementById('bio-assets-tbody');
    if (tbody) tbody.innerHTML = this.renderAssetRows(filtered);
  },

  // =============================================================
  // TAB 2: LAPORAN & KERTAS KERJA PENILAIAN KJPP
  // =============================================================

  renderAppraisalsTab: function() {
    const list = this.getAppraisals();

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div>
            <div class="table-title"><span>📋</span> Riwayat Laporan Penilaian Independen KJPP (Standar SPI 2024)</div>
            <div style="font-size: 11.5px; color: #64748B;">Laporan Penilaian Nilai Wajar oleh Kantor Jasa Penilai Publik untuk Kepentingan Audit Laporan Keuangan</div>
          </div>
          <button class="btn btn-sm btn-gold" onclick="Modules.Psak69.showAddAppraisalModal()">
            <span>➕</span> Input Laporan KJPP Baru
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 95px;">Tgl Cut-Off</th>
                <th style="width: 170px;">No. Laporan Penilaian</th>
                <th>Kantor Jasa Penilai Publik (KJPP) & Penilai</th>
                <th class="text-center" style="width: 110px;">Metode</th>
                <th class="text-center" style="width: 100px;">WACC / CTS</th>
                <th class="text-right" style="width: 130px;">Nilai Bruto</th>
                <th class="text-right" style="width: 140px;">Nilai Bersih (FVLCTS)</th>
                <th class="text-right" style="width: 130px;">Penyesuaian</th>
                <th class="text-center" style="width: 90px;">Dokumen</th>
                <th class="text-center" style="width: 120px;">Status Jurnal</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderAppraisalRows(list)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAppraisalRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada laporan penilaian KJPP yang tercatat.</td></tr>`;
    }

    return list.map(app => {
      const isPosted = app.status === 'POSTED';
      const adj = Number(app.total_fair_value_adjustment) || 0;
      const isGain = adj >= 0;

      return `
        <tr>
          <td><strong>${app.valuation_date}</strong></td>
          <td>
            <strong style="color: #002B49;">${app.report_number}</strong>
            <div style="font-size: 11px; color: #64748B;">${app.valuation_standard || 'SPI 2024'}</div>
          </td>
          <td>
            <strong>${app.kjpp_name}</strong>
            <div style="font-size: 11px; color: #64748B;">Izin: ${app.kjpp_license_no || '-'} | Penilai: ${app.lead_valuer_name || '-'}</div>
          </td>
          <td class="text-center">
            <span class="badge badge-neutral" style="font-size: 11px;">
              ${app.valuation_method === 'INCOME_DCF' ? 'Income (DCF)' : app.valuation_method}
            </span>
          </td>
          <td class="text-center">
            <span style="font-size: 11.5px; font-weight: 600;">WACC: ${app.discount_rate_wacc}%</span><br>
            <span style="font-size: 10.5px; color: #64748B;">CTS: ${app.costs_to_sell_rate}%</span>
          </td>
          <td class="text-right">${App.formatIDR(app.total_gross_fair_value)}</td>
          <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(app.total_net_fair_value)}</td>
          <td class="text-right font-weight-bold" style="color: ${isGain ? '#059669' : '#DC2626'};">
            ${isGain ? '+' : ''}${App.formatIDR(adj)}
          </td>
          <td class="text-center">
            ${app.attachment_path ? `
              <a href="${app.attachment_path}" target="_blank" class="btn btn-sm btn-outline" style="color: #0284C7; font-size: 11px; padding: 2px 6px;" title="${app.attachment_name || 'Buka Laporan PDF'}">
                📄 PDF
              </a>
            ` : '<span style="color:#CBD5E1;">-</span>'}
          </td>
          <td class="text-center">
            ${isPosted ? `
              <span class="badge badge-success" style="font-size: 11px;">
                ✅ Terposting
              </span>
            ` : `
              <button class="btn btn-sm btn-gold" onclick="Modules.Psak69.postAppraisalJournal('${app.id}')" title="Posting Jurnal Penyesuaian ke Buku Besar">
                📤 Post Jurnal
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  },

  postAppraisalJournal: async function(appraisalId) {
    if (!confirm('Posting entri jurnal penyesuaian nilai wajar PSAK 69 ke Buku Besar Umum?')) return;

    try {
      const res = await fetch(`/api/psak69/appraisals/${appraisalId}/post-journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: App.activeEntity.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(`Jurnal PSAK 69 berhasil diposting (${result.journal_number})`, 'success');
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // =============================================================
  // TAB 3: REKONSILIASI PERUBAHAN NILAI TERCATAT (PARAGRAF 50 PSAK 69)
  // =============================================================

  renderReconciliationTab: function() {
    const rec = this.reconciliation;
    const rows = rec?.rows || [];
    const totals = rec?.totals || {};

    const tableRowsHtml = rows.map(r => `
      <tr>
        <td>
          <strong>${r.name}</strong>
          <div style="font-size: 11px; color: #64748B;">[${r.code}] ${r.maturity_stage === 'MATURE' ? 'TM (Mature)' : 'TBM (Immature)'} - ${r.quantity} ${r.unit}</div>
        </td>
        <td class="text-right">${App.formatIDR(r.initial_balance)}</td>
        <td class="text-right">${r.addition_purchase > 0 ? App.formatIDR(r.addition_purchase) : '-'}</td>
        <td class="text-right">${r.development_cost > 0 ? App.formatIDR(r.development_cost) : '-'}</td>
        <td class="text-right font-weight-bold" style="color: ${r.net_physical_change >= 0 ? '#059669' : '#DC2626'};">
          ${r.net_physical_change !== 0 ? (r.net_physical_change >= 0 ? '+' : '') + App.formatIDR(r.net_physical_change) : '-'}
        </td>
        <td class="text-right font-weight-bold" style="color: ${r.net_price_change >= 0 ? '#0284C7' : '#DC2626'};">
          ${r.net_price_change !== 0 ? (r.net_price_change >= 0 ? '+' : '') + App.formatIDR(r.net_price_change) : '-'}
        </td>
        <td class="text-right font-weight-bold" style="color: #002B49;">
          ${r.net_fair_value_adjustment !== 0 ? (r.net_fair_value_adjustment >= 0 ? '+' : '') + App.formatIDR(r.net_fair_value_adjustment) : '-'}
        </td>
        <td class="text-right" style="color: #DC2626;">${r.harvest_decrease > 0 ? `(${App.formatIDR(r.harvest_decrease)})` : '-'}</td>
        <td class="text-right font-weight-bold" style="color: #B45309; background: #FEF3C7;">${App.formatIDR(r.ending_balance)}</td>
      </tr>
    `).join('');

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div>
            <div class="table-title"><span>📈</span> Laporan Rekonsiliasi Perubahan Nilai Tercatat Aset Biologis (PSAK 69 Paragraf 50)</div>
            <div style="font-size: 11.5px; color: #64748B;">Pemisahan Wajib Keuntungan/(Kerugian) Nilai Wajar akibat Perubahan Fisik dan Perubahan Harga (Paragraf 51)</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-outline" onclick="Modules.Psak69.exportReconciliationExcel()">
              <span>📊</span> Export Excel Paragraf 50
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th rowspan="2" style="vertical-align: middle;">Kelompok Aset Biologis</th>
                <th rowspan="2" class="text-right" style="width: 130px; vertical-align: middle;">Saldo Awal (1 Jan)</th>
                <th colspan="2" class="text-center" style="background: #F1F5F9;">Penambahan Biaya</th>
                <th colspan="3" class="text-center" style="background: #E0F2FE; color: #0369A1;">Perubahan Nilai Wajar (FVLCTS)</th>
                <th rowspan="2" class="text-right" style="width: 120px; vertical-align: middle;">Pengurangan Panen</th>
                <th rowspan="2" class="text-right" style="width: 145px; vertical-align: middle; background: #FDE68A; color: #78350F;">Saldo Akhir (31 Des)</th>
              </tr>
              <tr>
                <th class="text-right" style="width: 115px;">Pembelian / Bibit</th>
                <th class="text-right" style="width: 115px;">Pengembangan</th>
                <th class="text-right" style="width: 120px; color: #059669;">Perubahan Fisik</th>
                <th class="text-right" style="width: 120px; color: #0284C7;">Perubahan Harga</th>
                <th class="text-right" style="width: 125px; font-weight:700;">Total Keuntungan/(Kerugian)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml || `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada pergerakan nilai tercatat.</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background: #002B49; color: #FFFFFF; font-weight: 700;">
                <td>TOTAL KONSOLIDASI ENTITAS</td>
                <td class="text-right">${App.formatIDR(totals.initial_balance || 0)}</td>
                <td class="text-right">${App.formatIDR(totals.addition_purchase || 0)}</td>
                <td class="text-right">${App.formatIDR(totals.development_cost || 0)}</td>
                <td class="text-right" style="color: #34D399;">${App.formatIDR(totals.net_physical_change || 0)}</td>
                <td class="text-right" style="color: #38BDF8;">${App.formatIDR(totals.net_price_change || 0)}</td>
                <td class="text-right" style="color: #FBBF24;">${App.formatIDR(totals.net_fair_value_adjustment || 0)}</td>
                <td class="text-right" style="color: #F87171;">(${App.formatIDR(totals.harvest_decrease || 0)})</td>
                <td class="text-right" style="color: #F59E0B; font-size: 13.5px;">${App.formatIDR(totals.ending_balance || 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  // =============================================================
  // TAB 4: SIMULATOR MODEL PENILAIAN DCF & SENSITIVITAS
  // =============================================================

  renderDcfTab: function() {
    return `
      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 16px;">
        <!-- PARAMETER INPUT PANEL -->
        <div class="card-table-wrapper" style="padding: 16px;">
          <h3 style="color: #002B49; font-size: 15px; margin-top: 0; margin-bottom: 12px;">
            🧮 Parameter Model DCF KJPP
          </h3>
          <form id="form-dcf-sim" onsubmit="event.preventDefault(); Modules.Psak69.calculateDcf();">
            <div class="form-group">
              <label class="form-label">Luas Lahan Terkelola (Hektar)</label>
              <input type="number" id="sim-ha" class="form-control" value="450" min="1" step="any" required>
            </div>
            <div class="form-group">
              <label class="form-label">Sisa Umur Ekonomis (Tahun)</label>
              <input type="number" id="sim-years" class="form-control" value="18" min="1" max="30" required>
            </div>
            <div class="form-group">
              <label class="form-label">Proyeksi Yield (Ton TBS/Ha/Thn)</label>
              <input type="number" id="sim-yield" class="form-control" value="24" step="any" required>
            </div>
            <div class="form-group">
              <label class="form-label">Proyeksi Harga Komoditas (Rp/Ton)</label>
              <input type="number" id="sim-price" class="form-control" value="2650000" step="any" required>
            </div>
            <div class="form-group">
              <label class="form-label">Biaya Pemeliharaan (Rp/Ha/Thn)</label>
              <input type="number" id="sim-upkeep" class="form-control" value="16500000" step="any" required>
            </div>
            <div class="form-group">
              <label class="form-label">Biaya Panen & Angkut (Rp/Ton)</label>
              <input type="number" id="sim-harvest" class="form-control" value="280000" step="any" required>
            </div>
            <div class="form-group">
              <label class="form-label">Tingkat Diskonto (WACC %)</label>
              <input type="number" id="sim-wacc" class="form-control" value="11.5" step="0.1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Estimasi Biaya Menjual (CTS %)</label>
              <input type="number" id="sim-cts" class="form-control" value="2.5" step="0.1" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              <span>⚡</span> Hitung Model DCF
            </button>
          </form>
        </div>

        <!-- RESULTS & SENSITIVITY VIEW -->
        <div id="dcf-results-container">
          <div style="padding: 40px; text-align: center; color: #64748B;">
            Klik tombol <strong>Hitung Model DCF</strong> untuk menjalankan simulasi diskonto arus kas dan matriks sensitivitas penilai publik.
          </div>
        </div>
      </div>
    `;
  },

  calculateDcf: async function() {
    const container = document.getElementById('dcf-results-container');
    if (!container) return;

    container.innerHTML = `<div style="padding: 40px; text-align: center;"><div class="loading-spinner"></div> Menghitung Proyeksi DCF & Sensitivitas WACC...</div>`;

    const ha = document.getElementById('sim-ha')?.value || 450;
    const years = document.getElementById('sim-years')?.value || 18;
    const yieldTon = document.getElementById('sim-yield')?.value || 24;
    const priceTon = document.getElementById('sim-price')?.value || 2650000;
    const upkeep = document.getElementById('sim-upkeep')?.value || 16500000;
    const harvest = document.getElementById('sim-harvest')?.value || 280000;
    const wacc = document.getElementById('sim-wacc')?.value || 11.5;
    const cts = document.getElementById('sim-cts')?.value || 2.5;

    try {
      const res = await fetch(`/api/psak69/dcf-calculator?hectares=${ha}&mature_years=${years}&projected_yield_ton_per_ha=${yieldTon}&commodity_price_per_ton=${priceTon}&upkeep_cost_per_ha=${upkeep}&harvest_cost_per_ton=${harvest}&wacc_rate=${wacc}&costs_to_sell_percent=${cts}`);
      const data = await res.json();

      const r = data.results;
      const matrix = data.sensitivity_matrix || [];

      let matrixHtml = matrix.map(m => `
        <tr>
          <td class="font-weight-bold" style="background: #F8FAFC;">WACC ${m.wacc}%</td>
          <td class="text-right">${App.formatIDR(m['price_-10%'])} <span style="font-size:10px; color:#DC2626;">(${m['diff_percent_-10%']}%)</span></td>
          <td class="text-right">${App.formatIDR(m['price_-5%'])} <span style="font-size:10px; color:#DC2626;">(${m['diff_percent_-5%']}%)</span></td>
          <td class="text-right font-weight-bold" style="background: #FEF3C7; color: #92400E;">${App.formatIDR(m['price_0%'])}</td>
          <td class="text-right">${App.formatIDR(m['price_+5%'])} <span style="font-size:10px; color:#059669;">(+${m['diff_percent_+5%']}%)</span></td>
          <td class="text-right">${App.formatIDR(m['price_+10%'])} <span style="font-size:10px; color:#059669;">(+${m['diff_percent_+10%']}%)</span></td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div class="grid-cards" style="margin-bottom: 16px;">
          <div class="stat-card accent-gold">
            <div class="stat-title">Nilai Wajar Bruto (PV of DCF)</div>
            <div class="stat-value" style="color: #002B49; font-size: 19px;">${App.formatIDR(r.gross_fair_value)}</div>
            <div class="stat-sub">Arus Kas Bersih Didiskonto (WACC ${wacc}%)</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Biaya Menjual (CTS ${cts}%)</div>
            <div class="stat-value" style="color: #DC2626; font-size: 19px;">(${App.formatIDR(r.costs_to_sell)})</div>
            <div class="stat-sub">Biaya Pungut, Angkut & Komisi Penjualan</div>
          </div>
          <div class="stat-card accent-navy">
            <div class="stat-title">Nilai Wajar Bersih (FVLCTS)</div>
            <div class="stat-value" style="color: #059669; font-size: 19px;">${App.formatIDR(r.net_fair_value_fvlcts)}</div>
            <div class="stat-sub">${App.formatIDR(r.net_fair_value_per_ha)} per Hektar</div>
          </div>
        </div>

        <div class="card-table-wrapper" style="margin-bottom: 16px;">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📊</span> Matriks Analisis Sensitivitas Penilai KJPP (WACC vs Harga Komoditas)</div>
          </div>
          <div style="overflow-x: auto;">
            <table class="coretax-table">
              <thead>
                <tr>
                  <th style="width: 120px;">Skenario WACC</th>
                  <th class="text-right" style="width: 140px;">Harga -10%</th>
                  <th class="text-right" style="width: 140px;">Harga -5%</th>
                  <th class="text-right font-weight-bold" style="width: 150px; background: #FDE68A; color: #78350F;">Harga Basis</th>
                  <th class="text-right" style="width: 140px;">Harga +5%</th>
                  <th class="text-right" style="width: 140px;">Harga +10%</th>
                </tr>
              </thead>
              <tbody>
                ${matrixHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal menghitung model DCF: ${err.message}</div>`;
    }
  },

  // =============================================================
  // TAB 5: PENGUNGKAPAN CALK & PAKET AUDITOR
  // =============================================================

  renderDisclosureTab: function() {
    const latest = this.getAppraisals()[0];
    const assetList = this.getAssets();

    const matureFv = assetList.filter(a => a.maturity_stage === 'MATURE').reduce((s, a) => s + Number(a.fair_value_balance || 0), 0);
    const immatureFv = assetList.filter(a => a.maturity_stage === 'IMMATURE').reduce((s, a) => s + Number(a.fair_value_balance || 0), 0);
    const totalFv = matureFv + immatureFv;

    return `
      <div class="card-table-wrapper" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #CBD5E1; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="color: #002B49; margin: 0; font-size: 18px;">
              📑 Catatan Atas Laporan Keuangan (CALK) - Pengungkapan Aset Biologis PSAK 69
            </h2>
            <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
              Dokumen Pengungkapan Standar Auditor Independen (Auditor-Grade Financial Disclosure Package)
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-outline" onclick="Modules.Psak69.copyDisclosureText()">
              <span>📋</span> Salin Teks CALK
            </button>
            <button class="btn btn-sm btn-primary" onclick="CoretaxExport.printReport('PENGUNGKAPAN CALK PSAK 69', App.activeEntity)">
              <span>🖨️</span> Cetak Lembar Pengungkapan
            </button>
          </div>
        </div>

        <div id="calk-disclosure-content" style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 20px; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 13.5px; line-height: 1.7; color: #1E293B;">
          <h3 style="color: #002B49; margin-top: 0; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px;">
            CATATAN XX: ASET BIOLOGIS (PSAK 69 AGRIKULTUR)
          </h3>

          <p><strong>a. Kebijakan Akuntansi</strong><br>
          Aset biologis Perusahaan terdiri dari tanaman perkebunan kelapa sawit dan hewan ternak komersial. Sesuai dengan <strong>PSAK 69 (Agrikultur)</strong>, aset biologis diukur pada pengakuan awal dan pada setiap akhir periode pelaporan pada <strong>Nilai Wajar dikurangi Biaya untuk Menjual (Fair Value less Costs to Sell / FVLCTS)</strong>. Keuntungan atau kerugian yang timbul dari pengakuan awal dan dari perubahan nilai wajar dikurangi biaya untuk menjual aset biologis diakui dalam laporan laba rugi pada periode terjadinya.</p>

          <p><strong>b. Penilaian Penilai Independen (KJPP)</strong><br>
          Nilai wajar aset biologis Perusahaan pada tanggal <strong>${latest?.valuation_date || '30 Juni 2026'}</strong> dinilai oleh penilai independen terdaftar <strong>${latest?.kjpp_name || 'KJPP Rinaldi, Tjahjono & Rekan'}</strong> berdasarkan Surat Izin Usaha Penilai Publik <strong>${latest?.kjpp_license_no || 'KMK No. 128/KM.1/2020'}</strong> sebagaimana tertuang dalam Laporan Penilaian No. <strong>${latest?.report_number || 'KJPP-RTR/VAL-BIO/2026/06-042'}</strong>.</p>

          <p><strong>c. Asumsi Signifikan & Hierarki Nilai Wajar (Level 3 - Unobservable Inputs)</strong><br>
          Pengukuran nilai wajar aset biologis dikategorikan ke dalam <strong>Tingkat 3 (Level 3)</strong> dari hierarki nilai wajar karena didasarkan pada masukan yang tidak dapat diobservasi secara langsung di pasar aktif. Penilai menggunakan <strong>Pendekatan Pendapatan dengan Metode Diskonto Arus Kas (Discounted Cash Flow - DCF)</strong> sesuai Standar Penilaian Indonesia (SPI 2024). Asumsi utama meliputi:
          <ul style="margin: 4px 0 8px 20px; padding: 0;">
            <li><strong>Tingkat Diskonto (Weighted Average Cost of Capital - WACC):</strong> ${latest?.discount_rate_wacc || 11.5}% per tahun.</li>
            <li><strong>Estimasi Biaya untuk Menjual (Costs to Sell):</strong> ${latest?.costs_to_sell_rate || 2.5}% dari Nilai Wajar Bruto.</li>
            <li><strong>Tolok Ukur Harga Jual Komoditas:</strong> ${latest?.commodity_price_benchmark || 'Rata-rata harga lelang CPO KPBN dan penetapan TBS Disbun'}.</li>
          </ul>
          </p>

          <p><strong>d. Ringkasan Saldo Nilai Wajar Aset Biologis</strong></p>
          <table class="coretax-table" style="background: #FFFFFF; margin: 10px 0 16px 0;">
            <thead>
              <tr>
                <th>Klasifikasi Aset Biologis</th>
                <th class="text-center" style="width: 140px;">Tahap (Maturity)</th>
                <th class="text-right" style="width: 200px;">Nilai Wajar Bersih (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tanaman Perkebunan Kelapa Sawit Menghasilkan & Ternak Dewasa</td>
                <td class="text-center"><span class="badge badge-success">Mature (TM)</span></td>
                <td class="text-right font-weight-bold">${App.formatIDR(matureFv)}</td>
              </tr>
              <tr>
                <td>Tanaman Perkebunan Kelapa Sawit Belum Menghasilkan</td>
                <td class="text-center"><span class="badge badge-warning">Immature (TBM)</span></td>
                <td class="text-right font-weight-bold">${App.formatIDR(immatureFv)}</td>
              </tr>
              <tr style="background: #F1F5F9; font-weight: 700;">
                <td colspan="2">TOTAL NILAI TERCATAT ASET BIOLOGIS (PSAK 69)</td>
                <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(totalFv)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  copyDisclosureText: function() {
    const content = document.getElementById('calk-disclosure-content')?.innerText || '';
    navigator.clipboard.writeText(content).then(() => {
      App.toast('Teks pengungkapan CALK berhasil disalin ke clipboard!', 'success');
    });
  },

  // =============================================================
  // MODALS (ADD ASSET, ADD APPRAISAL)
  // =============================================================

  showAddAssetModal: function(assetId = null) {
    const ast = assetId ? this.getAssets().find(a => a.id === assetId) : null;
    const isEdit = !!ast;

    const accOptions = this.accounts.filter(a => a.category === 'ASET_LANCAR' || a.category === 'ASET_TETAP').map(a => `
      <option value="${a.id}" ${ast && ast.asset_account_id === a.id ? 'selected' : ''}>[${a.code}] ${a.name}</option>
    `).join('');

    const body = `
      <form id="form-bio-asset">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode Aset Biologis *</label>
            <input type="text" id="bio-code" class="form-control" placeholder="Contoh: BIO-KS-01" value="${ast?.code || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Aset Biologis / Blok Kebun *</label>
            <input type="text" id="bio-name" class="form-control" placeholder="Contoh: Kebun Kelapa Sawit Blok A" value="${ast?.name || ''}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kategori *</label>
            <select id="bio-cat" class="form-control">
              <option value="PERKEBUNAN" ${ast?.category === 'PERKEBUNAN' ? 'selected' : ''}>Perkebunan (Sawit / Karet / Tebu)</option>
              <option value="KEHUTANAN" ${ast?.category === 'KEHUTANAN' ? 'selected' : ''}>Kehutanan (Kayu Sengon / Jati)</option>
              <option value="PETERNAKAN" ${ast?.category === 'PETERNAKAN' ? 'selected' : ''}>Peternakan (Sapi / Unggas)</option>
              <option value="PERIKANAN" ${ast?.category === 'PERIKANAN' ? 'selected' : ''}>Perikanan (Tambak Udang / Ikan)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sub-Komoditas</label>
            <input type="text" id="bio-sub" class="form-control" placeholder="Contoh: Kelapa Sawit (TBS)" value="${ast?.sub_category || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tahap Kematangan (Maturity) *</label>
            <select id="bio-mat" class="form-control">
              <option value="MATURE" ${ast?.maturity_stage === 'MATURE' ? 'selected' : ''}>Mature (Tanaman Menghasilkan - TM)</option>
              <option value="IMMATURE" ${ast?.maturity_stage === 'IMMATURE' ? 'selected' : ''}>Immature (Tanaman Belum Menghasilkan - TBM)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Satuan Kuantitas</label>
            <input type="text" id="bio-unit" class="form-control" value="${ast?.unit || 'HA'}">
          </div>
          <div class="form-group">
            <label class="form-label">Kuantitas Fisik *</label>
            <input type="number" id="bio-qty" class="form-control" value="${ast?.quantity || 100}" step="any" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tahun Tanam / Perolehan</label>
            <input type="number" id="bio-year" class="form-control" value="${ast?.planted_year || 2020}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Lokasi Lahan / Blok Perkebunan</label>
          <input type="text" id="bio-loc" class="form-control" placeholder="Contoh: Kebun Riau Estate Blok A1-A15" value="${ast?.location || ''}">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Biaya Perolehan Historis (Cost Rp) *</label>
            <input type="number" id="bio-cost" class="form-control" value="${ast?.cost_balance || 0}" step="any" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Nilai Wajar Awal (FVLCTS Rp) *</label>
            <input type="number" id="bio-fv" class="form-control" value="${ast?.fair_value_balance || 0}" step="any" required>
          </div>
        </div>

        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">Akun Pembukuan Neraca (Aset Biologis):</label>
          <select id="bio-acc" class="form-control">${accOptions}</select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Psak69.saveAsset('${assetId || ''}')">
        ${isEdit ? 'Perbarui Aset Biologis' : 'Simpan Aset Biologis'}
      </button>
    `;

    App.showModal(isEdit ? `Edit Aset Biologis: ${ast.name}` : 'Tambah Master Aset Biologis PSAK 69', body, footer);
  },

  saveAsset: async function(assetId) {
    const code = document.getElementById('bio-code')?.value.trim();
    const name = document.getElementById('bio-name')?.value.trim();
    const category = document.getElementById('bio-cat')?.value;
    const sub = document.getElementById('bio-sub')?.value.trim();
    const maturity = document.getElementById('bio-mat')?.value;
    const unit = document.getElementById('bio-unit')?.value.trim();
    const qty = parseFloat(document.getElementById('bio-qty')?.value) || 0;
    const year = parseInt(document.getElementById('bio-year')?.value) || new Date().getFullYear();
    const loc = document.getElementById('bio-loc')?.value.trim();
    const cost = parseFloat(document.getElementById('bio-cost')?.value) || 0;
    const fv = parseFloat(document.getElementById('bio-fv')?.value) || cost;
    const acc = document.getElementById('bio-acc')?.value || null;

    if (!code || !name) {
      alert('Kode dan Nama Aset Biologis wajib diisi!');
      return;
    }

    try {
      const url = assetId ? `/api/psak69/assets/${assetId}` : '/api/psak69/assets';
      const method = assetId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          code, name, category, sub_category: sub, maturity_stage: maturity,
          unit, quantity: qty, planted_year: year, location: loc,
          cost_balance: cost, fair_value_balance: fv, asset_account_id: acc
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Data aset biologis berhasil disimpan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  deleteAsset: async function(assetId) {
    const ast = this.getAssets().find(a => a.id === assetId);
    if (!confirm(`Hapus aset biologis ${ast?.name || ''}? Tindakan ini akan menghapus riwayat penilaian terkait.`)) return;

    try {
      const res = await fetch(`/api/psak69/assets/${assetId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Aset biologis berhasil dihapus', 'success');
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // MODAL INPUT LAPORAN PENILAIAN INDEPENDEN KJPP
  showAddAppraisalModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const assetList = this.getAssets();

    if (assetList.length === 0) {
      alert('Belum ada master aset biologis terdaftar. Silakan tambahkan aset biologis terlebih dahulu.');
      this.showAddAssetModal();
      return;
    }

    let itemsGridHtml = assetList.map((ast, idx) => `
      <tr data-asset-id="${ast.id}">
        <td>
          <strong>${ast.name}</strong>
          <div style="font-size:11px; color:#64748B;">${ast.code} (${ast.quantity} ${ast.unit})</div>
        </td>
        <td class="text-right" style="vertical-align: middle;">
          ${App.formatIDR(ast.fair_value_balance)}
        </td>
        <td>
          <input type="number" class="form-control form-control-sm app-gross-input" data-idx="${idx}" placeholder="Nilai Wajar Bruto (Rp)" value="${ast.fair_value_balance * 1.1}" step="any" oninput="Modules.Psak69.calcModalRow(${idx})" required>
        </td>
        <td class="text-right app-cts-cell" data-idx="${idx}" style="vertical-align: middle;">
          ${App.formatIDR(ast.fair_value_balance * 1.1 * 0.025)}
        </td>
        <td class="text-right font-weight-bold app-net-cell" data-idx="${idx}" style="vertical-align: middle; color: #002B49;">
          ${App.formatIDR(ast.fair_value_balance * 1.1 * 0.975)}
        </td>
      </tr>
    `).join('');

    const body = `
      <form id="form-add-appraisal" enctype="multipart/form-data">
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <strong style="color: #92400E;">📋 Lembar Penilaian Independen KJPP Sesuai SPI 2024 & PSAK 69</strong>
          <div style="font-size: 12px; color: #78350F; margin-top: 2px;">
            Input laporan penilaian nilai wajar yang diterbitkan oleh Kantor Jasa Penilai Publik (KJPP) berlisensi resmi. Sistem akan menghitung estimasi biaya menjual, nilai wajar bersih (FVLCTS), dan opsi posting jurnal akuntansi otomatis.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Cut-Off Penilaian *</label>
            <input type="date" id="app-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Laporan Penilaian KJPP *</label>
            <input type="text" id="app-rep-no" class="form-control" placeholder="Contoh: KJPP-RTR/VAL-BIO/2026/06-042" required>
          </div>
          <div class="form-group">
            <label class="form-label">Metode Penilaian SPI *</label>
            <select id="app-method" class="form-control">
              <option value="INCOME_DCF">Pendekatan Pendapatan (Discounted Cash Flow - DCF)</option>
              <option value="MARKET_APPROACH">Pendekatan Pasar (Market Approach)</option>
              <option value="COST_APPROACH">Pendekatan Biaya (Depreciated Replacement Cost)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nama Lengkap Kantor KJPP *</label>
            <input type="text" id="app-kjpp-name" class="form-control" placeholder="Contoh: KJPP Rinaldi, Tjahjono & Rekan" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Izin Usaha Penilai (KMK)</label>
            <input type="text" id="app-license" class="form-control" placeholder="Contoh: KMK No. 128/KM.1/2020">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Penilai Publik (Lead Valuer / MAPPI)</label>
            <input type="text" id="app-valuer" class="form-control" placeholder="Contoh: Ir. Hendra Gunawan, MAPPI (Cert.)">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 12px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Tingkat Diskonto (WACC %) *</label>
            <input type="number" id="app-wacc" class="form-control" value="11.5" step="0.1" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Biaya untuk Menjual (CTS %) *</label>
            <input type="number" id="app-cts" class="form-control" value="2.5" step="0.1" oninput="Modules.Psak69.recalcAllModalRows()" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Tolok Ukur Harga Komoditas Pasar</label>
            <input type="text" id="app-benchmark" class="form-control" placeholder="Contoh: Rata-rata Tender KPBN">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: #002B49;">Nilai Wajar Hasil Penilaian per Aset Biologis</label>
          <div style="max-height: 250px; overflow-y: auto;">
            <table class="coretax-table" id="modal-app-items-table">
              <thead>
                <tr>
                  <th>Aset Biologis</th>
                  <th class="text-right" style="width: 140px;">Nilai Buku Sebelum</th>
                  <th class="text-right" style="width: 170px;">Nilai Wajar Bruto (Rp)</th>
                  <th class="text-right" style="width: 130px;">Biaya Menjual (CTS)</th>
                  <th class="text-right" style="width: 150px;">Nilai Bersih (FVLCTS)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsGridHtml}
              </tbody>
            </table>
          </div>
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah Berkas PDF Laporan Penilai Independen KJPP Resmi (Maks 30 MB)</label>
          <input type="file" id="app-attachment" class="form-control" accept="application/pdf,image/*">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="app-autojournal" checked>
            <strong>Otomatis Posting Voucher Jurnal Penyesuaian Nilai Wajar PSAK 69 ke Buku Besar</strong>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Psak69.submitAppraisal()">Simpan & Proses Penilaian KJPP</button>
    `;

    App.showModal('Input Laporan Penilaian Independen KJPP (PSAK 69)', body, footer);
  },

  calcModalRow: function(idx) {
    const grossInput = document.querySelector(`.app-gross-input[data-idx="${idx}"]`);
    const ctsCell = document.querySelector(`.app-cts-cell[data-idx="${idx}"]`);
    const netCell = document.querySelector(`.app-net-cell[data-idx="${idx}"]`);
    const ctsRate = parseFloat(document.getElementById('app-cts')?.value) || 2.5;

    const gross = parseFloat(grossInput?.value) || 0;
    const cts = gross * (ctsRate / 100);
    const net = gross - cts;

    if (ctsCell) ctsCell.innerText = App.formatIDR(cts);
    if (netCell) netCell.innerText = App.formatIDR(net);
  },

  recalcAllModalRows: function() {
    const inputs = document.querySelectorAll('.app-gross-input');
    inputs.forEach(inp => {
      const idx = inp.getAttribute('data-idx');
      this.calcModalRow(idx);
    });
  },

  submitAppraisal: async function() {
    const date = document.getElementById('app-date')?.value;
    const repNo = document.getElementById('app-rep-no')?.value.trim();
    const method = document.getElementById('app-method')?.value;
    const kjppName = document.getElementById('app-kjpp-name')?.value.trim();
    const license = document.getElementById('app-license')?.value.trim();
    const valuer = document.getElementById('app-valuer')?.value.trim();
    const wacc = parseFloat(document.getElementById('app-wacc')?.value) || 11.5;
    const ctsRate = parseFloat(document.getElementById('app-cts')?.value) || 2.5;
    const benchmark = document.getElementById('app-benchmark')?.value.trim();
    const autoJournal = document.getElementById('app-autojournal')?.checked;
    const fileInput = document.getElementById('app-attachment');

    if (!date || !repNo || !kjppName) {
      alert('Tanggal Penilaian, Nomor Laporan, dan Nama KJPP wajib diisi!');
      return;
    }

    // Collect assessed items
    const rows = document.querySelectorAll('#modal-app-items-table tbody tr');
    const items = [];

    rows.forEach(tr => {
      const assetId = tr.getAttribute('data-asset-id');
      const gross = parseFloat(tr.querySelector('.app-gross-input')?.value) || 0;
      items.push({
        asset_id: assetId,
        gross_fair_value: gross,
        costs_to_sell: gross * (ctsRate / 100)
      });
    });

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('valuation_date', date);
    formData.append('report_number', repNo);
    formData.append('valuation_method', method);
    formData.append('kjpp_name', kjppName);
    formData.append('kjpp_license_no', license);
    formData.append('lead_valuer_name', valuer);
    formData.append('discount_rate_wacc', wacc);
    formData.append('costs_to_sell_rate', ctsRate);
    formData.append('commodity_price_benchmark', benchmark);
    formData.append('auto_post_journal', autoJournal);
    formData.append('items', JSON.stringify(items));

    if (fileInput && fileInput.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/psak69/appraisals', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Laporan penilaian KJPP berhasil disimpan!', 'success');
      App.closeModal();
      this.activeTab = 'appraisals';
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // =============================================================
  // EXPORT FUNCTIONS
  // =============================================================

  exportExcel: function() {
    const headers = [
      { key: 'code', label: 'Kode Aset' },
      { key: 'name', label: 'Nama Aset Biologis' },
      { key: 'category', label: 'Kategori' },
      { key: 'sub_category', label: 'Sub-Komoditas' },
      { key: 'maturity_stage', label: 'Tahap Maturity', align: 'center' },
      { key: 'quantity', label: 'Kuantitas', type: 'number' },
      { key: 'unit', label: 'Satuan', align: 'center' },
      { key: 'cost_balance', label: 'Biaya Historis (Rp)', type: 'number' },
      { key: 'fair_value_balance', label: 'Nilai Wajar Bersih FVLCTS (Rp)', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Aset_Biologis_PSAK69_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Aset Biologis',
      'DAFTAR NILAI WAJAR ASET BIOLOGIS (PSAK 69 & PENILAIAN KJPP)',
      App.activeEntity,
      headers,
      this.getAssets()
    );
  },

  exportReconciliationExcel: function() {
    const rec = this.reconciliation;
    const rows = rec?.rows || [];

    const headers = [
      { key: 'name', label: 'Kelompok Aset Biologis' },
      { key: 'initial_balance', label: 'Saldo Awal (1 Jan)', type: 'number' },
      { key: 'addition_purchase', label: 'Penambahan / Bibit', type: 'number' },
      { key: 'development_cost', label: 'Biaya Pengembangan', type: 'number' },
      { key: 'net_physical_change', label: 'Perubahan Fisik', type: 'number' },
      { key: 'net_price_change', label: 'Perubahan Harga', type: 'number' },
      { key: 'net_fair_value_adjustment', label: 'Total Keuntungan/(Kerugian)', type: 'number' },
      { key: 'harvest_decrease', label: 'Pengurangan Panen', type: 'number' },
      { key: 'ending_balance', label: 'Saldo Akhir (31 Des)', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Rekonsiliasi_PSAK69_Paragraf50_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Rekonsiliasi PSAK 69',
      'LAPORAN REKONSILIASI PERUBAHAN NILAI TERCATAT ASET BIOLOGIS (PSAK 69 PARAGRAF 50)',
      App.activeEntity,
      headers,
      rows
    );
  }
};
