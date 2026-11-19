/**
 * Complete Financial Reports & Auditor Pack Module
 */

Modules.Reports = {
  currentTab: 'BALANCE_SHEET', // 'BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW', 'EQUITY', 'TRIAL_BALANCE', 'RATIOS', 'AUDITOR_PACK'
  cache: {},

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Menyiapkan Laporan Keuangan Standar PSAK...</div>`;

    try {
      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📈</span> Seluruh Laporan Keuangan & Paket Auditor
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Standar PSAK Indonesia & Ketentuan Pelaporan Auditor Independen
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="Modules.Reports.exportCurrentExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-primary" onclick="CoretaxExport.printReport(Modules.Reports.getReportTitle(), App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- REPORT NAVIGATION TABS -->
        <div class="coretax-tabs" style="overflow-x: auto; white-space: nowrap;">
          <button class="tab-btn ${this.currentTab === 'BALANCE_SHEET' ? 'active' : ''}" onclick="Modules.Reports.switchTab('BALANCE_SHEET')">
            1. Neraca (Posisi Keuangan)
          </button>
          <button class="tab-btn ${this.currentTab === 'INCOME_STATEMENT' ? 'active' : ''}" onclick="Modules.Reports.switchTab('INCOME_STATEMENT')">
            2. Laba Rugi Komprehensif
          </button>
          <button class="tab-btn ${this.currentTab === 'CASH_FLOW' ? 'active' : ''}" onclick="Modules.Reports.switchTab('CASH_FLOW')">
            3. Laporan Arus Kas
          </button>
          <button class="tab-btn ${this.currentTab === 'EQUITY' ? 'active' : ''}" onclick="Modules.Reports.switchTab('EQUITY')">
            4. Perubahan Ekuitas
          </button>
          <button class="tab-btn ${this.currentTab === 'TRIAL_BALANCE' ? 'active' : ''}" onclick="Modules.Reports.switchTab('TRIAL_BALANCE')">
            5. Trial Balance (Neraca Saldo)
          </button>
          <button class="tab-btn ${this.currentTab === 'RATIOS' ? 'active' : ''}" onclick="Modules.Reports.switchTab('RATIOS')">
            6. Analisis Rasio, EBITDA & OPEX
          </button>
          <button class="tab-btn ${this.currentTab === 'AUDITOR_PACK' ? 'active' : ''}" onclick="Modules.Reports.switchTab('AUDITOR_PACK')">
            7. Lampiran Auditor & CALK
          </button>
        </div>

        <div id="report-view-content" style="margin-top: 10px;">
          <!-- Content dynamically rendered -->
        </div>

        <!-- AUDITOR SIGNATURE BLOCK FOR PRINT -->
        <div class="print-signatures" style="display: none;">
          <div class="sig-block">
            <div>Dibuat oleh:</div>
            <div class="sig-space"></div>
            <div class="sig-line">Staff Akuntansi / Pajak</div>
          </div>
          <div class="sig-block">
            <div>Diperiksa oleh:</div>
            <div class="sig-space"></div>
            <div class="sig-line">Finance & Tax Manager</div>
          </div>
          <div class="sig-block">
            <div>Disetujui oleh:</div>
            <div class="sig-space"></div>
            <div class="sig-line">${App.activeEntity?.director_name || 'Direktur Utama'}</div>
          </div>
        </div>
      `;

      this.loadReportContent();
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat laporan: ${err.message}</div>`;
    }
  },

  switchTab: function(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('main-content-view'));
  },

  getReportTitle: function() {
    switch (this.currentTab) {
      case 'BALANCE_SHEET': return 'LAPORAN POSISI KEUANGAN (NERACA)';
      case 'INCOME_STATEMENT': return 'LAPORAN LABA RUGI DAN PENGHASILAN KOMPREHENSIF LAIN';
      case 'CASH_FLOW': return 'LAPORAN ARUS KAS (STATEMENT OF CASH FLOWS)';
      case 'EQUITY': return 'LAPORAN PERUBAHAN EKUITAS (STATEMENT OF CHANGES IN EQUITY)';
      case 'TRIAL_BALANCE': return 'NERACA SALDO (TRIAL BALANCE)';
      case 'RATIOS': return 'ANALISIS KEUANGAN, RASIO, EBITDA & OPEX';
      case 'AUDITOR_PACK': return 'CATATAN ATAS LAPORAN KEUANGAN (CALK) & LAMPIRAN AUDITOR';
      default: return 'LAPORAN KEUANGAN';
    }
  },

  loadReportContent: async function() {
    const content = document.getElementById('report-view-content');
    if (!content) return;
    content.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748B;">Memuat data laporan...</div>`;

    switch (this.currentTab) {
      case 'BALANCE_SHEET': await this.renderBalanceSheet(content); break;
      case 'INCOME_STATEMENT': await this.renderIncomeStatement(content); break;
      case 'CASH_FLOW': await this.renderCashFlow(content); break;
      case 'EQUITY': await this.renderEquity(content); break;
      case 'TRIAL_BALANCE': await this.renderTrialBalance(content); break;
      case 'RATIOS': await this.renderRatios(content); break;
      case 'AUDITOR_PACK': await this.renderAuditorPack(content); break;
    }
  },

  // 1. NERACA (BALANCE SHEET)
  renderBalanceSheet: async function(container) {
    const res = await fetch(`/api/reports/balance-sheet?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.balanceSheet = data;

    const curAssets = data.assets?.currentAssets?.items || [];
    const nonCurAssets = data.assets?.nonCurrentAssets?.items || [];
    const curLiab = data.liabilities?.currentLiabilities?.items || [];
    const longLiab = data.liabilities?.longTermLiabilities?.items || [];
    const eqItems = data.equity?.items || [];

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>🏛️</span> Laporan Posisi Keuangan (Neraca) per ${data.asOfDate}</div>
          <span class="badge ${data.isBalanced ? 'badge-success' : 'badge-danger'}">
            ${data.isBalanced ? '✓ SEIMBANG (BALANCED)' : 'SELISIH: ' + App.formatIDR(data.difference)}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 18px;">
          <!-- SISI KIRI: ASET -->
          <div>
            <div style="font-weight: 800; font-size: 14px; color: #002B49; border-bottom: 2px solid #002B49; padding-bottom: 4px; margin-bottom: 10px;">
              ASET (ASSETS)
            </div>

            <div style="font-weight: 700; color: #475569; margin-bottom: 6px;">Aset Lancar (Current Assets):</div>
            <table class="coretax-table" style="margin-bottom: 16px;">
              <tbody>
                ${curAssets.map(a => `
                  <tr>
                    <td>${a.name} <span style="font-size: 10px; color: #94A3B8;">(${a.code})</span></td>
                    <td class="text-right">${App.formatIDR(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr style="background: #F1F5F9; font-weight: 700;">
                  <td>Jumlah Aset Lancar</td>
                  <td class="text-right">${App.formatIDR(data.assets?.currentAssets?.total)}</td>
                </tr>
              </tbody>
            </table>

            <div style="font-weight: 700; color: #475569; margin-bottom: 6px;">Aset Tidak Lancar (Non-Current Assets):</div>
            <table class="coretax-table" style="margin-bottom: 16px;">
              <tbody>
                ${nonCurAssets.map(a => `
                  <tr>
                    <td>${a.name} <span style="font-size: 10px; color: #94A3B8;">(${a.code})</span></td>
                    <td class="text-right">${App.formatIDR(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr style="background: #F1F5F9; font-weight: 700;">
                  <td>Jumlah Aset Tidak Lancar</td>
                  <td class="text-right">${App.formatIDR(data.assets?.nonCurrentAssets?.total)}</td>
                </tr>
              </tbody>
            </table>

            <table class="coretax-table">
              <tbody>
                <tr class="total-row" style="background: #E0F2FE;">
                  <td style="font-weight: 800; font-size: 13.5px; color: #002B49;">TOTAL ASET (JUMLAH AKTIVA)</td>
                  <td class="text-right font-weight-bold" style="font-size: 14px; color: #002B49;">${App.formatIDR(data.assets?.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SISI KANAN: KEWAJIBAN & EKUITAS -->
          <div>
            <div style="font-weight: 800; font-size: 14px; color: #002B49; border-bottom: 2px solid #002B49; padding-bottom: 4px; margin-bottom: 10px;">
              KEWAJIBAN & EKUITAS (LIABILITIES & EQUITY)
            </div>

            <div style="font-weight: 700; color: #475569; margin-bottom: 6px;">Kewajiban Jangka Pendek (Current Liabilities):</div>
            <table class="coretax-table" style="margin-bottom: 16px;">
              <tbody>
                ${curLiab.map(a => `
                  <tr>
                    <td>${a.name} <span style="font-size: 10px; color: #94A3B8;">(${a.code})</span></td>
                    <td class="text-right">${App.formatIDR(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr style="background: #F1F5F9; font-weight: 700;">
                  <td>Jumlah Kewajiban Jangka Pendek</td>
                  <td class="text-right">${App.formatIDR(data.liabilities?.currentLiabilities?.total)}</td>
                </tr>
              </tbody>
            </table>

            <div style="font-weight: 700; color: #475569; margin-bottom: 6px;">Kewajiban Jangka Panjang (Long-Term Liabilities):</div>
            <table class="coretax-table" style="margin-bottom: 16px;">
              <tbody>
                ${longLiab.map(a => `
                  <tr>
                    <td>${a.name} <span style="font-size: 10px; color: #94A3B8;">(${a.code})</span></td>
                    <td class="text-right">${App.formatIDR(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr style="background: #F1F5F9; font-weight: 700;">
                  <td>Jumlah Kewajiban Jangka Panjang</td>
                  <td class="text-right">${App.formatIDR(data.liabilities?.longTermLiabilities?.total)}</td>
                </tr>
              </tbody>
            </table>

            <div style="font-weight: 700; color: #475569; margin-bottom: 6px;">Ekuitas Pemilik (Equity):</div>
            <table class="coretax-table" style="margin-bottom: 16px;">
              <tbody>
                ${eqItems.map(a => `
                  <tr>
                    <td>${a.name} <span style="font-size: 10px; color: #94A3B8;">(${a.code})</span></td>
                    <td class="text-right">${App.formatIDR(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td>Laba Periode Berjalan (dari Laporan Laba Rugi)</td>
                  <td class="text-right font-weight-bold" style="color: #059669;">${App.formatIDR(data.equity?.currentPeriodNetIncome)}</td>
                </tr>
                <tr style="background: #F1F5F9; font-weight: 700;">
                  <td>Jumlah Ekuitas</td>
                  <td class="text-right">${App.formatIDR(data.equity?.totalEquity)}</td>
                </tr>
              </tbody>
            </table>

            <table class="coretax-table">
              <tbody>
                <tr class="total-row" style="background: #E0F2FE;">
                  <td style="font-weight: 800; font-size: 13.5px; color: #002B49;">TOTAL KEWAJIBAN & EKUITAS</td>
                  <td class="text-right font-weight-bold" style="font-size: 14px; color: #002B49;">${App.formatIDR(data.totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 2. LABA RUGI KOMPREHENSIF (INCOME STATEMENT)
  renderIncomeStatement: async function(container) {
    const res = await fetch(`/api/reports/income-statement?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.incomeStatement = data;

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📈</span> Laporan Laba Rugi dan Penghasilan Komprehensif Lain</div>
          <span class="badge badge-success">Laba Bersih: ${App.formatIDR(data.netIncome)}</span>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th>Uraian Akun</th>
              <th class="text-right" style="width: 200px;">Jumlah Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">PENDAPATAN USAHA (REVENUE)</td>
            </tr>
            ${(data.revenues?.items || []).map(r => `
              <tr>
                <td style="padding-left: 24px;">${r.name}</td>
                <td class="text-right">${App.formatIDR(r.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Total Pendapatan Usaha Bersih</td>
              <td class="text-right font-weight-bold">${App.formatIDR(data.revenues?.total)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">BEBAN POKOK PENJUALAN (HPP)</td>
            </tr>
            ${(data.cogs?.items || []).map(c => `
              <tr>
                <td style="padding-left: 24px;">${c.name}</td>
                <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(c.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Total Beban Pokok Penjualan</td>
              <td class="text-right font-weight-bold" style="color: #DC2626;">- ${App.formatIDR(data.cogs?.total)}</td>
            </tr>

            <tr style="background: #FEF3C7; font-weight: 800; font-size: 13.5px;">
              <td style="color: #002B49;">LABA KOTOR (GROSS PROFIT)</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(data.grossProfit)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">BEBAN OPERASIONAL (OPEX)</td>
            </tr>
            ${(data.opex?.items || []).map(o => `
              <tr>
                <td style="padding-left: 24px;">${o.name}</td>
                <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(o.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Total Beban Operasional (OPEX)</td>
              <td class="text-right font-weight-bold" style="color: #DC2626;">- ${App.formatIDR(data.opex?.total)}</td>
            </tr>

            <tr style="background: #FEF3C7; font-weight: 800;">
              <td style="color: #002B49;">LABA OPERASIONAL (OPERATING INCOME / EBIT)</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(data.operatingIncome)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">PENDAPATAN DAN (BEBAN) LAIN-LAIN</td>
            </tr>
            ${(data.otherIncomeExpenses?.otherRevenues?.items || []).map(r => `
              <tr>
                <td style="padding-left: 24px;">${r.name}</td>
                <td class="text-right">+ ${App.formatIDR(r.amount)}</td>
              </tr>
            `).join('')}
            ${(data.otherIncomeExpenses?.otherExpenses?.items || []).map(e => `
              <tr>
                <td style="padding-left: 24px;">${e.name}</td>
                <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(e.amount)}</td>
              </tr>
            `).join('')}

            <tr style="background: #FEF3C7; font-weight: 800;">
              <td style="color: #002B49;">LABA SEBELUM PAJAK PENGHASILAN (EBT)</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(data.earningsBeforeTax)}</td>
            </tr>

            <tr>
              <td>Beban Pajak Penghasilan Badan (Pajak Kini & Tangguhan)</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(data.taxes?.total)}</td>
            </tr>

            <tr class="total-row" style="background: #D1FAE5;">
              <td style="font-weight: 800; font-size: 14px; color: #065F46;">LABA BERSIH TAHUN BERJALAN (NET INCOME)</td>
              <td class="text-right font-weight-bold" style="font-size: 15px; color: #065F46;">${App.formatIDR(data.netIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  // 3. ARUS KAS (CASH FLOW)
  renderCashFlow: async function(container) {
    const res = await fetch(`/api/reports/cash-flow?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.cashFlow = data;

    const op = data.operatingActivities || {};
    const inv = data.investingActivities || {};
    const fin = data.financingActivities || {};
    const sum = data.summary || {};

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>🌊</span> Laporan Arus Kas (Statement of Cash Flows)</div>
          <span class="badge badge-info">Saldo Kas Akhir: ${App.formatIDR(sum.closingCashBalance)}</span>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th>Aktivitas Arus Kas</th>
              <th class="text-right" style="width: 200px;">Jumlah (Rupiah)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">ARUS KAS DARI AKTIVITAS OPERASI</td>
            </tr>
            <tr>
              <td style="padding-left: 24px;">Penerimaan kas dari pelanggan (Pelunasan Piutang & Penjualan)</td>
              <td class="text-right font-weight-bold">+ ${App.formatIDR(op.receiptsFromCustomers)}</td>
            </tr>
            <tr>
              <td style="padding-left: 24px;">Pembayaran kas kepada pemasok dan beban operasional</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(op.paymentsToSuppliersAndExpenses)}</td>
            </tr>
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Arus Kas Bersih yang Diperoleh dari Aktivitas Operasi</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(op.netCashFromOperations)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">ARUS KAS DARI AKTIVITAS INVESTASI</td>
            </tr>
            <tr>
              <td style="padding-left: 24px;">Perolehan / Pembelian Aktiva Tetap (Capex)</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(Math.abs(inv.purchaseOfFixedAssets || 0))}</td>
            </tr>
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Arus Kas Bersih yang Digunakan untuk Aktivitas Investasi</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(inv.netCashFromInvesting)}</td>
            </tr>

            <tr style="background: #F1F5F9; font-weight: 700;">
              <td colspan="2">ARUS KAS DARI AKTIVITAS PENDANAAN</td>
            </tr>
            <tr>
              <td style="padding-left: 24px;">Penerimaan Pinjaman Bank / Setoran Modal</td>
              <td class="text-right">+ ${App.formatIDR(fin.capitalContribution || 0)}</td>
            </tr>
            <tr>
              <td style="padding-left: 24px;">Pembayaran Pokok Pinjaman / Dividen</td>
              <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(fin.dividendOrLoanPayments || 0)}</td>
            </tr>
            <tr style="background: #F8FAFC; font-weight: 700;">
              <td>Arus Kas Bersih dari Aktivitas Pendanaan</td>
              <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(fin.netCashFromFinancing)}</td>
            </tr>

            <tr class="total-row" style="background: #FEF3C7;">
              <td style="font-weight: 800;">KENAIKAN / (PENURUNAN) BERSIH KAS DAN SETARA KAS</td>
              <td class="text-right font-weight-bold" style="font-size: 13.5px; color: #002B49;">${App.formatIDR(sum.netCashChange)}</td>
            </tr>
            <tr>
              <td>Kas dan Setara Kas pada Awal Periode</td>
              <td class="text-right font-weight-bold">${App.formatIDR(sum.openingCashBalance)}</td>
            </tr>
            <tr class="total-row" style="background: #D1FAE5;">
              <td style="font-weight: 800; font-size: 14px; color: #065F46;">KAS DAN SETARA KAS PADA AKHIR PERIODE (REKONSILIASI NERACA)</td>
              <td class="text-right font-weight-bold" style="font-size: 15px; color: #065F46;">${App.formatIDR(sum.closingCashBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  // 4. PERUBAHAN EKUITAS (EQUITY)
  renderEquity: async function(container) {
    const res = await fetch(`/api/reports/equity-changes?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.equity = data;

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📊</span> Laporan Perubahan Ekuitas Tahun Pajak ${data.year}</div>
          <span class="badge badge-success">Ekuitas Akhir: ${App.formatIDR(data.totalEndingEquity)}</span>
        </div>

        <table class="coretax-table">
          <thead>
            <tr>
              <th>Komponen Ekuitas</th>
              <th class="text-right" style="width: 160px;">Saldo Awal (Rp)</th>
              <th class="text-right" style="width: 160px;">Penambahan / Laba Bersih</th>
              <th class="text-right" style="width: 160px;">Pengurangan / Dividen</th>
              <th class="text-right" style="width: 180px;">Saldo Akhir (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${(data.sections || []).map(s => `
              <tr>
                <td><strong>${s.name}</strong> <span style="font-size: 10px; color: #94A3B8;">(${s.code})</span></td>
                <td class="text-right">${App.formatIDR(s.beginning_balance)}</td>
                <td class="text-right" style="color: #059669;">${s.additions > 0 ? '+ ' + App.formatIDR(s.additions) : '-'}</td>
                <td class="text-right" style="color: #DC2626;">${s.deductions > 0 ? '- ' + App.formatIDR(s.deductions) : '-'}</td>
                <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(s.ending_balance)}</td>
              </tr>
            `).join('')}
            <tr class="total-row" style="background: #E0F2FE;">
              <td style="font-weight: 800; font-size: 13.5px; color: #002B49;">TOTAL EKUITAS PEMILIK PERIODE BERJALAN</td>
              <td class="text-right font-weight-bold">${App.formatIDR(data.totalBeginningEquity)}</td>
              <td class="text-right font-weight-bold" style="color: #059669;">+ ${App.formatIDR(data.currentYearNetIncome)}</td>
              <td class="text-right font-weight-bold">-</td>
              <td class="text-right font-weight-bold" style="font-size: 14px; color: #002B49;">${App.formatIDR(data.totalEndingEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  // 5. TRIAL BALANCE (NERACA SALDO 4 & 6 KOLOM)
  renderTrialBalance: async function(container) {
    const res = await fetch(`/api/reports/trial-balance?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.trialBalance = data;
    const sum = data.summary || {};

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>⚖️</span> Neraca Saldo (Trial Balance 6 Kolom)</div>
          <span class="badge ${sum.endBalanced ? 'badge-success' : 'badge-danger'}">
            ${sum.endBalanced ? '✓ BALANCE' : 'UNBALANCED'}
          </span>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 90px; vertical-align: middle;">Kode Akun</th>
                <th rowspan="2" style="vertical-align: middle;">Nama Akun</th>
                <th colspan="2" class="text-center" style="background: #E2E8F0;">Saldo Awal</th>
                <th colspan="2" class="text-center" style="background: #CBD5E1;">Mutasi Periode</th>
                <th colspan="2" class="text-center" style="background: #E0F2FE;">Saldo Akhir</th>
              </tr>
              <tr>
                <th class="text-right" style="width: 120px;">Debit</th>
                <th class="text-right" style="width: 120px;">Kredit</th>
                <th class="text-right" style="width: 120px;">Debit</th>
                <th class="text-right" style="width: 120px;">Kredit</th>
                <th class="text-right" style="width: 120px;">Debit</th>
                <th class="text-right" style="width: 120px;">Kredit</th>
              </tr>
            </thead>
            <tbody>
              ${(data.rows || []).map(r => `
                <tr>
                  <td><strong>${r.code}</strong></td>
                  <td>${r.name}</td>
                  <td class="text-right">${r.initial_debit > 0 ? App.formatIDR(r.initial_debit) : '-'}</td>
                  <td class="text-right">${r.initial_credit > 0 ? App.formatIDR(r.initial_credit) : '-'}</td>
                  <td class="text-right">${r.period_debit > 0 ? App.formatIDR(r.period_debit) : '-'}</td>
                  <td class="text-right">${r.period_credit > 0 ? App.formatIDR(r.period_credit) : '-'}</td>
                  <td class="text-right font-weight-bold">${r.ending_debit > 0 ? App.formatIDR(r.ending_debit) : '-'}</td>
                  <td class="text-right font-weight-bold">${r.ending_credit > 0 ? App.formatIDR(r.ending_credit) : '-'}</td>
                </tr>
              `).join('')}
              <tr class="total-row" style="background: #F1F5F9;">
                <td colspan="2" class="text-right">TOTAL</td>
                <td class="text-right">${App.formatIDR(sum.initDebit)}</td>
                <td class="text-right">${App.formatIDR(sum.initCredit)}</td>
                <td class="text-right">${App.formatIDR(sum.periodDebit)}</td>
                <td class="text-right">${App.formatIDR(sum.periodCredit)}</td>
                <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(sum.endDebit)}</td>
                <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(sum.endCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // 6. ANALISIS RASIO, EBITDA & OPEX
  renderRatios: async function(container) {
    const res = await fetch(`/api/reports/analysis?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.ratios = data;

    const eb = data.ebitdaAnalysis || {};
    const op = data.opexAnalysis || {};
    const r = data.financialRatios || {};

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- EBITDA STATEMENT -->
        <div class="card-table-wrapper" style="margin-bottom: 0;">
          <div class="table-header-toolbar">
            <div class="table-title"><span>⚡</span> Analisis EBITDA (Operasional Inti)</div>
            <span class="badge badge-gold">Marjin: ${(eb.ebitdaMargin || 0).toFixed(1)}%</span>
          </div>
          <div style="padding: 18px;">
            <table class="coretax-table">
              <tbody>
                <tr>
                  <td>Total Pendapatan (Omzet)</td>
                  <td class="text-right font-weight-bold">${App.formatIDR(eb.revenue)}</td>
                </tr>
                <tr>
                  <td>Harga Pokok Penjualan (HPP)</td>
                  <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(eb.cogs)}</td>
                </tr>
                <tr style="background: #F8FAFC;">
                  <td><strong>Laba Kotor (Gross Profit)</strong></td>
                  <td class="text-right font-weight-bold">${App.formatIDR(eb.grossProfit)}</td>
                </tr>
                <tr>
                  <td>Beban Operasional Kas (Tanpa Penyusutan)</td>
                  <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(eb.opexTotal - eb.depreciationAmortization)}</td>
                </tr>
                <tr class="total-row" style="background: #FEF3C7;">
                  <td style="font-weight: 800; font-size: 13.5px; color: #002B49;">EBITDA (EARNINGS BEFORE INTEREST, TAX, DEP)</td>
                  <td class="text-right font-weight-bold" style="font-size: 14px; color: #B45309;">${App.formatIDR(eb.ebitda)}</td>
                </tr>
                <tr>
                  <td>Beban Penyusutan & Amortisasi (Non-Kas)</td>
                  <td class="text-right" style="color: #DC2626;">- ${App.formatIDR(eb.depreciationAmortization)}</td>
                </tr>
                <tr style="background: #F1F5F9;">
                  <td><strong>Laba Operasi Sebelum Bunga & Pajak (EBIT)</strong></td>
                  <td class="text-right font-weight-bold">${App.formatIDR(eb.ebit)}</td>
                </tr>
                <tr class="total-row" style="background: #D1FAE5;">
                  <td style="font-weight: 800; color: #065F46;">LABA BERSIH (NET PROFIT)</td>
                  <td class="text-right font-weight-bold" style="font-size: 14px; color: #065F46;">${App.formatIDR(eb.netIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- OPEX BREAKDOWN -->
        <div class="card-table-wrapper" style="margin-bottom: 0;">
          <div class="table-header-toolbar">
            <div class="table-title"><span>⚙️</span> Analisis Struktur Beban Operasional (OPEX)</div>
            <span class="badge badge-neutral">Rasio ke Omzet: ${(op.opexRatioToRevenue || 0).toFixed(1)}%</span>
          </div>
          <div style="padding: 18px;">
            <table class="coretax-table">
              <thead>
                <tr>
                  <th>Akun Beban</th>
                  <th class="text-right">Nominal</th>
                  <th class="text-right">% OPEX</th>
                  <th class="text-right">% Omzet</th>
                </tr>
              </thead>
              <tbody>
                ${(op.items || []).map(it => `
                  <tr>
                    <td>${it.name}</td>
                    <td class="text-right">${App.formatIDR(it.amount)}</td>
                    <td class="text-right font-weight-bold">${it.pctOfOpex.toFixed(1)}%</td>
                    <td class="text-right">${it.pctOfRevenue.toFixed(1)}%</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td>TOTAL OPEX</td>
                  <td class="text-right">${App.formatIDR(op.totalOpex)}</td>
                  <td class="text-right">100.0%</td>
                  <td class="text-right">${(op.opexRatioToRevenue || 0).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RATIOS MATRIX -->
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📊</span> Matriks Rasio Keuangan Komprehensif (Auditor Grade)</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 18px;">
          <!-- LIKUIDITAS -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 14px; background: #FFFFFF;">
            <div style="font-weight: 700; color: #002B49; margin-bottom: 10px;">1. Rasio Likuiditas</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Current Ratio:</span>
              <strong>${r.liquidity?.currentRatio} x</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Quick Ratio:</span>
              <strong>${r.liquidity?.quickRatio} x</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Cash Ratio:</span>
              <strong>${r.liquidity?.cashRatio} x</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #E2E8F0;">
              <span>Modal Kerja Bersih (NWC):</span>
              <strong style="color: #059669;">${App.formatIDR(r.liquidity?.netWorkingCapital)}</strong>
            </div>
          </div>

          <!-- SOLVABILITAS -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 14px; background: #FFFFFF;">
            <div style="font-weight: 700; color: #002B49; margin-bottom: 10px;">2. Rasio Solvabilitas (Leverage)</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Debt to Asset (DAR):</span>
              <strong>${r.solvency?.debtToAssetRatio}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Debt to Equity (DER):</span>
              <strong>${r.solvency?.debtToEquityRatio}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Interest Coverage:</span>
              <strong>${r.solvency?.interestCoverageRatio} x</strong>
            </div>
          </div>

          <!-- PROFITABILITAS -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 14px; background: #FFFFFF;">
            <div style="font-weight: 700; color: #002B49; margin-bottom: 10px;">3. Rasio Profitabilitas</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Gross Profit Margin (GPM):</span>
              <strong>${r.profitability?.grossProfitMargin}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Operating Margin (OPM):</span>
              <strong>${r.profitability?.operatingProfitMargin}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Net Profit Margin (NPM):</span>
              <strong>${r.profitability?.netProfitMargin}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #E2E8F0;">
              <span>Return on Equity (ROE):</span>
              <strong style="color: #0284C7;">${r.profitability?.returnOnEquity}%</strong>
            </div>
          </div>

          <!-- AKTIVITAS -->
          <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 14px; background: #FFFFFF;">
            <div style="font-weight: 700; color: #002B49; margin-bottom: 10px;">4. Rasio Aktivitas</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Perputaran Total Aset (TATO):</span>
              <strong>${r.activity?.totalAssetTurnover} x</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Days Sales Outstanding (DSO):</span>
              <strong>${r.activity?.daysSalesOutstanding} Hari</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 7. LAMPIRAN AUDITOR & CALK (AUDITOR PACK)
  renderAuditorPack: async function(container) {
    const res = await fetch(`/api/reports/auditor-pack?entity_id=${App.activeEntity.id}`);
    const data = await res.json();
    this.cache.auditorPack = data;

    container.innerHTML = `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📋</span> Catatan Atas Laporan Keuangan (CALK) & Dokumen Audit Independen</div>
        </div>
        <div style="padding: 20px;">
          ${(data.notes || []).map(n => `
            <div style="margin-bottom: 24px; border-bottom: 1px solid #E2E8F0; padding-bottom: 16px;">
              <h3 style="color: #002B49; font-size: 14px; margin-bottom: 8px;">
                ${n.noteNumber}: ${n.title}
              </h3>
              ${n.content ? `<p style="line-height: 1.6; color: #334155; margin-bottom: 10px;">${n.content}</p>` : ''}
              ${n.items ? `
                <table class="coretax-table" style="margin-top: 8px;">
                  <thead>
                    <tr>
                      <th>Nama Rekening / Komponen</th>
                      <th class="text-right" style="width: 200px;">Jumlah Nilai Tercatat (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${n.items.map(it => `
                      <tr>
                        <td>${it.name || it.invoice_no || it.code}</td>
                        <td class="text-right font-weight-bold">${App.formatIDR(it.balance || it.balance_due || it.acquisition_cost)}</td>
                      </tr>
                    `).join('')}
                    ${n.total ? `
                      <tr class="total-row">
                        <td>TOTAL ${n.title.toUpperCase()}</td>
                        <td class="text-right">${App.formatIDR(n.total || n.totalOutstanding || n.totalCost)}</td>
                      </tr>
                    ` : ''}
                  </tbody>
                </table>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  exportCurrentExcel: function() {
    alert('Mengekspor laporan ke format Microsoft Excel...');
    if (this.currentTab === 'TRIAL_BALANCE' && this.cache.trialBalance) {
      const headers = [
        { key: 'code', label: 'Kode Akun' },
        { key: 'name', label: 'Nama Akun' },
        { key: 'initial_debit', label: 'Saldo Awal Debit', type: 'number' },
        { key: 'initial_credit', label: 'Saldo Awal Kredit', type: 'number' },
        { key: 'period_debit', label: 'Mutasi Debit', type: 'number' },
        { key: 'period_credit', label: 'Mutasi Kredit', type: 'number' },
        { key: 'ending_debit', label: 'Saldo Akhir Debit', type: 'number' },
        { key: 'ending_credit', label: 'Saldo Akhir Kredit', type: 'number' }
      ];
      CoretaxExport.exportToExcel(
        `Trial_Balance_${App.activeEntity.name.replace(/\s+/g, '_')}`,
        'Trial Balance',
        'NERACA SALDO (TRIAL BALANCE)',
        App.activeEntity,
        headers,
        this.cache.trialBalance.rows || []
      );
    } else {
      // General report excel
      window.location.href = `/api/system/download-database`;
    }
  }
};
