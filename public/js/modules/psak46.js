/**
 * PSAK 46 Module: Rekonsiliasi Fiskal, Pajak Kini & Aset Pajak Tangguhan
 */

Modules.PSAK46 = {
  data: null,

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Menghitung Rekonsiliasi Fiskal & PSAK 46...</div>`;

    try {
      const res = await fetch(`/api/psak46?entity_id=${App.activeEntity.id}&year=${App.activeEntity.fiscal_year}`);
      this.data = await res.json();

      const comm = this.data.commercialSummary || {};
      const fisc = this.data.fiscalAdjustments || {};
      const cur = this.data.currentTax || {};
      const def = this.data.psak46DeferredTax || {};
      const aud = this.data.auditorReconciliation || {};

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>⚖️</span> Perhitungan Pajak Kini & Pajak Tangguhan (PSAK 46)
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Rekonsiliasi Beda Tetap vs Beda Temporer & Deferred Tax Asset/Liability
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.PSAK46.showAddAdjustmentModal()">
              <span>➕</span> Tambah Koreksi Fiskal
            </button>
            <button class="btn btn-outline" onclick="Modules.PSAK46.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('REKONSILIASI FISKAL & PERHITUNGAN PSAK 46', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- 4 SUMMARY CARDS -->
        <div class="grid-cards">
          <div class="stat-card accent-navy">
            <div class="stat-title">Laba Komersial Sebelum Pajak</div>
            <div class="stat-value">${App.formatIDR(comm.commercialProfitBeforeTax || 0)}</div>
            <div class="stat-sub">Berdasarkan Laporan Laba Rugi SAK</div>
          </div>

          <div class="stat-card accent-gold">
            <div class="stat-title">Penghasilan Kena Pajak (PKP)</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(fisc.taxableIncome || 0)}</div>
            <div class="stat-sub">Setelah Koreksi Positif & Negatif</div>
          </div>

          <div class="stat-card accent-red">
            <div class="stat-title">Beban Pajak Kini (Current Tax)</div>
            <div class="stat-value" style="color: #DC2626;">${App.formatIDR(cur.currentTaxExpense || 0)}</div>
            <div class="stat-sub">${cur.article31EFacilityDescription || 'PPh Badan'}</div>
          </div>

          <div class="stat-card accent-green">
            <div class="stat-title">Aset Pajak Tangguhan (PSAK 46)</div>
            <div class="stat-value" style="color: #059669;">${App.formatIDR(def.deferredTaxAmount || 0)}</div>
            <div class="stat-sub">${def.classification}</div>
          </div>
        </div>

        <!-- REKONSILIASI FISKAL TABLE -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Kertas Kerja Rekonsiliasi Fiskal Laba Komersial ke Fiskal (Tahun Pajak ${this.data.fiscalYear})</div>
          </div>

          <table class="coretax-table">
            <thead>
              <tr>
                <th>Uraian Rekonsiliasi Fiskal</th>
                <th>Sifat Koreksi</th>
                <th class="text-right" style="width: 180px;">Nominal (Rp)</th>
                <th class="text-right" style="width: 180px;">Subtotal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #F8FAFC; font-weight: 700;">
                <td colspan="3">1. LABA BERSIH KOMERSIAL SEBELUM PAJAK PENGHASILAN</td>
                <td class="text-right font-weight-bold" style="font-size: 13px;">${App.formatIDR(comm.commercialProfitBeforeTax)}</td>
              </tr>

              <tr style="background: #FFFBEB; font-weight: 700; color: #B45309;">
                <td colspan="4">2. PENYESUAIAN FISKAL POSITIF (MENAMBAH LABA FISKAL)</td>
              </tr>
              ${(fisc.items || []).filter(i => i.type === 'POSITIF').map(it => `
                <tr>
                  <td style="padding-left: 28px;">
                    • ${it.description}
                    ${it.notes ? `<div style="font-size: 11px; color: #64748B;">Dasar Hukum: ${it.notes}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${it.is_temporary ? 'badge-success' : 'badge-neutral'}">
                      ${it.difference_nature}
                    </span>
                  </td>
                  <td class="text-right">${App.formatIDR(it.amount)}</td>
                  <td></td>
                </tr>
              `).join('')}
              <tr style="background: #F1F5F9; font-weight: 600;">
                <td colspan="2" style="padding-left: 28px;">Total Koreksi Fiskal Positif</td>
                <td class="text-right">${App.formatIDR(fisc.totalPositiveCorrection)}</td>
                <td class="text-right font-weight-bold" style="color: #B45309;">+ ${App.formatIDR(fisc.totalPositiveCorrection)}</td>
              </tr>

              <tr style="background: #EFF6FF; font-weight: 700; color: #1D4ED8;">
                <td colspan="4">3. PENYESUAIAN FISKAL NEGATIF (MENGURANGI LABA FISKAL)</td>
              </tr>
              ${(fisc.items || []).filter(i => i.type === 'NEGATIF').map(it => `
                <tr>
                  <td style="padding-left: 28px;">
                    • ${it.description}
                    ${it.notes ? `<div style="font-size: 11px; color: #64748B;">Dasar Hukum: ${it.notes}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${it.is_temporary ? 'badge-success' : 'badge-neutral'}">
                      ${it.difference_nature}
                    </span>
                  </td>
                  <td class="text-right">${App.formatIDR(it.amount)}</td>
                  <td></td>
                </tr>
              `).join('')}
              <tr style="background: #F1F5F9; font-weight: 600;">
                <td colspan="2" style="padding-left: 28px;">Total Koreksi Fiskal Negatif</td>
                <td class="text-right">${App.formatIDR(fisc.totalNegativeCorrection)}</td>
                <td class="text-right font-weight-bold" style="color: #1D4ED8;">- ${App.formatIDR(fisc.totalNegativeCorrection)}</td>
              </tr>

              <tr class="total-row" style="background: #FEF3C7; font-size: 13.5px;">
                <td colspan="3" style="color: #002B49; font-weight: 800;">
                  4. PENGHASILAN KENA PAJAK (PKP) TAHUN ${this.data.fiscalYear}
                </td>
                <td class="text-right font-weight-bold" style="color: #002B49; font-size: 14px;">
                  ${App.formatIDR(fisc.taxableIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PSAK 46 DEFERRED TAX COMPUTATION & AUDITOR NOTE -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px;">
          <div class="card-table-wrapper" style="margin-bottom: 0;">
            <div class="table-header-toolbar">
              <div class="table-title"><span>📑</span> Perhitungan Aset Pajak Tangguhan (PSAK 46)</div>
            </div>
            <div style="padding: 16px;">
              <table class="coretax-table">
                <tbody>
                  <tr>
                    <td>Beda Temporer Positif (Penyusutan, CKPN)</td>
                    <td class="text-right font-weight-bold">${App.formatIDR(def.positiveTemporaryDiff || 0)}</td>
                  </tr>
                  <tr>
                    <td>Beda Temporer Negatif</td>
                    <td class="text-right font-weight-bold">${App.formatIDR(def.negativeTemporaryDiff || 0)}</td>
                  </tr>
                  <tr style="background: #F8FAFC;">
                    <td><strong>Net Beda Temporer Dapat Dikurangkan</strong></td>
                    <td class="text-right font-weight-bold" style="color: #0284C7;">${App.formatIDR(def.netTemporaryDifference || 0)}</td>
                  </tr>
                  <tr>
                    <td>Tarif Pajak Efektif PSAK 46 (UU HPP)</td>
                    <td class="text-right font-weight-bold">${def.deferredTaxRate}%</td>
                  </tr>
                  <tr class="total-row" style="background: #ECFDF5;">
                    <td style="color: #065F46; font-weight: 800;">
                      SALDO ASET PAJAK TANGGUHAN (DTA) NERACA
                    </td>
                    <td class="text-right font-weight-bold" style="color: #059669; font-size: 14px;">
                      ${App.formatIDR(def.deferredTaxAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style="margin-top: 14px; padding: 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px;">
                <div style="font-weight: 700; font-size: 11.5px; color: #002B49; margin-bottom: 6px;">Jurnal Standar PSAK 46:</div>
                <div style="font-family: monospace; font-size: 11px;">
                  (D) ${def.deferredTaxJournal?.debitAccount} : ${App.formatIDR(def.deferredTaxJournal?.amount)}<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;(K) ${def.deferredTaxJournal?.creditAccount} : ${App.formatIDR(def.deferredTaxJournal?.amount)}
                </div>
              </div>
            </div>
          </div>

          <div class="card-table-wrapper" style="margin-bottom: 0;">
            <div class="table-header-toolbar">
              <div class="table-title"><span>🔍</span> Rekonsiliasi Beban Pajak Efektif (Kebutuhan Auditor)</div>
            </div>
            <div style="padding: 16px;">
              <table class="coretax-table">
                <tbody>
                  <tr>
                    <td>Laba Sebelum Pajak Komersial</td>
                    <td class="text-right font-weight-bold">${App.formatIDR(aud.commercialProfitBeforeTax)}</td>
                  </tr>
                  <tr>
                    <td>Pajak dihitung dengan Tarif Standar (22%)</td>
                    <td class="text-right">${App.formatIDR(aud.taxAtStatutoryRate)}</td>
                  </tr>
                  <tr>
                    <td>Pengaruh Pajak atas Beda Tetap (Permanen)</td>
                    <td class="text-right" style="color: #B45309;">+ ${App.formatIDR(aud.permanentDifferenceTaxImpact)}</td>
                  </tr>
                  <tr>
                    <td>Fasilitas Pengurangan Tarif Pasal 31E UU PPh</td>
                    <td class="text-right" style="color: #059669;">- ${App.formatIDR(aud.taxRateDifferenceBenefit)}</td>
                  </tr>
                  <tr class="total-row" style="background: #F1F5F9;">
                    <td style="font-weight: 800;">TOTAL BEBAN PAJAK PENGHASILAN KOMPREHENSIF</td>
                    <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(aud.totalTaxExpense)}</td>
                  </tr>
                  <tr style="background: #EFF6FF;">
                    <td style="font-weight: 800; color: #1E40AF;">LABA BERSIH SETELAH PAJAK (NET INCOME)</td>
                    <td class="text-right font-weight-bold" style="color: #1E40AF; font-size: 14px;">${App.formatIDR(aud.netCommercialIncome)}</td>
                  </tr>
                  <tr>
                    <td>Tarif Pajak Efektif (Effective Tax Rate - ETR)</td>
                    <td class="text-right font-weight-bold" style="color: #D97706;">${this.data.taxRates?.effectiveTaxRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat PSAK 46: ${err.message}</div>`;
    }
  },

  showAddAdjustmentModal: function() {
    const body = `
      <form id="form-add-fisc">
        <div class="form-group">
          <label class="form-label">Uraian Koreksi Fiskal *</label>
          <input type="text" id="fisc-desc" class="form-control" placeholder="Contoh: Beban Sumbangan Non-Fiskal" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Jenis Penyesuaian *</label>
            <select id="fisc-type" class="form-control">
              <option value="POSITIF">Koreksi Fiskal Positif (Menambah Laba Kena Pajak)</option>
              <option value="NEGATIF">Koreksi Fiskal Negatif (Mengurangi Laba Kena Pajak)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sifat Perbedaan *</label>
            <select id="fisc-temp" class="form-control">
              <option value="0">Beda Tetap (Permanent Difference)</option>
              <option value="1">Beda Temporer (Temporary Difference - PSAK 46 DTA/DTL)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nominal Koreksi (Rp) *</label>
          <input type="number" id="fisc-amount" class="form-control" value="0" required>
        </div>

        <div class="form-group">
          <label class="form-label">Dasar Hukum / Catatan Fiskus</label>
          <input type="text" id="fisc-notes" class="form-control" placeholder="Contoh: Pasal 9 ayat (1) UU PPh">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.PSAK46.saveNewAdjustment()">Simpan Koreksi Fiskal</button>
    `;

    App.showModal('Tambah Koreksi Fiskal (SPT 1771 & PSAK 46)', body, footer);
  },

  saveNewAdjustment: async function() {
    const desc = document.getElementById('fisc-desc')?.value.trim();
    const type = document.getElementById('fisc-type')?.value;
    const isTemp = document.getElementById('fisc-temp')?.value === '1';
    const amount = parseFloat(document.getElementById('fisc-amount')?.value) || 0;
    const notes = document.getElementById('fisc-notes')?.value.trim();

    if (!desc || amount <= 0) {
      alert('Deskripsi dan Nominal koreksi wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/psak46/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          fiscal_year: App.activeEntity.fiscal_year,
          description: desc,
          type,
          is_temporary: isTemp,
          amount,
          notes
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Koreksi fiskal berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const items = this.data?.fiscalAdjustments?.items || [];
    const headers = [
      { key: 'description', label: 'Uraian Koreksi Fiskal' },
      { key: 'type', label: 'Jenis Koreksi', align: 'center' },
      { key: 'difference_nature', label: 'Sifat Beda' },
      { key: 'amount', label: 'Nominal Koreksi (Rp)', type: 'number' },
      { key: 'notes', label: 'Dasar Hukum / Catatan' }
    ];

    CoretaxExport.exportToExcel(
      `Rekonsiliasi_Fiskal_PSAK46_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'PSAK 46',
      'REKONSILIASI FISKAL & PERHITUNGAN PAJAK TANGGUHAN PSAK 46',
      App.activeEntity,
      headers,
      items
    );
  }
};
