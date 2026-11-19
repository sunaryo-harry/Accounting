/**
 * Dashboard Module - Coretax Executive Overview
 */

Modules.Dashboard = {
  render: async function(container) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #64748B;">
        <span class="lan-dot" style="display:inline-block; margin-right: 8px;"></span>
        Memuat data dashboard eksekutif...
      </div>
    `;

    try {
      const entParam = App.activeEntity?.id ? `?entity_id=${App.activeEntity.id}` : '';
      const [analysis, arAging, apAging, tb] = await Promise.all([
        App.fetchJson(`/api/reports/analysis${entParam}`).catch(() => ({})),
        App.fetchJson(`/api/rp/aging?type=AR${App.activeEntity?.id ? '&entity_id=' + App.activeEntity.id : ''}`).catch(() => ({ summary: {}, details: [] })),
        App.fetchJson(`/api/rp/aging?type=AP${App.activeEntity?.id ? '&entity_id=' + App.activeEntity.id : ''}`).catch(() => ({ summary: {}, details: [] })),
        App.fetchJson(`/api/reports/trial-balance${entParam}`).catch(() => ({ summary: {}, rows: [] }))
      ]);

      const ebitda = analysis?.ebitdaAnalysis || {};
      const ratios = analysis?.financialRatios || {};

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>🏛️</span> Dashboard Eksekutif & Kepatuhan Pajak
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Tahun Buku: ${App.activeEntity?.fiscal_year} | Standar PSAK & Coretax DJP
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="App.navigate('journals')">
              <span>➕</span> Catat Jurnal
            </button>
            <button class="btn btn-gold" onclick="App.navigate('taxes')">
              <span>⚖️</span> Equalisasi Pajak
            </button>
            <button class="btn btn-primary" onclick="App.navigate('reports')">
              <span>📄</span> Laporan Keuangan
            </button>
          </div>
        </div>

        <!-- KEY STAT CARDS -->
        <div class="grid-cards">
          <div class="stat-card accent-gold">
            <div class="stat-title">EBITDA Periode Berjalan</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(ebitda.ebitda || 0)}</div>
            <div class="stat-sub">Marjin EBITDA: <strong>${(ebitda.ebitdaMargin || 0).toFixed(1)}%</strong> dari Omzet</div>
          </div>

          <div class="stat-card accent-navy">
            <div class="stat-title">Total Pendapatan (Omzet)</div>
            <div class="stat-value">${App.formatIDR(ebitda.revenue || 0)}</div>
            <div class="stat-sub">Laba Bruto: ${App.formatIDR(ebitda.grossProfit || 0)}</div>
          </div>

          <div class="stat-card accent-green">
            <div class="stat-title">Kontrol Piutang Usaha (AR)</div>
            <div class="stat-value" style="color: #059669;">${App.formatIDR(arAging.summary?.totalOutstanding || 0)}</div>
            <div class="stat-sub">Jatuh tempo >30 hari: ${App.formatIDR((arAging.summary?.bucket31_60 || 0) + (arAging.summary?.bucketOver90 || 0))}</div>
          </div>

          <div class="stat-card accent-red">
            <div class="stat-title">Kontrol Hutang Usaha (AP)</div>
            <div class="stat-value" style="color: #DC2626;">${App.formatIDR(apAging.summary?.totalOutstanding || 0)}</div>
            <div class="stat-sub">Jatuh tempo lancar: ${App.formatIDR(apAging.summary?.bucketCurrent || 0)}</div>
          </div>
        </div>

        <!-- SECOND ROW: RATIOS & EBITDA BREAKDOWN -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <!-- FINANCIAL RATIO HIGHLIGHTS -->
          <div class="card-table-wrapper" style="margin-bottom: 0;">
            <div class="table-header-toolbar">
              <div class="table-title"><span>📊</span> Analisis Rasio Keuangan Utama</div>
              <button class="btn btn-sm btn-outline" onclick="App.navigate('reports')">Detail Lengkap</button>
            </div>
            <div style="padding: 16px;">
              <table class="coretax-table">
                <thead>
                  <tr>
                    <th>Indikator Rasio</th>
                    <th class="text-right">Nilai Rasio</th>
                    <th class="text-center">Standar Acuan</th>
                    <th class="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Current Ratio (Likuiditas)</strong></td>
                    <td class="text-right"><strong>${ratios.liquidity?.currentRatio || 0} x</strong></td>
                    <td class="text-center">&gt; 1.50 x</td>
                    <td class="text-center"><span class="badge badge-success">SEHAT</span></td>
                  </tr>
                  <tr>
                    <td><strong>Quick Ratio (Uji Cepat)</strong></td>
                    <td class="text-right"><strong>${ratios.liquidity?.quickRatio || 0} x</strong></td>
                    <td class="text-center">&gt; 1.00 x</td>
                    <td class="text-center"><span class="badge badge-success">SEHAT</span></td>
                  </tr>
                  <tr>
                    <td><strong>Debt to Equity Ratio (DER)</strong></td>
                    <td class="text-right"><strong>${ratios.solvency?.debtToEquityRatio || 0}%</strong></td>
                    <td class="text-center">&lt; 150%</td>
                    <td class="text-center"><span class="badge badge-success">AMAN</span></td>
                  </tr>
                  <tr>
                    <td><strong>Net Profit Margin (NPM)</strong></td>
                    <td class="text-right"><strong>${ratios.profitability?.netProfitMargin || 0}%</strong></td>
                    <td class="text-center">&gt; 5.0%</td>
                    <td class="text-center"><span class="badge badge-success">BAIK</span></td>
                  </tr>
                  <tr>
                    <td><strong>Return on Equity (ROE)</strong></td>
                    <td class="text-right"><strong>${ratios.profitability?.returnOnEquity || 0}%</strong></td>
                    <td class="text-center">&gt; 8.0%</td>
                    <td class="text-center"><span class="badge badge-info">OPTIMAL</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- OPEX & EBITDA STRUCTURE -->
          <div class="card-table-wrapper" style="margin-bottom: 0;">
            <div class="table-header-toolbar">
              <div class="table-title"><span>⚙️</span> Komposisi Beban Operasional (OPEX)</div>
              <span class="badge badge-neutral">Total: ${App.formatIDR(ebitda.opexTotal || 0)}</span>
            </div>
            <div style="padding: 16px;">
              <table class="coretax-table">
                <thead>
                  <tr>
                    <th>Komponen Beban</th>
                    <th class="text-right">Nominal</th>
                    <th class="text-right">% OPEX</th>
                  </tr>
                </thead>
                <tbody>
                  ${(analysis.opexAnalysis?.items || []).slice(0, 5).map(it => `
                    <tr>
                      <td>${it.name}</td>
                      <td class="text-right">${App.formatIDR(it.amount)}</td>
                      <td class="text-right"><strong>${(it.pctOfOpex || 0).toFixed(1)}%</strong></td>
                    </tr>
                  `).join('') || `<tr><td colspan="3" class="text-center">Belum ada transaksi beban</td></tr>`}
                </tbody>
              </table>
              <div style="margin-top: 14px; padding: 10px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; font-size: 11.5px; color: #92400E;">
                💡 <strong>Catatan Fiskal & Auditor:</strong> Beban natura dan jamuan tanpa nominatif secara otomatis dipisahkan sebagai koreksi positif pada rekonsiliasi fiskal dan perhitungan PSAK 46.
              </div>
            </div>
          </div>
        </div>

        <!-- QUICK ACCESS MODULES GRID -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>🚀</span> Modul Sistem Terintegrasi Coretax</div>
            <span class="badge badge-info">Multi-Entitas & Server LAN Siap Pakai</span>
          </div>
          <div style="padding: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            <div onclick="App.navigate('coa')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📚</div>
              <div style="font-weight: 700; color: #002B49;">Bagan Akun & Saldo Awal</div>
              <div style="font-size: 11.5px; color: #64748B;">Struktur PSAK & input saldo awal entitas seimbang.</div>
            </div>

            <div onclick="App.navigate('journals')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📝</div>
              <div style="font-weight: 700; color: #002B49;">Jurnal & Unggah Bukti</div>
              <div style="font-size: 11.5px; color: #64748B;">Pencatatan jurnal dengan file bukti transaksi GL.</div>
            </div>

            <div onclick="App.navigate('ledger')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📖</div>
              <div style="font-weight: 700; color: #002B49;">Buku Besar (General Ledger)</div>
              <div style="font-size: 11.5px; color: #64748B;">Saldo berjalan per akun dengan tombol preview bukti transaksi.</div>
            </div>

            <div onclick="App.navigate('inventory')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📦</div>
              <div style="font-weight: 700; color: #002B49;">Persediaan & Kartu Stok</div>
              <div style="font-size: 11.5px; color: #64748B;">Mutasi IN/OUT/Opname dengan valuasi Average & HPP.</div>
            </div>

            <div onclick="App.navigate('ar_ap')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">👥</div>
              <div style="font-weight: 700; color: #002B49;">Kontrol Hutang & Piutang</div>
              <div style="font-size: 11.5px; color: #64748B;">Faktur komersial, pelunasan parsial & umur piutang aging.</div>
            </div>

            <div onclick="App.navigate('assets')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">🏢</div>
              <div style="font-weight: 700; color: #002B49;">Daftar Aktiva & Penyusutan</div>
              <div style="font-size: 11.5px; color: #64748B;">Kelompok fiskal Gol 1-4 & bangunan vs komersial.</div>
            </div>

            <div onclick="App.navigate('taxes')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">⚖️</div>
              <div style="font-weight: 700; color: #002B49;">Equalisasi Pajak</div>
              <div style="font-size: 11.5px; color: #64748B;">Equalisasi omzet vs PPN, biaya vs PPh 21, 23, 4(2).</div>
            </div>

            <div onclick="App.navigate('psak46')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📑</div>
              <div style="font-weight: 700; color: #002B49;">Pajak Kini & Tangguhan (PSAK 46)</div>
              <div style="font-size: 11.5px; color: #64748B;">Rekonsiliasi fiskal & perhitungan Aset Pajak Tangguhan (DTA).</div>
            </div>

            <div onclick="App.navigate('spt1771')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📋</div>
              <div style="font-weight: 700; color: #002B49;">SPT Tahunan Badan 1771</div>
              <div style="font-size: 11.5px; color: #64748B;">Formulir 1771 Induk & Lampiran I s.d. VI lengkap.</div>
            </div>

            <div onclick="App.navigate('reports')" style="cursor: pointer; padding: 14px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 20px; margin-bottom: 6px;">📈</div>
              <div style="font-weight: 700; color: #002B49;">Laporan Keuangan & Auditor</div>
              <div style="font-size: 11.5px; color: #64748B;">Neraca, Laba Rugi, Cashflow, Ekuitas, TB & CALK.</div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; padding: 14px; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0;">
          <strong style="color: #002B49;">CORETAX ACCOUNTING SYSTEM ENTERPRISE</strong> &bull; <span style="color: #D97706; font-weight: 700;">Credit by Harry Sunaryo</span>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red" style="padding: 20px;">Gagal memuat data dashboard: ${err.message}</div>`;
    }
  }
};
