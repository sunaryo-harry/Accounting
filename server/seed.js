const { db } = require('./db');

function seedDatabase() {
  const checkEntity = db.prepare('SELECT COUNT(*) as count FROM entities').get();
  if (checkEntity.count > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial enterprise accounting data...');

  // 1. Entities
  const entity1Id = 'ENT-SMS-001';
  const entity2Id = 'ENT-NJA-002';

  db.prepare(`
    INSERT INTO entities (id, name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entity1Id, 'PT Sinar Makmur Sejahtera', '01.234.567.8-012.000', 'KPP Pratama Jakarta Kebayoran Baru', 'Jl. Sudirman Kav. 52-53, Jakarta Selatan', '021-52901234', 'finance@sinarmakmur.co.id', 2026, 'IDR', 'Bambang Soediro, S.E., Ak.',
    entity2Id, 'PT Nusantara Jaya Abadi', '02.345.678.9-034.000', 'KPP Pratama Surabaya Gubeng', 'Jl. Basuki Rahmat No. 88, Surabaya', '031-5345678', 'finance@nusantarajaya.co.id', 2026, 'IDR', 'Hendra Wijaya, M.M.'
  );

  // Set default active entity
  db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('active_entity_id', ?)`).run(entity1Id);

  // 2. Standard PSAK Indonesian Chart of Accounts
  const standardAccounts = [
    // ASET LANCAR (1100)
    { code: '1101', name: 'Kas Utama / Kas Kecil', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Kas & Setara Kas' },
    { code: '1102', name: 'Bank BCA Operasional (IDR)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Kas & Setara Kas' },
    { code: '1103', name: 'Bank Mandiri Payroll (IDR)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Kas & Setara Kas' },
    { code: '1104', name: 'Deposito Berjangka (Jatuh Tempo < 3 Bln)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Kas & Setara Kas' },
    { code: '1105', name: 'Piutang Usaha Pihak Ketiga', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Piutang Usaha' },
    { code: '1106', name: 'Piutang Usaha Pihak Berelasi / Afiliasi', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Piutang Usaha' },
    { code: '1107', name: 'Cadangan Kerugian Penurunan Nilai Piutang (CKPN)', category: 'ASET_LANCAR', normal: 'KREDIT', sub: 'Piutang Usaha' },
    { code: '1108', name: 'Persediaan Barang Dagang (Inventory)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Persediaan' },
    { code: '1109', name: 'Persediaan Bahan Baku / Perlengkapan', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Persediaan' },
    { code: '1110', name: 'Uang Muka Pembelian (Vendor Advance)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Uang Muka' },
    { code: '1111', name: 'Beban Dibayar Dimuka (Sewa/Asuransi)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Biaya Dibayar Dimuka' },
    { code: '1112', name: 'PPN Masukan (Dapat Dikreditkan)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Pajak Dibayar Dimuka', tax_type: 'PPN' },
    { code: '1113', name: 'Uang Muka PPh 22 (Impor/Bendahara)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Pajak Dibayar Dimuka', tax_type: 'PPH22' },
    { code: '1114', name: 'Uang Muka PPh 23 (Bukti Potong PPh 23)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Pajak Dibayar Dimuka', tax_type: 'PPH23' },
    { code: '1115', name: 'Uang Muka PPh 25 (Angsuran Pajak Bulanan)', category: 'ASET_LANCAR', normal: 'DEBIT', sub: 'Pajak Dibayar Dimuka', tax_type: 'PPH25' },

    // ASET TIDAK LANCAR / ASET TETAP (1200)
    { code: '1201', name: 'Tanah (Hak Milik / HGB)', category: 'ASET_TETAP', normal: 'DEBIT', sub: 'Aktiva Tetap' },
    { code: '1202', name: 'Bangunan Kantor & Pabrik', category: 'ASET_TETAP', normal: 'DEBIT', sub: 'Aktiva Tetap' },
    { code: '1203', name: 'Akumulasi Penyusutan - Bangunan', category: 'ASET_TETAP', normal: 'KREDIT', sub: 'Akumulasi Penyusutan' },
    { code: '1204', name: 'Kendaraan Operasional & Logistik', category: 'ASET_TETAP', normal: 'DEBIT', sub: 'Aktiva Tetap' },
    { code: '1205', name: 'Akumulasi Penyusutan - Kendaraan', category: 'ASET_TETAP', normal: 'KREDIT', sub: 'Akumulasi Penyusutan' },
    { code: '1206', name: 'Mesin & Peralatan Kantor / IT', category: 'ASET_TETAP', normal: 'DEBIT', sub: 'Aktiva Tetap' },
    { code: '1207', name: 'Akumulasi Penyusutan - Peralatan & IT', category: 'ASET_TETAP', normal: 'KREDIT', sub: 'Akumulasi Penyusutan' },
    
    // ASET PAJAK TANGGUHAN PSAK 46 (1300)
    { code: '1301', name: 'Aset Pajak Tangguhan (Deferred Tax Asset - DTA)', category: 'ASET_TETAP', normal: 'DEBIT', sub: 'Aset Pajak Tangguhan' },

    // KEWAJIBAN LANCAR (2100)
    { code: '2101', name: 'Hutang Usaha Pihak Ketiga (AP)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Usaha' },
    { code: '2102', name: 'Hutang Usaha Pihak Afiliasi', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Usaha' },
    { code: '2103', name: 'Hutang PPN Keluaran', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Pajak', tax_type: 'PPN' },
    { code: '2104', name: 'Hutang PPh 21 (Pemotongan Gaji)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Pajak', tax_type: 'PPH21' },
    { code: '2105', name: 'Hutang PPh 23 (Pemotongan Jasa/Sewa)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Pajak', tax_type: 'PPH23' },
    { code: '2106', name: 'Hutang PPh 4 Ayat 2 (Final Konstruksi/Sewa)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Pajak', tax_type: 'PPH4_2' },
    { code: '2107', name: 'Hutang PPh 29 (Kurang Bayar SPT Badan)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Hutang Pajak' },
    { code: '2108', name: 'Beban Akrual / Yang Masih Harus Dibayar', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Beban Akrual' },
    { code: '2109', name: 'Uang Muka Penjualan (Customer Deposit)', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Uang Muka Pelanggan' },
    { code: '2110', name: 'Hutang Bank Jangka Pendek', category: 'KEWAJIBAN_LANCAR', normal: 'KREDIT', sub: 'Pinjaman Bank' },

    // KEWAJIBAN JANGKA PANJANG (2200)
    { code: '2201', name: 'Hutang Bank Investasi Jangka Panjang', category: 'KEWAJIBAN_JK_PANJANG', normal: 'KREDIT', sub: 'Hutang Jangka Panjang' },
    { code: '2202', name: 'Liabilitas Imbalan Pasca Kerja (PSAK 24)', category: 'KEWAJIBAN_JK_PANJANG', normal: 'KREDIT', sub: 'Liabilitas Jangka Panjang' },
    { code: '2203', name: 'Liabilitas Pajak Tangguhan (DTL PSAK 46)', category: 'KEWAJIBAN_JK_PANJANG', normal: 'KREDIT', sub: 'Liabilitas Pajak Tangguhan' },

    // EKUITAS (3100)
    { code: '3101', name: 'Modal Saham Ditempatkan dan Disetor Penuh', category: 'EKUITAS', normal: 'KREDIT', sub: 'Modal Saham' },
    { code: '3102', name: 'Tambahan Modal Disetor (Agio Saham)', category: 'EKUITAS', normal: 'KREDIT', sub: 'Modal Saham' },
    { code: '3201', name: 'Saldo Laba Ditahan - Belum Ditentukan Penggunaannya', category: 'EKUITAS', normal: 'KREDIT', sub: 'Saldo Laba' },
    { code: '3202', name: 'Laba (Rugi) Periode Berjalan', category: 'EKUITAS', normal: 'KREDIT', sub: 'Saldo Laba' },
    { code: '3203', name: 'Dividen Dibagikan', category: 'EKUITAS', normal: 'DEBIT', sub: 'Dividen' },

    // PENDAPATAN (4100)
    { code: '4101', name: 'Pendapatan Penjualan Barang Dagang', category: 'PENDAPATAN', normal: 'KREDIT', sub: 'Pendapatan Usaha', is_tax_object: 1, tax_type: 'PPN' },
    { code: '4102', name: 'Pendapatan Jasa Konsultasi & Layanan', category: 'PENDAPATAN', normal: 'KREDIT', sub: 'Pendapatan Usaha', is_tax_object: 1, tax_type: 'PPN' },
    { code: '4103', name: 'Retur & Penyesuaian Penjualan', category: 'PENDAPATAN', normal: 'DEBIT', sub: 'Pengurang Pendapatan' },
    { code: '4104', name: 'Potongan / Diskon Penjualan', category: 'PENDAPATAN', normal: 'DEBIT', sub: 'Pengurang Pendapatan' },

    // HARGA POKOK PENJUALAN / HPP (5100)
    { code: '5101', name: 'Beban Pokok Penjualan (HPP)', category: 'HPP', normal: 'DEBIT', sub: 'HPP' },
    { code: '5102', name: 'Biaya Pengiriman & Logistik Pembelian', category: 'HPP', normal: 'DEBIT', sub: 'HPP' },
    { code: '5103', name: 'Potongan Pembelian', category: 'HPP', normal: 'KREDIT', sub: 'Pengurang HPP' },

    // BEBAN OPERASIONAL / OPEX (6100)
    { code: '6101', name: 'Beban Gaji, Tunjangan & THR Karyawan', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Personalia', is_tax_object: 1, tax_type: 'PPH21' },
    { code: '6102', name: 'Beban BPJS Ketenagakerjaan & Kesehatan', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Personalia' },
    { code: '6103', name: 'Beban Natura & Kenikmatan Karyawan (Non-Deductible)', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Personalia', is_tax_deductible: 0 },
    { code: '6104', name: 'Beban Sewa Gedung & Kantor', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum', is_tax_object: 1, tax_type: 'PPH4_2' },
    { code: '6105', name: 'Beban Listrik, Air & Internet Telepon', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum' },
    { code: '6106', name: 'Beban Pemeliharaan & Perbaikan Gedung', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum' },
    { code: '6107', name: 'Beban Pemasaran, Iklan & Promosi', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Pemasaran' },
    { code: '6108', name: 'Beban Representasi & Jamuan Tanpa Nominatif (Non-Deductible)', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Pemasaran', is_tax_deductible: 0 },
    { code: '6109', name: 'Beban Jasa Audit, Hukum & Konsultan Pajak', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Profesional', is_tax_object: 1, tax_type: 'PPH23' },
    { code: '6110', name: 'Beban Penyusutan Komersial Aktiva Tetap', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Penyusutan' },
    { code: '6111', name: 'Beban Perjalanan Dinas & Transportasi', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum' },
    { code: '6112', name: 'Beban Perlengkapan & Alat Tulis Kantor (ATK)', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum' },
    { code: '6113', name: 'Beban Kerugian Penurunan Nilai Piutang (CKPN)', category: 'BEBAN_OPERASIONAL', normal: 'DEBIT', sub: 'Beban Operasional Umum', is_tax_deductible: 0 },

    // PENDAPATAN & BEBAN LAIN-LAIN (7100 / 7200)
    { code: '7101', name: 'Pendapatan Bunga Deposito & Giro (PPh Final)', category: 'PENDAPATAN_LAIN', normal: 'KREDIT', sub: 'Pendapatan Lain', is_tax_deductible: 0, tax_type: 'PPH4_2' },
    { code: '7102', name: 'Keuntungan Selisih Kurs Valuta Asing', category: 'PENDAPATAN_LAIN', normal: 'KREDIT', sub: 'Pendapatan Lain' },
    { code: '7201', name: 'Beban Bunga Pinjaman Bank', category: 'BEBAN_LAIN', normal: 'DEBIT', sub: 'Beban Keuangan' },
    { code: '7202', name: 'Beban Administrasi Bank & Buku Cek', category: 'BEBAN_LAIN', normal: 'DEBIT', sub: 'Beban Keuangan' },
    { code: '7203', name: 'Sanksi Administrasi & Bunga Pajak (Non-Deductible)', category: 'BEBAN_LAIN', normal: 'DEBIT', sub: 'Beban Lain', is_tax_deductible: 0 },

    // BEBAN PAJAK PENGHASILAN (8100)
    { code: '8101', name: 'Beban Pajak Penghasilan Badan - Kini (Current Tax)', category: 'PAJAK', normal: 'DEBIT', sub: 'Pajak Penghasilan' },
    { code: '8102', name: 'Beban (Manfaat) Pajak Tangguhan (Deferred Tax - PSAK 46)', category: 'PAJAK', normal: 'DEBIT', sub: 'Pajak Penghasilan' }
  ];

  const insertAccountStmt = db.prepare(`
    INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object, tax_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert standard accounts for both entities
  const accountMapE1 = {};
  for (const acc of standardAccounts) {
    const id1 = `ACC-E1-${acc.code}`;
    insertAccountStmt.run(
      id1, entity1Id, acc.code, acc.name, acc.category, acc.sub, acc.normal, null, 1,
      acc.is_tax_deductible !== undefined ? acc.is_tax_deductible : 1,
      acc.is_tax_object !== undefined ? acc.is_tax_object : 0,
      acc.tax_type || null
    );
    accountMapE1[acc.code] = id1;

    const id2 = `ACC-E2-${acc.code}`;
    insertAccountStmt.run(
      id2, entity2Id, acc.code, acc.name, acc.category, acc.sub, acc.normal, null, 1,
      acc.is_tax_deductible !== undefined ? acc.is_tax_deductible : 1,
      acc.is_tax_object !== undefined ? acc.is_tax_object : 0,
      acc.tax_type || null
    );
  }

  // 3. Saldo Awal (Opening Balance) per 01-Jan-2026 for PT Sinar Makmur Sejahtera (Balanced)
  const initialBalances = [
    { code: '1101', debit: 45000000, credit: 0 },     // Kas: 45 Juta
    { code: '1102', debit: 850000000, credit: 0 },    // Bank BCA: 850 Juta
    { code: '1103', debit: 120000000, credit: 0 },    // Bank Mandiri: 120 Juta
    { code: '1104', debit: 500000000, credit: 0 },    // Deposito: 500 Juta
    { code: '1105', debit: 380000000, credit: 0 },    // Piutang Usaha: 380 Juta
    { code: '1107', debit: 0, credit: 15000000 },     // CKPN Piutang: 15 Juta (Kredit)
    { code: '1108', debit: 420000000, credit: 0 },    // Persediaan: 420 Juta
    { code: '1111', debit: 36000000, credit: 0 },     // Sewa Dibayar Dimuka: 36 Juta
    { code: '1201', debit: 1500000000, credit: 0 },   // Tanah: 1.5 Milyar
    { code: '1202', debit: 2000000000, credit: 0 },   // Bangunan: 2.0 Milyar
    { code: '1203', debit: 0, credit: 300000000 },    // Akumulasi Peny. Bangunan: 300 Juta
    { code: '1204', debit: 650000000, credit: 0 },    // Kendaraan: 650 Juta
    { code: '1205', debit: 0, credit: 210000000 },    // Akumulasi Peny. Kendaraan: 210 Juta
    { code: '1206', debit: 350000000, credit: 0 },    // Mesin & IT: 350 Juta
    { code: '1207', debit: 0, credit: 140000000 },    // Akumulasi Peny. IT: 140 Juta
    { code: '1301', debit: 28500000, credit: 0 },     // Aset Pajak Tangguhan (DTA): 28.5 Juta
    
    // Kewajiban
    { code: '2101', debit: 0, credit: 275000000 },    // Hutang Usaha: 275 Juta
    { code: '2104', debit: 0, credit: 18500000 },     // Hutang PPh 21: 18.5 Juta
    { code: '2108', debit: 0, credit: 41000000 },     // Beban Akrual: 41 Juta
    { code: '2201', debit: 0, credit: 1200000000 },   // Hutang Bank JK Panjang: 1.2 Milyar
    { code: '2202', debit: 0, credit: 90000000 },     // Liabilitas Imbalan Pasca Kerja: 90 Juta

    // Ekuitas
    { code: '3101', debit: 0, credit: 3500000000 },   // Modal Saham: 3.5 Milyar
    { code: '3102', debit: 0, credit: 500000000 },    // Agio Saham: 500 Juta
    { code: '3201', debit: 0, credit: 740000000 }     // Saldo Laba Ditahan: 740 Juta
  ];

  const insertInitStmt = db.prepare(`
    INSERT INTO initial_balances (id, entity_id, account_id, debit, credit, fiscal_year, as_of_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  initialBalances.forEach((ib, idx) => {
    insertInitStmt.run(
      `IB-E1-${idx + 1}`,
      entity1Id,
      accountMapE1[ib.code],
      ib.debit,
      ib.credit,
      2026,
      '2026-01-01'
    );
  });

  // 4. Contacts (Customers & Vendors)
  const contactsData = [
    { id: 'CUST-001', type: 'CUSTOMER', name: 'PT Megah Sukses Mandiri', npwp: '01.888.777.6-041.000', nik: '', email: 'procurement@megahsukses.co.id', phone: '021-8976543', address: 'Kawasan Industri MM2100 Blok C-4, Cikarang', terms: 30 },
    { id: 'CUST-002', type: 'CUSTOMER', name: 'CV Berkah Anugerah Teknik', npwp: '02.444.333.2-021.000', nik: '', email: 'order@berkahanugerah.com', phone: '022-7231456', address: 'Jl. Soekarno Hatta No. 420, Bandung', terms: 45 },
    { id: 'CUST-003', type: 'CUSTOMER', name: 'PT Global Solusi Digital', npwp: '03.222.111.4-055.000', nik: '', email: 'finance@globalsolusi.co.id', phone: '021-3004567', address: 'Sudirman Central Business District (SCBD) Lot 11, Jakarta', terms: 30 },
    
    { id: 'VEND-001', type: 'VENDOR', name: 'PT Prima Logistik Kencana', npwp: '01.555.666.7-011.000', nik: '', email: 'billing@primalogistik.co.id', phone: '021-4567890', address: 'Jl. Pelabuhan Tanjung Priok No. 12, Jakarta Utara', terms: 30 },
    { id: 'VEND-002', type: 'VENDOR', name: 'PT Sumber Makmur Elektronik', npwp: '02.777.888.9-073.000', nik: '', email: 'sales@sumbermakmur.com', phone: '021-6543210', address: 'Komplek Mangga Dua Square Blok B-18, Jakarta Pusat', terms: 30 },
    { id: 'VEND-003', type: 'VENDOR', name: 'KAP Hartanto, Gunawan & Rekan', npwp: '03.999.888.7-015.000', nik: '', email: 'office@hgr-audit.com', phone: '021-5790888', address: 'Gedung Menara Batavia Lt. 18, Jl. K.H. Mas Mansyur, Jakarta', terms: 14 }
  ];

  const insertContactStmt = db.prepare(`
    INSERT INTO contacts (id, entity_id, type, name, npwp, nik, email, phone, address, payment_terms_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  contactsData.forEach(c => {
    insertContactStmt.run(c.id, entity1Id, c.type, c.name, c.npwp, c.nik, c.email, c.phone, c.address, c.terms);
  });

  // 5. Inventory Items & Transactions
  const inventoryItems = [
    { id: 'ITEM-001', sku: 'SRV-DL-R750', name: 'Server Dell PowerEdge R750 Xeon Silver', category: 'Hardware IT', unit: 'UNIT', cost: 72000000, sell: 95000000, stock: 8, min: 2 },
    { id: 'ITEM-002', sku: 'RTR-CIS-9300', name: 'Switch Cisco Catalyst 9300 48-Port PoE+', category: 'Network Hardware', unit: 'UNIT', cost: 38000000, sell: 52000000, stock: 15, min: 3 },
    { id: 'ITEM-003', sku: 'FW-FG-100F', name: 'Fortinet FortiGate 100F Next-Gen Firewall', category: 'Security Appliance', unit: 'UNIT', cost: 45000000, sell: 62000000, stock: 10, min: 2 },
    { id: 'ITEM-004', sku: 'UPS-APC-3KVA', name: 'APC Smart-UPS RT 3000VA 230V Rackmount', category: 'Power IT', unit: 'UNIT', cost: 16500000, sell: 23000000, stock: 20, min: 5 }
  ];

  const insertItemStmt = db.prepare(`
    INSERT INTO inventory_items (id, entity_id, sku, name, category, unit, cost_price, selling_price, current_stock, min_stock, valuation_method, inventory_account_id, cogs_account_id, sales_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  inventoryItems.forEach(item => {
    insertItemStmt.run(
      item.id, entity1Id, item.sku, item.name, item.category, item.unit, item.cost, item.sell, item.stock, item.min, 'AVERAGE',
      accountMapE1['1108'], accountMapE1['5101'], accountMapE1['4101']
    );
  });

  // 6. Fixed Assets (Daftar Aktiva Tetap & Penyusutan Fiskal)
  const fixedAssetsData = [
    {
      id: 'FA-001', code: 'AST-BLD-01', name: 'Gedung Kantor Pusat Sudirman 4 Lantai', category: 'Bangunan',
      acqDate: '2023-01-15', cost: 2000000000, salvage: 200000000,
      commLife: 20, fiscalGroup: 'BANGUNAN_PERMANEN', fiscalRate: 0.05,
      assetAcc: accountMapE1['1202'], accumAcc: accountMapE1['1203'], expAcc: accountMapE1['6110']
    },
    {
      id: 'FA-002', code: 'AST-VEH-01', name: 'Toyota Fortuner 2.8 VRZ (Operasional Direksi)', category: 'Kendaraan',
      acqDate: '2023-06-10', cost: 650000000, salvage: 50000000,
      commLife: 8, fiscalGroup: 'GOL2', fiscalRate: 0.125, // Golongan 2 Fiskal = 8 tahun (12.5%)
      assetAcc: accountMapE1['1204'], accumAcc: accountMapE1['1205'], expAcc: accountMapE1['6110']
    },
    {
      id: 'FA-003', code: 'AST-IT-01', name: 'Data Center Core Infrastructure & SAN Storage', category: 'Peralatan & IT',
      acqDate: '2024-03-01', cost: 350000000, salvage: 10000000,
      commLife: 4, fiscalGroup: 'GOL1', fiscalRate: 0.25, // Golongan 1 Fiskal = 4 tahun (25%)
      assetAcc: accountMapE1['1206'], accumAcc: accountMapE1['1207'], expAcc: accountMapE1['6110']
    }
  ];

  const insertAssetStmt = db.prepare(`
    INSERT INTO fixed_assets (id, entity_id, code, name, category, acquisition_date, acquisition_cost, salvage_value, commercial_method, commercial_useful_life_years, fiscal_group, fiscal_method, fiscal_rate, asset_account_id, accum_deprec_account_id, deprec_expense_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  fixedAssetsData.forEach(fa => {
    insertAssetStmt.run(
      fa.id, entity1Id, fa.code, fa.name, fa.category, fa.acqDate, fa.cost, fa.salvage, 'STRAIGHT_LINE', fa.commLife, fa.fiscalGroup, 'STRAIGHT_LINE', fa.fiscalRate, fa.assetAcc, fa.accumAcc, fa.expAcc
    );
  });

  // 7. Invoices (AR / AP for Kontrol Hutang dan Piutang)
  const invoicesData = [
    {
      id: 'INV-AR-001', contactId: 'CUST-001', type: 'AR', invoiceNo: 'INV/2026/02/0018',
      date: '2026-02-10', dueDate: '2026-03-12', subtotal: 190000000, taxRate: 11, taxAmount: 20900000,
      total: 210900000, paid: 100000000, balance: 110900000, status: 'PARTIAL',
      fakturPajak: '010.001-26.12345678', notes: 'Pengadaan Server Dell 2 Unit untuk Data Center Cikarang'
    },
    {
      id: 'INV-AR-002', contactId: 'CUST-002', type: 'AR', invoiceNo: 'INV/2026/02/0025',
      date: '2026-02-18', dueDate: '2026-04-04', subtotal: 156000000, taxRate: 11, taxAmount: 17160000,
      total: 173160000, paid: 0, balance: 173160000, status: 'UNPAID',
      fakturPajak: '010.001-26.12345679', notes: 'Pengadaan Switch Cisco 3 Unit'
    },
    {
      id: 'INV-AP-001', contactId: 'VEND-002', type: 'AP', invoiceNo: 'BILL/SM/2026/0122',
      date: '2026-02-05', dueDate: '2026-03-07', subtotal: 144000000, taxRate: 11, taxAmount: 15840000,
      total: 159840000, paid: 159840000, balance: 0, status: 'PAID',
      fakturPajak: '010.002-26.87654321', notes: 'Pembelian Restock FortiGate Firewall'
    },
    {
      id: 'INV-AP-002', contactId: 'VEND-003', type: 'AP', invoiceNo: 'INV-AUDIT-2026-09',
      date: '2026-02-20', dueDate: '2026-03-06', subtotal: 65000000, taxRate: 11, taxAmount: 7150000,
      total: 72150000, paid: 0, balance: 72150000, status: 'UNPAID',
      fakturPajak: '010.003-26.98765432', notes: 'Jasa Audit Laporan Keuangan Tahunan KAP HGR (Objek PPh 23 2%)'
    }
  ];

  const insertInvoiceStmt = db.prepare(`
    INSERT INTO invoices (id, entity_id, contact_id, invoice_type, invoice_no, date, due_date, subtotal, tax_amount, tax_rate, total_amount, paid_amount, balance_due, status, faktur_pajak_no, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  invoicesData.forEach(inv => {
    insertInvoiceStmt.run(
      inv.id, entity1Id, inv.contactId, inv.type, inv.invoiceNo, inv.date, inv.dueDate,
      inv.subtotal, inv.taxAmount, inv.taxRate, inv.total, inv.paid, inv.balance, inv.status, inv.fakturPajak, inv.notes
    );
  });

  // 8. Sample Journals with Source Attachments and Items
  const journalsData = [
    {
      id: 'JRN-2026-001', num: 'JU-202602-0001', date: '2026-02-10', type: 'SALES', ref: 'INV/2026/02/0018',
      desc: 'Penjualan Server Dell 2 Unit ke PT Megah Sukses Mandiri (Faktur Pajak 010.001-26.12345678)',
      total: 210900000, attachPath: '/uploads/sample_faktur_pajak_keluaran.pdf', attachName: 'Faktur_Pajak_Keluaran_PT_Megah.pdf',
      items: [
        { acc: '1105', debit: 210900000, credit: 0, memo: 'Piutang Usaha PT Megah Sukses' },
        { acc: '4101', debit: 0, credit: 190000000, memo: 'Pendapatan Penjualan 2 Unit Server' },
        { acc: '2103', debit: 0, credit: 20900000, memo: 'PPN Keluaran 11% atas Penjualan' }
      ]
    },
    {
      id: 'JRN-2026-002', num: 'JU-202602-0002', date: '2026-02-10', type: 'GENERAL', ref: 'DO-202602-0018',
      desc: 'Pencatatan Beban Pokok Penjualan (HPP) atas Pengeluaran 2 Unit Server Dell',
      total: 144000000, attachPath: '/uploads/sample_surat_jalan.pdf', attachName: 'Surat_Jalan_DO-0018.pdf',
      items: [
        { acc: '5101', debit: 144000000, credit: 0, memo: 'HPP 2 Unit Server @ 72 Juta' },
        { acc: '1108', debit: 0, credit: 144000000, memo: 'Pengurangan Persediaan Barang Dagang' }
      ]
    },
    {
      id: 'JRN-2026-003', num: 'JU-202602-0003', date: '2026-02-15', type: 'CASH_IN', ref: 'BCA-IN-20260215-01',
      desc: 'Penerimaan Pembayaran Sebagian Piutang PT Megah Sukses Mandiri via Transfer BCA',
      total: 100000000, attachPath: '/uploads/sample_bukti_transfer_bca.pdf', attachName: 'Bukti_Transfer_BCA_100Jt.pdf',
      items: [
        { acc: '1102', debit: 100000000, credit: 0, memo: 'Setoran Masuk Rekening BCA Operasional' },
        { acc: '1105', debit: 0, credit: 100000000, memo: 'Pelunasan Sebagian Piutang PT Megah Sukses' }
      ]
    },
    {
      id: 'JRN-2026-004', num: 'JU-202602-0004', date: '2026-02-25', type: 'CASH_OUT', ref: 'PAY-SALARY-202602',
      desc: 'Pembayaran Gaji Karyawan Bulan Februari 2026 & Pemotongan PPh Pasal 21',
      total: 95000000, attachPath: '/uploads/sample_payroll_recap.pdf', attachName: 'Rekapitulasi_Payroll_Feb_2026.pdf',
      items: [
        { acc: '6101', debit: 95000000, credit: 0, memo: 'Beban Gaji Karyawan Kantor & Operasional' },
        { acc: '2104', debit: 0, credit: 4750000, memo: 'Pemotongan Hutang PPh 21 Karyawan' },
        { acc: '1103', debit: 0, credit: 90250000, memo: 'Transfer Kas Keluar via Bank Mandiri Payroll' }
      ]
    },
    {
      id: 'JRN-2026-005', num: 'JU-202602-0005', date: '2026-02-28', type: 'ADJUSTING', ref: 'MEMO-DEP-202602',
      desc: 'Jurnal Penyesuaian Penyusutan Komersial Aktiva Tetap Bulan Februari 2026',
      total: 21562500, attachPath: '/uploads/sample_jadwal_penyusutan.pdf', attachName: 'Perhitungan_Penyusutan_Aktiva.pdf',
      items: [
        { acc: '6110', debit: 21562500, credit: 0, memo: 'Beban Penyusutan Komersial Bulan Feb 2026' },
        { acc: '1203', debit: 0, credit: 7500000, memo: 'Akumulasi Penyusutan Bangunan' },
        { acc: '1205', debit: 0, credit: 6250000, memo: 'Akumulasi Penyusutan Kendaraan' },
        { acc: '1207', debit: 0, credit: 7812500, memo: 'Akumulasi Penyusutan Peralatan & IT' }
      ]
    }
  ];

  const insertJournalStmt = db.prepare(`
    INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name, is_posted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertJournalItemStmt = db.prepare(`
    INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  journalsData.forEach(j => {
    insertJournalStmt.run(j.id, entity1Id, j.num, j.date, j.type, j.ref, j.desc, j.total, j.attachPath, j.attachName, 1);
    j.items.forEach((it, idx) => {
      insertJournalItemStmt.run(`JI-${j.id}-${idx + 1}`, j.id, accountMapE1[it.acc], it.debit, it.credit, it.memo);
    });
  });

  // 9. Tax Withholding & Equalisasi Records
  const taxRecords = [
    {
      id: 'TAX-001', type: 'PPN_KELUARAN', month: 2, year: 2026, date: '2026-02-10', bupot: '', fp: '010.001-26.12345678',
      contactId: 'CUST-001', npwp: '01.888.777.6-041.000', name: 'PT Megah Sukses Mandiri',
      dpp: 190000000, rate: 11, amount: 20900000, final: 0, notes: 'Faktur Pajak Keluaran Penjualan Server'
    },
    {
      id: 'TAX-002', type: 'PPN_MASUKAN', month: 2, year: 2026, date: '2026-02-05', bupot: '', fp: '010.002-26.87654321',
      contactId: 'VEND-002', npwp: '02.777.888.9-073.000', name: 'PT Sumber Makmur Elektronik',
      dpp: 144000000, rate: 11, amount: 15840000, final: 0, notes: 'Faktur Pajak Masukan Pembelian FortiGate'
    },
    {
      id: 'TAX-003', type: 'PPH21', month: 2, year: 2026, date: '2026-02-25', bupot: 'BP-21-202602-001', fp: '',
      contactId: null, npwp: '01.234.567.8-012.000', name: 'Karyawan Tetap (15 Orang)',
      dpp: 95000000, rate: 5, amount: 4750000, final: 0, notes: 'PPh Pasal 21 Masa Februari 2026'
    },
    {
      id: 'TAX-004', type: 'PPH23', month: 2, year: 2026, date: '2026-02-20', bupot: 'BP-23-202602-014', fp: '',
      contactId: 'VEND-003', npwp: '03.999.888.7-015.000', name: 'KAP Hartanto, Gunawan & Rekan',
      dpp: 65000000, rate: 2, amount: 1300000, final: 0, notes: 'PPh Pasal 23 Jasa Audit Akuntan Publik 2%'
    },
    {
      id: 'TAX-005', type: 'PPH4_2', month: 2, year: 2026, date: '2026-02-01', bupot: 'BP-42-202602-002', fp: '',
      contactId: null, npwp: '01.333.444.5-018.000', name: 'PT Gedung Graha Sudirman',
      dpp: 30000000, rate: 10, amount: 3000000, final: 1, notes: 'PPh Final Pasal 4 ayat 2 atas Sewa Ruang Kantor'
    }
  ];

  const insertTaxStmt = db.prepare(`
    INSERT INTO tax_withholdings (id, entity_id, tax_type, period_month, period_year, bukti_potong_no, faktur_pajak_no, date, contact_id, npwp, name, dpp, tax_rate, tax_amount, is_final, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  taxRecords.forEach(t => {
    insertTaxStmt.run(
      t.id, entity1Id, t.type, t.month, t.year, t.bupot, t.fp, t.date, t.contactId, t.npwp, t.name, t.dpp, t.rate, t.amount, t.final, t.notes
    );
  });

  // 10. Fiscal Reconciliations (Koreksi Fiskal Positif & Negatif untuk SPT 1771 & PSAK 46)
  const fiscalRecs = [
    {
      id: 'FISC-001', code: 'NATURA', desc: 'Biaya Natura dan Kenikmatan Bukan Daerah Terpencil (Non-Deductible)',
      type: 'POSITIF', isTemp: 0, amount: 18500000, notes: 'Koreksi Beda Tetap sesuai UU HPP / PMK 66'
    },
    {
      id: 'FISC-002', code: 'SANKSI_PAJAK', desc: 'Sanksi Administrasi Keterlambatan dan Bunga Pajak',
      type: 'POSITIF', isTemp: 0, amount: 4500000, notes: 'Koreksi Beda Tetap Pasal 9 ayat (1) huruf k UU PPh'
    },
    {
      id: 'FISC-003', code: 'JAMUAN_TANPA_NOMINATIF', desc: 'Biaya Jamuan dan Representasi tanpa Daftar Nominatif',
      type: 'POSITIF', isTemp: 0, amount: 12000000, notes: 'Koreksi Beda Tetap Surat Edaran Dirjen Pajak'
    },
    {
      id: 'FISC-004', code: 'BEDA_PENYUSUTAN', desc: 'Selisih Penyusutan Komersial Lebih Besar dari Penyusutan Fiskal',
      type: 'POSITIF', isTemp: 1, amount: 35000000, notes: 'Koreksi Beda Temporer (Menimbulkan Aset Pajak Tangguhan PSAK 46)'
    },
    {
      id: 'FISC-005', code: 'CADANGAN_PIUTANG', desc: 'Beban Cadangan Kerugian Penurunan Nilai Piutang (CKPN)',
      type: 'POSITIF', isTemp: 1, amount: 15000000, notes: 'Koreksi Beda Temporer (Cadangan belum terealisasi)'
    },
    {
      id: 'FISC-006', code: 'BUNGA_DEPOSITO', desc: 'Pendapatan Bunga Deposito Bank (Dikenakan PPh Final Pasal 4 ayat 2)',
      type: 'NEGATIF', isTemp: 0, amount: 24000000, notes: 'Koreksi Beda Tetap Penghasilan Dikenakan Pajak Final'
    }
  ];

  const insertFiscStmt = db.prepare(`
    INSERT INTO fiscal_reconciliations (id, entity_id, fiscal_year, item_code, description, type, is_temporary, amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  fiscalRecs.forEach(f => {
    insertFiscStmt.run(f.id, entity1Id, 2026, f.code, f.desc, f.type, f.isTemp, f.amount, f.notes);
  });

  // 11. SPT 1771 Master Form Data (Lampiran V & VI)
  const sptLampiranV = {
    shareholders: [
      { name: 'PT Mahameru Investama Global', npwp: '01.111.222.3-014.000', address: 'Gedung Bursa Efek Indonesia Tower 2, Jakarta', capital: 2450000000, pct: 70, dividend: 0 },
      { name: 'Bambang Soediro, S.E.', npwp: '08.234.567.8-011.000', address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta', capital: 700000000, pct: 20, dividend: 0 },
      { name: 'Siti Rahmawati, M.B.A.', npwp: '09.345.678.9-022.000', address: 'Jl. Cik Ditiro No. 18, Menteng, Jakarta', capital: 350000000, pct: 10, dividend: 0 }
    ],
    officers: [
      { name: 'Bambang Soediro, S.E., Ak.', npwp: '08.234.567.8-011.000', position: 'Direktur Utama', address: 'Jl. Senopati No. 45, Jakarta Selatan' },
      { name: 'Siti Rahmawati, M.B.A.', npwp: '09.345.678.9-022.000', position: 'Direktur Keuangan & Operasional', address: 'Jl. Cik Ditiro No. 18, Jakarta Pusat' },
      { name: 'Prof. Dr. Ir. Gunawan Wibisono', npwp: '07.123.456.7-019.000', position: 'Komisaris Utama', address: 'Jl. Brawijaya Raya No. 12, Jakarta Selatan' }
    ]
  };

  db.prepare(`
    INSERT INTO spt_1771_data (id, entity_id, fiscal_year, section, data_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('SPT-E1-2026-V', entity1Id, 2026, 'LAMPIRAN_V', JSON.stringify(sptLampiranV));

  console.log('Seeding completed successfully!');
}

module.exports = { seedDatabase };
