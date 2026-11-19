/**
 * SPT Tahunan PPh Badan 1771 Module (Formulir 1771 Induk & Lampiran I - VI)
 */

Modules.SPT1771 = {
  currentTab: 'INDUK', // 'INDUK', 'LAMP_I', 'LAMP_II', 'LAMP_III', 'LAMP_IV', 'LAMP_V', 'LAMP_VI'
  data: null,

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Menyusun SPT Tahunan PPh Badan 1771...</div>`;

    try {
      const res = await fetch(`/api/spt1771?entity_id=${App.activeEntity.id}&year=${App.activeEntity.fiscal_year}`);
      this.data = await res.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📑</span> SPT Tahunan PPh Wajib Pajak Badan (Formulir 1771)
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | NPWP: ${App.activeEntity?.npwp} | Tahun Pajak ${this.data.fiscalYear} | Standar Coretax DJP
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="Modules.SPT1771.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('SPT TAHUNAN BADAN FORMULIR 1771', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- SPT 1771 TABS -->
        <div class="coretax-tabs" style="overflow-x: auto; white-space: nowrap;">
          <button class="tab-btn ${this.currentTab === 'INDUK' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('INDUK')">
            Form 1771 Induk
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_I' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_I')">
            Lampiran I (Neto Fiskal)
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_II' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_II')">
            Lampiran II (Perincian HPP & Biaya)
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_III' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_III')">
            Lampiran III (Kredit Pajak DN)
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_IV' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_IV')">
            Lampiran IV (Penghasilan Final)
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_V' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_V')">
            Lampiran V (Pemegang Saham & Pengurus)
          </button>
          <button class="tab-btn ${this.currentTab === 'LAMP_VI' ? 'active' : ''}" onclick="Modules.SPT1771.switchTab('LAMP_VI')">
            Lampiran VI (Afiliasi)
          </button>
        </div>

        <div id="spt-tab-content">
          ${this.renderTabContent()}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat SPT 1771: ${err.message}</div>`;
    }
  },

  switchTab: function(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('main-content-view'));
  },

  renderTabContent: function() {
    switch (this.currentTab) {
      case 'INDUK': return this.renderInduk();
      case 'LAMP_I': return this.renderLampiranI();
      case 'LAMP_II': return this.renderLampiranII();
      case 'LAMP_III': return this.renderLampiranIII();
      case 'LAMP_IV': return this.renderLampiranIV();
      case 'LAMP_V': return this.renderLampiranV();
      case 'LAMP_VI': return this.renderLampiranVI();
      default: return this.renderInduk();
    }
  },

  renderInduk: function() {
    const f = this.data?.form1771Induk || {};
    const ent = this.data?.entity || {};

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar" style="background: #002B49; color: #FFFFFF;">
          <div style="font-size: 15px; font-weight: 800; color: #F59E0B;">
            KEMENTERIAN KEUANGAN RI - DIREKTORAT JENDERAL PAJAK (CORETAX)
          </div>
          <div style="font-weight: 700; font-size: 13px;">FORMULIR 1771 INDUK</div>
        </div>

        <div style="padding: 16px; background: #F8FAFC; border-bottom: 2px solid #CBD5E1;">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; font-size: 12.5px;">
            <div><strong>Nama Wajib Pajak:</strong> ${ent.name}</div>
            <div><strong>NPWP (16 Digit):</strong> ${ent.npwp}</div>
            <div><strong>KPP Terdaftar:</strong> ${ent.kpp}</div>
            <div><strong>Tahun Pajak:</strong> ${f.tahunPajak} (${f.periodePembukuan})</div>
          </div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 60px;">No</th>
              <th>Bagian & Uraian Induk SPT 1771</th>
              <th class="text-right" style="width: 220px;">Jumlah (Rupiah)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="3">BAGIAN A : PENGHASILAN NETO FISKAL</td>
            </tr>
            <tr>
              <td>1.</td>
              <td>Penghasilan Neto Komersial Dalam Negeri</td>
              <td class="text-right font-weight-bold">${App.formatIDR(f.bagianA?.penghasilanNetoKomersialDN)}</td>
            </tr>
            <tr>
              <td>2.</td>
              <td>Penyesuaian Fiskal Positif (Lampiran I Elemen 5)</td>
              <td class="text-right" style="color: #B45309;">+ ${App.formatIDR(f.bagianA?.penyesuaianFiskalPositif)}</td>
            </tr>
            <tr>
              <td>3.</td>
              <td>Penyesuaian Fiskal Negatif (Lampiran I Elemen 6)</td>
              <td class="text-right" style="color: #1D4ED8;">- ${App.formatIDR(f.bagianA?.penyesuaianFiskalNegatif)}</td>
            </tr>
            <tr style="background: #FEF3C7; font-weight: 700;">
              <td>4.</td>
              <td><strong>JUMLAH PENGHASILAN NETO FISKAL (1 + 2 - 3)</strong></td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(f.bagianA?.penghasilanNetoFiskal)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="3">BAGIAN B : PENGHASILAN KENA PAJAK (PKP)</td>
            </tr>
            <tr>
              <td>5.</td>
              <td>Kompensasi Kerugian Fiskal Tahun Sebelumnya</td>
              <td class="text-right">-</td>
            </tr>
            <tr style="background: #FEF3C7; font-weight: 700;">
              <td>6.</td>
              <td><strong>PENGHASILAN KENA PAJAK (PKP) (Elemen 4 - 5)</strong></td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(f.bagianB?.penghasilanKenaPajak)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="3">BAGIAN C : PPh TERUTANG</td>
            </tr>
            <tr>
              <td>7.</td>
              <td>
                PPh Terutang (${f.bagianC?.dasarHukumTarif})
              </td>
              <td class="text-right font-weight-bold" style="color: #DC2626;">${App.formatIDR(f.bagianC?.pphTerutang)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="3">BAGIAN D : KREDIT PAJAK</td>
            </tr>
            <tr>
              <td>8.</td>
              <td>Kredit Pajak Dalam Negeri (PPh 22 & PPh 23 dari Lampiran III)</td>
              <td class="text-right">${App.formatIDR(f.bagianD?.kreditPph22 + f.bagianD?.kreditPph23)}</td>
            </tr>
            <tr>
              <td>9.</td>
              <td>PPh Pasal 25 yang Dibayar Sendiri</td>
              <td class="text-right">${App.formatIDR(f.bagianD?.kreditPph25)}</td>
            </tr>
            <tr style="background: #EFF6FF; font-weight: 700;">
              <td>10.</td>
              <td><strong>JUMLAH KREDIT PAJAK (8 + 9)</strong></td>
              <td class="text-right font-weight-bold" style="color: #1D4ED8;">${App.formatIDR(f.bagianD?.totalKreditPajak)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="3">BAGIAN E : PPh KURANG / LEBIH BAYAR</td>
            </tr>
            <tr class="total-row" style="background: ${f.bagianE?.pphKurangLebihBayar > 0 ? '#FEE2E2' : '#D1FAE5'};">
              <td>11.</td>
              <td style="font-size: 13.5px; font-weight: 800;">
                ${f.bagianE?.status} (PPh Terutang - Kredit Pajak)
              </td>
              <td class="text-right font-weight-bold" style="font-size: 15px; color: ${f.bagianE?.pphKurangLebihBayar > 0 ? '#DC2626' : '#059669'};">
                ${App.formatIDR(Math.abs(f.bagianE?.pphKurangLebihBayar || 0))}
              </td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 16px; background: #FFFFFF; border-top: 1px solid #CBD5E1; display: flex; justify-content: space-between;">
          <div>
            <strong>Pernyataan:</strong> Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi-sanksi sesuai ketentuan peraturan perundang-undangan perpajakan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas beserta lampiran-lampirannya adalah benar, lengkap dan jelas.
          </div>
          <div style="text-align: center; min-width: 220px;">
            <div>Jakarta, 30 April ${this.data.fiscalYear + 1}</div>
            <div style="margin-top: 40px; font-weight: 700; text-decoration: underline;">${ent.director_name}</div>
            <div style="font-size: 11px;">Direktur Utama / Kuasa Wajib Pajak</div>
          </div>
        </div>
      </div>
    `;
  },

  renderLampiranI: function() {
    const l = this.data?.lampiranI || {};

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> ${l.title}</div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Elemen Perhitungan</th>
              <th class="text-right" style="width: 200px;">Nilai Komersial (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1.</td>
              <td><strong>Peredaran Usaha (Omzet Penjualan Barang & Jasa)</strong></td>
              <td class="text-right font-weight-bold">${App.formatIDR(l.peredaranUsaha)}</td>
            </tr>
            <tr>
              <td>2.</td>
              <td>Harga Pokok Penjualan (HPP)</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(l.hpp)}</td>
            </tr>
            <tr>
              <td>3.</td>
              <td>Biaya Usaha Lainnya (Beban Operasional / OPEX)</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(l.biayaUsaha)}</td>
            </tr>
            <tr style="background: #F1F5F9; font-weight: 700;">
              <td>4.</td>
              <td>Penghasilan Neto dari Usaha (1 - 2 - 3)</td>
              <td class="text-right font-weight-bold">${App.formatIDR(l.peredaranUsaha - l.hpp - l.biayaUsaha)}</td>
            </tr>
            <tr>
              <td>5.</td>
              <td>Penghasilan dari Luar Usaha</td>
              <td class="text-right">+ ${App.formatIDR(l.penghasilanLuarUsaha)}</td>
            </tr>
            <tr>
              <td>6.</td>
              <td>Biaya dari Luar Usaha</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(l.biayaLuarUsaha)}</td>
            </tr>
            <tr style="background: #FEF3C7; font-weight: 700;">
              <td>7.</td>
              <td><strong>JUMLAH PENGHASILAN NETO KOMERSIAL</strong></td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(l.penghasilanNetoKomersial)}</td>
            </tr>
            <tr>
              <td>8.</td>
              <td>Penyesuaian Fiskal Positif Total</td>
              <td class="text-right" style="color: #B45309;">+ ${App.formatIDR(l.penyesuaianFiskalPositif)}</td>
            </tr>
            <tr>
              <td>9.</td>
              <td>Penyesuaian Fiskal Negatif Total</td>
              <td class="text-right" style="color: #1D4ED8;">- ${App.formatIDR(l.penyesuaianFiskalNegatif)}</td>
            </tr>
            <tr class="total-row" style="background: #D1FAE5;">
              <td>10.</td>
              <td style="font-weight: 800; font-size: 13.5px; color: #065F46;">JUMLAH PENGHASILAN NETO FISKAL</td>
              <td class="text-right font-weight-bold" style="font-size: 14px; color: #065F46;">${App.formatIDR(l.penghasilanNetoFiskal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  renderLampiranII: function() {
    const l = this.data?.lampiranII || {};

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> ${l.title}</div>
          <span class="badge badge-neutral">Total Biaya: ${App.formatIDR(l.totalBiaya || 0)}</span>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 100px;">Kode Akun</th>
              <th>Nama Akun Perincian Beban</th>
              <th>Klasifikasi Beban</th>
              <th class="text-right" style="width: 180px;">Jumlah Beban Komersial (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${(l.details || []).map(d => `
              <tr>
                <td><strong>${d.code}</strong></td>
                <td>${d.name}</td>
                <td><span class="badge badge-neutral">${d.sub_category || '-'}</span></td>
                <td class="text-right font-weight-bold">${App.formatIDR(d.amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" class="text-right">TOTAL BIAYA USAHA & LUAR USAHA (1771 - II)</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(l.totalBiaya)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  renderLampiranIII: function() {
    const l = this.data?.lampiranIII || {};

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> ${l.title}</div>
          <span class="badge badge-success">Total Kredit: ${App.formatIDR(l.totalKreditPajakDalamNegeri || 0)}</span>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 100px;">Tanggal</th>
              <th style="width: 90px;">Jenis PPh</th>
              <th>Nama Pemotong Pajak (Withholding Agent)</th>
              <th style="width: 160px;">NPWP Pemotong</th>
              <th style="width: 140px;">No. Bukti Potong</th>
              <th class="text-right" style="width: 140px;">Nilai Objek (DPP)</th>
              <th class="text-right" style="width: 140px;">PPh Dipotong</th>
            </tr>
          </thead>
          <tbody>
            ${(l.items || []).map(it => `
              <tr>
                <td>${it.date}</td>
                <td><span class="badge badge-info">${it.tax_type}</span></td>
                <td><strong>${it.withholding_agent_name || it.name}</strong></td>
                <td>${it.withholding_agent_npwp || it.npwp || '-'}</td>
                <td><strong>${it.bukti_potong_no || '-'}</strong></td>
                <td class="text-right">${App.formatIDR(it.dpp)}</td>
                <td class="text-right font-weight-bold" style="color: #059669;">${App.formatIDR(it.tax_amount)}</td>
              </tr>
            `).join('') || `<tr><td colspan="7" class="text-center" style="padding: 16px;">Tidak ada bukti potong tercatat.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  },

  renderLampiranIV: function() {
    const l = this.data?.lampiranIV || {};

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> ${l.title}</div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th>Jenis Penghasilan Final</th>
              <th class="text-right" style="width: 180px;">Dasar Pengenaan Pajak (DPP)</th>
              <th class="text-center" style="width: 80px;">Tarif</th>
              <th class="text-right" style="width: 180px;">PPh Terutang Final</th>
            </tr>
          </thead>
          <tbody>
            ${(l.items || []).map(it => `
              <tr>
                <td>
                  <strong>${it.notes || it.name}</strong>
                  <div style="font-size: 11px; color: #64748B;">Pihak Pembayar: ${it.payer_name || it.name}</div>
                </td>
                <td class="text-right font-weight-bold">${App.formatIDR(it.dpp)}</td>
                <td class="text-center">${it.tax_rate}%</td>
                <td class="text-right font-weight-bold" style="color: #B45309;">${App.formatIDR(it.tax_amount)}</td>
              </tr>
            `).join('') || `<tr><td colspan="4" class="text-center" style="padding: 16px;">Tidak ada transaksi penghasilan final.</td></tr>`}
            <tr class="total-row">
              <td class="text-right">TOTAL PENGHASILAN FINAL</td>
              <td class="text-right">${App.formatIDR(l.totalDPPFinal || 0)}</td>
              <td></td>
              <td class="text-right">${App.formatIDR(l.totalPajakTerutangFinal || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  renderLampiranV: function() {
    const l = this.data?.lampiranV || {};

    return `
      <div class="card-table-wrapper" style="margin-bottom: 20px;">
        <div class="table-header-toolbar">
          <div class="table-title"><span>👥</span> Bagian A : Daftar Pemegang Saham / Pemilik Modal (1771 - V)</div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Nama Pemegang Saham</th>
              <th>Alamat</th>
              <th style="width: 160px;">NPWP</th>
              <th class="text-right" style="width: 160px;">Modal Disetor (Rp)</th>
              <th class="text-center" style="width: 80px;">% Saham</th>
            </tr>
          </thead>
          <tbody>
            ${(l.shareholders || []).map((s, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.address}</td>
                <td>${s.npwp}</td>
                <td class="text-right font-weight-bold">${App.formatIDR(s.capital)}</td>
                <td class="text-center font-weight-bold">${s.pct}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>👔</span> Bagian B : Daftar Susunan Pengurus dan Komisaris (1771 - V)</div>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Nama Pengurus / Komisaris</th>
              <th>Alamat</th>
              <th style="width: 160px;">NPWP</th>
              <th style="width: 200px;">Jabatan</th>
            </tr>
          </thead>
          <tbody>
            ${(l.officers || []).map((o, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${o.name}</strong></td>
                <td>${o.address}</td>
                <td>${o.npwp}</td>
                <td><span class="badge badge-info">${o.position}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderLampiranVI: function() {
    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📑</span> Formulir 1771 - VI : Daftar Penyertaan Modal pada Perusahaan Afiliasi & Pinjaman Pemegang Saham</div>
        </div>
        <div style="padding: 24px; text-align: center; color: #64748B;">
          Tidak ada saldo pinjaman pemegang saham (Transfer Pricing / Debt to Equity Ratio aman sesuai PMK 169).
        </div>
      </div>
    `;
  },

  exportExcel: function() {
    const f = this.data?.form1771Induk || {};
    const rows = [
      { uraian: 'Penghasilan Neto Komersial', jumlah: f.bagianA?.penghasilanNetoKomersialDN },
      { uraian: 'Penyesuaian Fiskal Positif', jumlah: f.bagianA?.penyesuaianFiskalPositif },
      { uraian: 'Penyesuaian Fiskal Negatif', jumlah: f.bagianA?.penyesuaianFiskalNegatif },
      { uraian: 'Penghasilan Neto Fiskal', jumlah: f.bagianA?.penghasilanNetoFiskal },
      { uraian: 'Penghasilan Kena Pajak (PKP)', jumlah: f.bagianB?.penghasilanKenaPajak },
      { uraian: 'PPh Terutang', jumlah: f.bagianC?.pphTerutang },
      { uraian: 'Total Kredit Pajak (PPh 22, 23, 25)', jumlah: f.bagianD?.totalKreditPajak },
      { uraian: f.bagianE?.status, jumlah: f.bagianE?.pphKurangLebihBayar }
    ];

    const headers = [
      { key: 'uraian', label: 'Elemen SPT 1771' },
      { key: 'jumlah', label: 'Jumlah (Rp)', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `SPT_1771_Badan_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'SPT 1771',
      `SPT TAHUNAN PPH BADAN FORMULIR 1771 TAHUN ${this.data.fiscalYear}`,
      App.activeEntity,
      headers,
      rows
    );
  }
};
