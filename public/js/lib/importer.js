/**
 * Coretax Enterprise Accounting - Universal Importer & Template Generator
 * Handles template downloads and smart CSV/Excel data import across all modules.
 * Credit by Harry Sunaryo
 */

window.CoretaxImporter = {
  definitions: {
    entities: {
      title: 'Multi Entitas Perusahaan',
      endpoint: '/api/entities/import',
      fields: [
        { key: 'name', label: 'Nama Entitas' },
        { key: 'npwp', label: 'NPWP (16 Digit)' },
        { key: 'kpp', label: 'KPP Terdaftar' },
        { key: 'fiscal_year', label: 'Tahun Fiskal' },
        { key: 'director_name', label: 'Nama Direktur Utama' },
        { key: 'address', label: 'Alamat Perusahaan' },
        { key: 'phone', label: 'No Telepon' },
        { key: 'email', label: 'Email Resmi' }
      ],
      sampleData: [
        { name: 'PT Sinar Abadi Sentosa', npwp: '01.234.567.8-099.000', kpp: 'KPP Pratama Jakarta Sudirman', fiscal_year: '2026', director_name: 'Harry Sunaryo, S.E.', address: 'Gedung Bursa Efek Tower 1 Lt. 15', phone: '021-5551234', email: 'corp@sinarabadi.co.id' },
        { name: 'CV Makmur Bersama', npwp: '02.345.678.9-088.000', kpp: 'KPP Pratama Surabaya Karangpilang', fiscal_year: '2026', director_name: 'Budi Santoso', address: 'Jl. Rungkut Industri No. 45', phone: '031-8987654', email: 'admin@makmurbts.com' }
      ]
    },

    coa: {
      title: 'Bagan Akun (Chart of Accounts) & Saldo Awal',
      endpoint: '/api/accounts/import',
      fields: [
        { key: 'code', label: 'Kode Akun' },
        { key: 'name', label: 'Nama Akun Rekening' },
        { key: 'category', label: 'Kategori (ASET_LANCAR/ASET_TETAP/KEWAJIBAN_LANCAR/KEWAJIBAN_JK_PANJANG/EKUITAS/PENDAPATAN/HPP/BEBAN_OPERASIONAL)' },
        { key: 'sub_category', label: 'Sub-Klasifikasi' },
        { key: 'normal_balance', label: 'Saldo Normal (DEBIT/KREDIT)' },
        { key: 'parent_code', label: 'Kode Akun Induk (Opsional)' },
        { key: 'initial_debit', label: 'Saldo Awal Debit' },
        { key: 'initial_credit', label: 'Saldo Awal Kredit' },
        { key: 'is_tax_deductible', label: 'Deductible (1=Ya/0=Tidak)' },
        { key: 'is_tax_object', label: 'Objek Pajak (1=Ya/0=Tidak)' },
        { key: 'tax_type', label: 'Jenis Pajak (PPN/PPH21/PPH23/PPH4_2)' }
      ],
      sampleData: [
        { code: '1116', name: 'Kas Kasir Surabaya', category: 'ASET_LANCAR', sub_category: 'Kas & Setara Kas', normal_balance: 'DEBIT', parent_code: '1101', initial_debit: '5000000', initial_credit: '0', is_tax_deductible: '1', is_tax_object: '0', tax_type: '' },
        { code: '2111', name: 'Hutang Gaji Karyawan', category: 'KEWAJIBAN_LANCAR', sub_category: 'Hutang Usaha', normal_balance: 'KREDIT', parent_code: '', initial_debit: '0', initial_credit: '12500000', is_tax_deductible: '1', is_tax_object: '0', tax_type: '' },
        { code: '6115', name: 'Beban Konsultan Hukum & Pajak', category: 'BEBAN_OPERASIONAL', sub_category: 'Beban Umum', normal_balance: 'DEBIT', parent_code: '', initial_debit: '0', initial_credit: '0', is_tax_deductible: '1', is_tax_object: '1', tax_type: 'PPH23' }
      ]
    },

    journals: {
      title: 'Jurnal Transaksi Keuangan (Voucher)',
      endpoint: '/api/journals/import',
      fields: [
        { key: 'journal_number', label: 'No Jurnal (Voucher)' },
        { key: 'date', label: 'Tanggal (YYYY-MM-DD)' },
        { key: 'journal_type', label: 'Tipe Jurnal (GENERAL/PURCHASE/SALES/ADJUSTING)' },
        { key: 'reference_no', label: 'No Referensi / Kwitansi' },
        { key: 'description', label: 'Keterangan Transaksi' },
        { key: 'account_code', label: 'Kode Akun' },
        { key: 'debit', label: 'Debit (IDR)' },
        { key: 'credit', label: 'Kredit (IDR)' },
        { key: 'memo', label: 'Memo Baris' }
      ],
      sampleData: [
        { journal_number: 'JU-202602-001', date: '2026-02-15', journal_type: 'GENERAL', reference_no: 'INV-OUT-101', description: 'Pelunasan piutang langganan via BCA', account_code: '1102', debit: '15000000', credit: '0', memo: 'Penerimaan BCA' },
        { journal_number: 'JU-202602-001', date: '2026-02-15', journal_type: 'GENERAL', reference_no: 'INV-OUT-101', description: 'Pelunasan piutang langganan via BCA', account_code: '1105', debit: '0', credit: '15000000', memo: 'Pelunasan PT Utama' },
        { journal_number: 'JU-202602-002', date: '2026-02-16', journal_type: 'PURCHASE', reference_no: 'KWT-SWR-05', description: 'Pembayaran sewa kantor bulanan', account_code: '6104', debit: '10000000', credit: '0', memo: 'Beban Sewa Gedung' },
        { journal_number: 'JU-202602-002', date: '2026-02-16', journal_type: 'PURCHASE', reference_no: 'KWT-SWR-05', description: 'Pembayaran sewa kantor bulanan', account_code: '2106', debit: '0', credit: '1000000', memo: 'Hutang PPh 4(2) Final 10%' },
        { journal_number: 'JU-202602-002', date: '2026-02-16', journal_type: 'PURCHASE', reference_no: 'KWT-SWR-05', description: 'Pembayaran sewa kantor bulanan', account_code: '1102', debit: '0', credit: '9000000', memo: 'Transfer Bank BCA' }
      ]
    },

    inventory: {
      title: 'Persediaan Barang Dagang & Kartu Stok',
      endpoint: '/api/inventory/import',
      fields: [
        { key: 'sku', label: 'Kode SKU' },
        { key: 'name', label: 'Nama Barang Persediaan' },
        { key: 'category', label: 'Kategori Barang' },
        { key: 'unit', label: 'Satuan (PCS/BOX/UNIT/KG)' },
        { key: 'cost_price', label: 'Harga Pokok Beli (HPP)' },
        { key: 'selling_price', label: 'Harga Jual' },
        { key: 'current_stock', label: 'Jumlah Stok Awal' },
        { key: 'min_stock', label: 'Batas Minimum Stok' }
      ],
      sampleData: [
        { sku: 'BRG-ELK-01', name: 'Monitor LED 24 Inch Full HD', category: 'Elektronik & IT', unit: 'UNIT', cost_price: '1450000', selling_price: '1850000', current_stock: '25', min_stock: '5' },
        { sku: 'BRG-ELK-02', name: 'Keyboard Mekanikal USB RGB', category: 'Elektronik & IT', unit: 'PCS', cost_price: '320000', selling_price: '450000', current_stock: '50', min_stock: '10' },
        { sku: 'BRG-ATK-05', name: 'Kertas HVS A4 80gr Rim', category: 'Alat Tulis Kantor', unit: 'BOX', cost_price: '210000', selling_price: '250000', current_stock: '40', min_stock: '8' }
      ]
    },

    contacts: {
      title: 'Kontak Pelanggan & Supplier (Customer / Vendor)',
      endpoint: '/api/rp/import-contacts',
      fields: [
        { key: 'type', label: 'Tipe (CUSTOMER/VENDOR)' },
        { key: 'name', label: 'Nama Perusahaan / Kontak' },
        { key: 'npwp', label: 'NPWP (16 Digit)' },
        { key: 'nik', label: 'NIK KTP' },
        { key: 'email', label: 'Alamat Email' },
        { key: 'phone', label: 'Nomor Telepon' },
        { key: 'address', label: 'Alamat Domisili' },
        { key: 'payment_terms_days', label: 'Termin Pembayaran (Hari)' }
      ],
      sampleData: [
        { type: 'CUSTOMER', name: 'PT Surya Cipta Graha', npwp: '01.999.888.7-011.000', nik: '', email: 'purchasing@suryacipta.co.id', phone: '021-7896541', address: 'Kawasan Industri MM2100 Blok C, Bekasi', payment_terms_days: '30' },
        { type: 'VENDOR', name: 'PT Sumber Logistik Nusantara', npwp: '02.888.777.6-022.000', nik: '', email: 'finance@sumberlogistik.com', phone: '021-3456789', address: 'Tanjung Priok Logistics Center, Jakarta Utara', payment_terms_days: '14' }
      ]
    },

    invoices: {
      title: 'Faktur / Tagihan Piutang & Hutang (AR/AP)',
      endpoint: '/api/rp/import-invoices',
      fields: [
        { key: 'invoice_no', label: 'No Faktur / Tagihan' },
        { key: 'contact_name', label: 'Nama Pelanggan / Vendor' },
        { key: 'invoice_type', label: 'Tipe (AR = Piutang / AP = Hutang)' },
        { key: 'date', label: 'Tanggal Faktur (YYYY-MM-DD)' },
        { key: 'due_date', label: 'Jatuh Tempo (YYYY-MM-DD)' },
        { key: 'subtotal', label: 'Subtotal DPP (IDR)' },
        { key: 'tax_rate', label: 'Tarif PPN (%)' },
        { key: 'tax_amount', label: 'Jumlah PPN (IDR)' },
        { key: 'total_amount', label: 'Total Tagihan (IDR)' },
        { key: 'faktur_pajak_no', label: 'Nomor Faktur Pajak 16 Digit' },
        { key: 'notes', label: 'Keterangan' }
      ],
      sampleData: [
        { invoice_no: 'INV-2026-008', contact_name: 'PT Surya Cipta Graha', invoice_type: 'AR', date: '2026-02-10', due_date: '2026-03-12', subtotal: '50000000', tax_rate: '11', tax_amount: '5500000', total_amount: '55500000', faktur_pajak_no: '010.001-26.00000108', notes: 'Penjualan Perangkat TI Batch 1' },
        { invoice_no: 'TAG-VND-044', contact_name: 'PT Sumber Logistik Nusantara', invoice_type: 'AP', date: '2026-02-12', due_date: '2026-02-26', subtotal: '12000000', tax_rate: '11', tax_amount: '1320000', total_amount: '13320000', faktur_pajak_no: '010.002-26.00000204', notes: 'Biaya Pengiriman Kontainer' }
      ]
    },

    assets: {
      title: 'Daftar Aktiva Tetap & Penyusutan Fiskal',
      endpoint: '/api/assets/import',
      fields: [
        { key: 'code', label: 'Kode Aktiva' },
        { key: 'name', label: 'Nama Aktiva Tetap' },
        { key: 'category', label: 'Kategori (Kendaraan/Peralatan Kantor/Bangunan/Mesin)' },
        { key: 'acquisition_date', label: 'Tanggal Perolehan (YYYY-MM-DD)' },
        { key: 'acquisition_cost', label: 'Harga Perolehan (IDR)' },
        { key: 'salvage_value', label: 'Nilai Residu (IDR)' },
        { key: 'commercial_useful_life_years', label: 'Masa Manfaat Komersial (Tahun)' },
        { key: 'fiscal_group', label: 'Golongan Fiskal (GOL1/GOL2/GOL3/GOL4/BANGUNAN_PERMANEN/NON_DEPRECIABLE)' },
        { key: 'fiscal_rate', label: 'Tarif Fiskal Garis Lurus (%)' },
        { key: 'notes', label: 'Catatan Aktiva' }
      ],
      sampleData: [
        { code: 'AST-KND-03', name: 'Toyota Hilux Double Cabin 4x4', category: 'Kendaraan', acquisition_date: '2026-01-15', acquisition_cost: '420000000', salvage_value: '50000000', commercial_useful_life_years: '8', fiscal_group: 'GOL2', fiscal_rate: '12.5', notes: 'Operasional Lapangan Tambang' },
        { code: 'AST-SRV-02', name: 'Server Dell PowerEdge R750', category: 'Peralatan Kantor', acquisition_date: '2026-01-20', acquisition_cost: '95000000', salvage_value: '5000000', commercial_useful_life_years: '4', fiscal_group: 'GOL1', fiscal_rate: '25', notes: 'Server ERP & Database' }
      ]
    },

    taxes: {
      title: 'Bukti Potong PPh & Faktur Pajak Masukan/Keluaran',
      endpoint: '/api/taxes/import',
      fields: [
        { key: 'tax_type', label: 'Jenis Pajak (PPH21/PPH22/PPH23/PPH4_2/PPN_MASUKAN/PPN_KELUARAN)' },
        { key: 'period_month', label: 'Masa Bulan (1-12)' },
        { key: 'period_year', label: 'Tahun Pajak' },
        { key: 'bukti_potong_no', label: 'No Bukti Potong / Faktur' },
        { key: 'faktur_pajak_no', label: 'No Faktur Pajak Coretax' },
        { key: 'date', label: 'Tanggal Bukti (YYYY-MM-DD)' },
        { key: 'name', label: 'Nama Lawan Transaksi' },
        { key: 'npwp', label: 'NPWP Lawan Transaksi' },
        { key: 'dpp', label: 'Nilai DPP (IDR)' },
        { key: 'tax_rate', label: 'Tarif Pajak (%)' },
        { key: 'tax_amount', label: 'Jumlah Pajak Dipotong/Dipungut (IDR)' },
        { key: 'is_final', label: 'Pajak Final (1=Ya / 0=Biasa)' },
        { key: 'notes', label: 'Keterangan' }
      ],
      sampleData: [
        { tax_type: 'PPH23', period_month: '2', period_year: '2026', bukti_potong_no: 'BP-23-202602-005', faktur_pajak_no: '', date: '2026-02-14', name: 'PT Mitra Jasa Konsultindo', npwp: '01.555.444.3-021.000', dpp: '25000000', tax_rate: '2', tax_amount: '500000', is_final: '0', notes: 'Potong PPh 23 Jasa Manajemen' },
        { tax_type: 'PPN_MASUKAN', period_month: '2', period_year: '2026', bukti_potong_no: '', faktur_pajak_no: '010.000-26.12345678', date: '2026-02-18', name: 'PT Multi Baja Perkasa', npwp: '02.444.333.2-031.000', dpp: '80000000', tax_rate: '11', tax_amount: '8800000', is_final: '0', notes: 'Faktur Pajak Masukan Pembelian Bahan' }
      ]
    },

    psak46: {
      title: 'Koreksi Fiskal & Rekonsiliasi PSAK 46',
      endpoint: '/api/psak46/import',
      fields: [
        { key: 'item_code', label: 'Kode Item Koreksi' },
        { key: 'description', label: 'Uraian Rekonsiliasi Fiskal' },
        { key: 'type', label: 'Jenis (POSITIF / NEGATIF)' },
        { key: 'is_temporary', label: 'Beda Temporer PSAK 46 (1=Ya/0=Beda Tetap)' },
        { key: 'amount', label: 'Jumlah Nominal Koreksi (IDR)' },
        { key: 'notes', label: 'Catatan / Dasar Ketentuan Fiskal' }
      ],
      sampleData: [
        { item_code: 'BIAYA_SANKSI_PAJAK', description: 'Biaya Sanksi Bunga & Denda Pajak (Pasal 9 ayat 1 UU PPh)', type: 'POSITIF', is_temporary: '0', amount: '8500000', notes: 'Koreksi Beda Tetap Positif Tidak Boleh Dikurangkan' },
        { item_code: 'PENURUNAN_NILAI_PERSEDIAAN', description: 'Penyisihan Kerugian Penurunan Nilai Persediaan Pasar', type: 'POSITIF', is_temporary: '1', amount: '22000000', notes: 'Koreksi Beda Temporer (Menimbulkan Aset Pajak Tangguhan PSAK 46)' }
      ]
    }
  },

  // 1. Download CSV or Excel Spreadsheet Template
  downloadTemplate: function(moduleKey, format = 'csv') {
    const def = this.definitions[moduleKey];
    if (!def) {
      alert('Definisi template tidak ditemukan untuk modul: ' + moduleKey);
      return;
    }

    if (format === 'xls') {
      const headers = def.fields.map(f => ({ key: f.key, label: f.label }));
      CoretaxExport.exportToExcel(
        `Template_Impor_${moduleKey.toUpperCase()}`,
        'Template',
        `TEMPLATE IMPOR DATA - ${def.title.toUpperCase()}`,
        App.activeEntity || { name: 'Template Coretax Enterprise' },
        headers,
        def.sampleData
      );
      return;
    }

    // Generate CSV (with UTF-8 BOM so Excel opens cleanly)
    const headerLine = def.fields.map(f => `"${f.label.replace(/"/g, '""')}"`).join(';');
    const sampleLines = def.sampleData.map(row => {
      return def.fields.map(f => {
        const val = row[f.key] || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(';');
    });

    const csvContent = '\uFEFF' + [headerLine, ...sampleLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Impor_${moduleKey.toUpperCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // 2. Universal Import Modal UI
  showImportModal: function(moduleKey, onSuccess) {
    const def = this.definitions[moduleKey];
    if (!def) return;

    const body = `
      <div style="margin-bottom: 16px;">
        <div style="background: #F1F5F9; border-left: 4px solid #002B49; padding: 12px 16px; border-radius: 4px; margin-bottom: 14px;">
          <div style="font-weight: 700; color: #002B49; margin-bottom: 4px;">Langkah Impor Data Cepat:</div>
          <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #334155; line-height: 1.5;">
            <li>Unduh file template resmi terlebih dahulu di bawah.</li>
            <li>Buka template di Microsoft Excel, isi data Anda sesuai format kolom, lalu simpan sebagai file <strong>.CSV</strong> atau <strong>.XLS</strong>.</li>
            <li>Pilih file tersebut atau tempel (paste) isinya pada formulir di bawah ini, lalu klik <strong>Jalankan Impor</strong>.</li>
          </ol>
        </div>

        <!-- TEMPLATE DOWNLOAD BUTTONS -->
        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <button type="button" class="btn btn-outline" style="flex: 1;" onclick="CoretaxImporter.downloadTemplate('${moduleKey}', 'csv')">
            <span>⬇️</span> Unduh Template Format .CSV
          </button>
          <button type="button" class="btn btn-outline" style="flex: 1;" onclick="CoretaxImporter.downloadTemplate('${moduleKey}', 'xls')">
            <span>📊</span> Unduh Template Format Excel (.XLS)
          </button>
        </div>

        <!-- FILE UPLOAD / DRAG & DROP -->
        <div class="form-group">
          <label class="form-label font-weight-bold">Pilih File Hasil Pengisian (CSV / TXT):</label>
          <input type="file" id="importer-file-input" class="form-control" accept=".csv,.txt,.tsv" onchange="CoretaxImporter.handleFileSelected(event, '${moduleKey}')">
        </div>

        <!-- OR PASTE TEXT -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label class="form-label font-weight-bold" style="margin-bottom: 0;">Atau Tempel (Paste) Teks Tabel / CSV Disini:</label>
            <button type="button" class="btn btn-sm btn-outline" onclick="CoretaxImporter.parsePastedText('${moduleKey}')">Periksa Data</button>
          </div>
          <textarea id="importer-text-input" class="form-control" rows="4" placeholder="Tempel baris CSV atau salin tabel Excel langsung di sini..." style="font-family: monospace; font-size: 11px;"></textarea>
        </div>

        <!-- PREVIEW AREA -->
        <div id="importer-preview-area" style="display: none; margin-top: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #059669; font-size: 13px;">✓ Pratinjau Data: <span id="importer-preview-count">0</span> baris terdeteksi</strong>
          </div>
          <div style="max-height: 220px; overflow: auto; border: 1px solid #CBD5E1; border-radius: 4px;">
            <table class="coretax-table" id="importer-preview-table" style="font-size: 11px;">
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="font-size: 11.5px; color: #64748B;">Credit by Harry Sunaryo</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
          <button id="importer-submit-btn" class="btn btn-gold" onclick="CoretaxImporter.executeImport('${moduleKey}')" disabled>
            <span>🚀</span> Jalankan Impor Data
          </button>
        </div>
      </div>
    `;

    App.showModal(`Template & Impor Data: ${def.title}`, body, footer);
    this._parsedData = null;
    this._currentCallback = onSuccess;
  },

  handleFileSelected: function(event, moduleKey) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      document.getElementById('importer-text-input').value = text;
      this.parsePastedText(moduleKey);
    };
    reader.readAsText(file, 'UTF-8');
  },

  parsePastedText: function(moduleKey) {
    const text = document.getElementById('importer-text-input')?.value.trim();
    if (!text) {
      alert('Silakan tempel teks CSV atau pilih file terlebih dahulu.');
      return;
    }

    const def = this.definitions[moduleKey];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    // Detect delimiter (; or , or \t)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes(';') && !firstLine.includes('\t')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';

    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const parsedRows = lines.map(parseLine);
    let dataRows = parsedRows;

    // Check if first row is a header
    const firstRowValues = parsedRows[0].map(v => v.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const isHeader = def.fields.some(f => firstRowValues.includes(f.key.toLowerCase()) || firstRowValues.includes(f.label.toLowerCase().slice(0, 6)));
    if (isHeader) {
      dataRows = parsedRows.slice(1);
    }

    // Map rows to fields
    const mapped = [];
    dataRows.forEach(row => {
      if (row.length === 0 || (row.length === 1 && !row[0])) return;
      const obj = {};
      def.fields.forEach((f, idx) => {
        obj[f.key] = row[idx] !== undefined ? row[idx] : '';
      });
      mapped.push(obj);
    });

    this._parsedData = mapped;

    // Render Preview Table
    const previewArea = document.getElementById('importer-preview-area');
    const tableEl = document.getElementById('importer-preview-table');
    const countEl = document.getElementById('importer-preview-count');
    const submitBtn = document.getElementById('importer-submit-btn');

    if (previewArea && tableEl) {
      countEl.textContent = mapped.length;
      tableEl.querySelector('thead').innerHTML = `
        <tr>
          <th style="width: 30px;">#</th>
          ${def.fields.map(f => `<th>${f.label}</th>`).join('')}
        </tr>
      `;
      tableEl.querySelector('tbody').innerHTML = mapped.slice(0, 20).map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          ${def.fields.map(f => `<td>${escapeXml(String(r[f.key] || '-'))}</td>`).join('')}
        </tr>
      `).join('') + (mapped.length > 20 ? `<tr><td colspan="${def.fields.length + 1}" style="text-align: center; color: #64748B;">... dan ${mapped.length - 20} baris lainnya</td></tr>` : '');

      previewArea.style.display = 'block';
      if (submitBtn) submitBtn.disabled = mapped.length === 0;
    }
  },

  executeImport: async function(moduleKey) {
    const def = this.definitions[moduleKey];
    if (!this._parsedData || this._parsedData.length === 0) {
      alert('Tidak ada data yang valid untuk diimpor');
      return;
    }

    const submitBtn = document.getElementById('importer-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Memproses Impor...`;
    }

    try {
      const res = await fetch(def.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity?.id,
          fiscal_year: App.activeEntity?.fiscal_year || 2026,
          items: this._parsedData
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Terjadi kesalahan saat impor');

      App.toast(result.message || `Berhasil mengimpor ${result.count || this._parsedData.length} data!`, 'success');
      App.closeModal();

      if (typeof this._currentCallback === 'function') {
        this._currentCallback();
      } else {
        App.reloadCurrentModule();
      }
    } catch (err) {
      alert('Gagal impor data: ' + err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>🚀</span> Coba Impor Lagi`;
      }
    }
  }
};
