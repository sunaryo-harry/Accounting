const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'accounting.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      npwp TEXT NOT NULL,
      kpp TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      fiscal_year INTEGER DEFAULT 2026,
      currency TEXT DEFAULT 'IDR',
      director_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT,
      normal_balance TEXT NOT NULL, -- 'DEBIT' or 'KREDIT'
      parent_code TEXT,
      level INTEGER DEFAULT 1,
      is_tax_deductible INTEGER DEFAULT 1,
      is_tax_object INTEGER DEFAULT 0,
      tax_type TEXT, -- 'PPH21', 'PPH23', 'PPH4_2', 'PPN', 'NON_OBJEK'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS initial_balances (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      fiscal_year INTEGER DEFAULT 2026,
      as_of_date TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      journal_number TEXT NOT NULL,
      date TEXT NOT NULL,
      journal_type TEXT DEFAULT 'GENERAL', -- 'GENERAL', 'ADJUSTING', 'CLOSING', 'PURCHASE', 'SALES', 'CASH_IN', 'CASH_OUT', 'TAX', 'DEPRECIATION'
      reference_no TEXT,
      description TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      attachment_path TEXT,
      attachment_name TEXT,
      is_posted INTEGER DEFAULT 1,
      created_by TEXT DEFAULT 'Admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS journal_items (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      memo TEXT,
      FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'PCS',
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 5,
      valuation_method TEXT DEFAULT 'AVERAGE',
      inventory_account_id TEXT,
      cogs_account_id TEXT,
      sales_account_id TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      pic TEXT,
      inventory_account_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_warehouse_stocks (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      stock REAL DEFAULT 0,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      UNIQUE(entity_id, item_id, warehouse_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      tx_type TEXT NOT NULL, -- 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'
      qty REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      warehouse_id TEXT,
      from_warehouse_id TEXT,
      to_warehouse_id TEXT,
      contra_account_id TEXT,
      reference_no TEXT,
      notes TEXT,
      attachment_path TEXT,
      attachment_name TEXT,
      journal_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'CUSTOMER', 'VENDOR', 'EMPLOYEE', 'SHAREHOLDER'
      name TEXT NOT NULL,
      npwp TEXT,
      nik TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      payment_terms_days INTEGER DEFAULT 30,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      invoice_type TEXT NOT NULL, -- 'AR' or 'AP'
      invoice_no TEXT NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 11,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      status TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'
      faktur_pajak_no TEXT,
      attachment_path TEXT,
      attachment_name TEXT,
      journal_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'BANK_TRANSFER',
      account_id TEXT NOT NULL,
      reference_no TEXT,
      journal_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fixed_assets (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      acquisition_date TEXT NOT NULL,
      acquisition_cost REAL NOT NULL,
      salvage_value REAL DEFAULT 0,
      commercial_method TEXT DEFAULT 'STRAIGHT_LINE',
      commercial_useful_life_years REAL NOT NULL,
      fiscal_group TEXT NOT NULL, -- 'GOL1', 'GOL2', 'GOL3', 'GOL4', 'BANGUNAN_PERMANEN', 'BANGUNAN_SEMI', 'NON_DEPRECIABLE'
      fiscal_method TEXT DEFAULT 'STRAIGHT_LINE',
      fiscal_rate REAL NOT NULL,
      asset_account_id TEXT,
      accum_deprec_account_id TEXT,
      deprec_expense_account_id TEXT,
      notes TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tax_withholdings (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      tax_type TEXT NOT NULL, -- 'PPH21', 'PPH22', 'PPH23', 'PPH4_2', 'PPH25', 'PPN_MASUKAN', 'PPN_KELUARAN'
      period_month INTEGER NOT NULL,
      period_year INTEGER NOT NULL,
      bukti_potong_no TEXT,
      faktur_pajak_no TEXT,
      date TEXT NOT NULL,
      contact_id TEXT,
      npwp TEXT,
      name TEXT,
      dpp REAL NOT NULL,
      tax_rate REAL NOT NULL,
      tax_amount REAL NOT NULL,
      is_final INTEGER DEFAULT 0,
      journal_id TEXT,
      attachment_path TEXT,
      attachment_name TEXT,
      notes TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fiscal_reconciliations (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      fiscal_year INTEGER NOT NULL,
      item_code TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL, -- 'POSITIF' or 'NEGATIF'
      is_temporary INTEGER DEFAULT 0, -- 1 for Temporary Difference (PSAK 46 DTA/DTL), 0 for Permanent Difference
      amount REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS spt_1771_data (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      fiscal_year INTEGER NOT NULL,
      section TEXT NOT NULL, -- 'INDUK', 'LAMPIRAN_I', 'LAMPIRAN_II', 'LAMPIRAN_III', 'LAMPIRAN_IV', 'LAMPIRAN_V', 'LAMPIRAN_VI'
      data_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      UNIQUE(entity_id, fiscal_year, section)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERATOR',
      permissions TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- PSAK 69 (AGRIKULTUR) & LAPORAN PENILAIAN INDEPENDEN KJPP
    -- ============================================================
    CREATE TABLE IF NOT EXISTS biological_assets (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL, -- 'PERKEBUNAN', 'KEHUTANAN', 'PETERNAKAN', 'PERIKANAN'
      sub_category TEXT,      -- 'Kelapa Sawit (TBS)', 'Karet (Lateks)', 'Kayu Sengon', 'Sapi Perah', dll.
      maturity_stage TEXT NOT NULL DEFAULT 'MATURE', -- 'IMMATURE' (TBM), 'MATURE' (TM)
      unit TEXT NOT NULL DEFAULT 'HA', -- 'HA', 'POHON', 'EKOR', 'KG'
      quantity REAL NOT NULL DEFAULT 0,
      planted_year INTEGER,
      location TEXT,
      cost_balance REAL DEFAULT 0,       -- Nilai Tercatat Historis / Biaya Perolehan (Rp)
      fair_value_balance REAL DEFAULT 0, -- Nilai Wajar Bersih Terkini / FVLCTS (Rp)
      asset_account_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS kjpp_appraisals (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      valuation_date TEXT NOT NULL,
      kjpp_name TEXT NOT NULL,
      kjpp_license_no TEXT,
      lead_valuer_name TEXT,
      report_number TEXT NOT NULL,
      valuation_purpose TEXT DEFAULT 'Pelaporan Keuangan PSAK 69 / SPI 2024',
      valuation_standard TEXT DEFAULT 'SPI 2024 & PSAK 69 Agrikultur',
      valuation_method TEXT NOT NULL DEFAULT 'INCOME_DCF', -- 'INCOME_DCF', 'MARKET_APPROACH', 'COST_APPROACH'
      discount_rate_wacc REAL DEFAULT 11.5,   -- WACC %
      costs_to_sell_rate REAL DEFAULT 2.5,    -- Biaya Menjual %
      commodity_price_benchmark TEXT,         -- Tolok ukur harga pasar komoditas
      notes TEXT,
      attachment_path TEXT,
      attachment_name TEXT,
      status TEXT DEFAULT 'COMPLETED',        -- 'DRAFT', 'COMPLETED', 'POSTED'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kjpp_appraisal_items (
      id TEXT PRIMARY KEY,
      appraisal_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      book_value_before REAL NOT NULL,
      gross_fair_value REAL NOT NULL,
      costs_to_sell REAL NOT NULL,
      net_fair_value REAL NOT NULL,
      fair_value_adjustment REAL NOT NULL,
      physical_change_amount REAL DEFAULT 0,
      price_change_amount REAL DEFAULT 0,
      journal_id TEXT,
      FOREIGN KEY (appraisal_id) REFERENCES kjpp_appraisals(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES biological_assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS biological_asset_movements (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      date TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- 'INITIAL', 'ADDITION_PURCHASE', 'DEVELOPMENT_COST', 'FAIR_VALUE_GAIN_PHYSICAL', 'FAIR_VALUE_GAIN_PRICE', 'FAIR_VALUE_LOSS_PHYSICAL', 'FAIR_VALUE_LOSS_PRICE', 'HARVEST_DECREASE', 'DISPOSAL'
      amount REAL NOT NULL,
      quantity_delta REAL DEFAULT 0,
      reference_no TEXT,
      description TEXT,
      journal_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES biological_assets(id) ON DELETE CASCADE
    );
  `);

  // Migrate columns for inventory_transactions if table was already created earlier
  try {
    const invCols = db.prepare(`PRAGMA table_info(inventory_transactions)`).all().map(c => c.name);
    if (!invCols.includes('warehouse_id')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN warehouse_id TEXT;`);
    }
    if (!invCols.includes('from_warehouse_id')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN from_warehouse_id TEXT;`);
    }
    if (!invCols.includes('to_warehouse_id')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN to_warehouse_id TEXT;`);
    }
    if (!invCols.includes('contra_account_id')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN contra_account_id TEXT;`);
    }
    if (!invCols.includes('attachment_path')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN attachment_path TEXT;`);
    }
    if (!invCols.includes('attachment_name')) {
      db.exec(`ALTER TABLE inventory_transactions ADD COLUMN attachment_name TEXT;`);
    }
  } catch (mErr) {
    console.error('Column migration note:', mErr.message);
  }

  ensureDefaultWarehouses();
  ensurePsak69Defaults();
}

function ensureDefaultWarehouses() {
  try {
    const entities = db.prepare('SELECT id FROM entities').all();
    entities.forEach(ent => {
      const whCount = db.prepare('SELECT COUNT(*) as count FROM warehouses WHERE entity_id = ?').get(ent.id);
      if (whCount && whCount.count === 0) {
        const wh1 = `WH-${ent.id}-01`;
        const wh2 = `WH-${ent.id}-02`;
        const wh3 = `WH-${ent.id}-03`;
        db.prepare(`
          INSERT INTO warehouses (id, entity_id, code, name, location, pic)
          VALUES 
          (?, ?, 'GDG-PST', 'Gudang Utama / Pusat (Jakarta)', 'Kawasan Industri Pulogadung Blok A-5, Jakarta Timur', 'Joko Susilo'),
          (?, ?, 'GDG-CBG', 'Gudang Cabang / Distribusi (Surabaya)', 'Kawasan Industri Rungkut Kav. 12, Surabaya', 'Agus Prasetyo'),
          (?, ?, 'GDG-TRN', 'Gudang Transit Logistik (Cikarang)', 'Cikarang Dry Port Terminal Hub, Cikarang', 'Hendra Setiawan')
        `).run(wh1, ent.id, wh2, ent.id, wh3, ent.id);

        // Also populate inventory_warehouse_stocks for existing items
        const items = db.prepare('SELECT id, current_stock FROM inventory_items WHERE entity_id = ?').all(ent.id);
        const stockStmt = db.prepare(`
          INSERT OR REPLACE INTO inventory_warehouse_stocks (id, entity_id, item_id, warehouse_id, stock)
          VALUES (?, ?, ?, ?, ?)
        `);
        items.forEach(it => {
          const total = Number(it.current_stock) || 0;
          const mainStock = Math.ceil(total * 0.7);
          const branchStock = Math.max(0, total - mainStock);
          stockStmt.run(`STK-${it.id}-${wh1}`, ent.id, it.id, wh1, mainStock);
          stockStmt.run(`STK-${it.id}-${wh2}`, ent.id, it.id, wh2, branchStock);
          stockStmt.run(`STK-${it.id}-${wh3}`, ent.id, it.id, wh3, 0);
        });
      }
    });
  } catch (err) {
    console.error('Error ensuring default warehouses:', err.message);
  }
}

function ensurePsak69Defaults() {
  try {
    const entities = db.prepare('SELECT id FROM entities').all();
    entities.forEach(ent => {
      // 1. Ensure Standard Accounts for Biological Assets
      const requiredAccounts = [
        { code: '1401', name: 'Aset Biologis - Tanaman Menghasilkan / TM (PSAK 69)', category: 'ASET_LANCAR', sub: 'Aset Biologis', normal: 'DEBIT' },
        { code: '1402', name: 'Aset Biologis - Tanaman Belum Menghasilkan / TBM (PSAK 69)', category: 'ASET_TETAP', sub: 'Aset Biologis Tidak Lancar', normal: 'DEBIT' },
        { code: '7105', name: 'Keuntungan Perubahan Nilai Wajar Aset Biologis (PSAK 69 Fair Value Gain)', category: 'PENDAPATAN_LAIN', sub: 'Pendapatan Lain-lain', normal: 'KREDIT' },
        { code: '7205', name: 'Kerugian Perubahan Nilai Wajar Aset Biologis (PSAK 69 Fair Value Loss)', category: 'BEBAN_LAIN', sub: 'Beban Lain-lain', normal: 'DEBIT' }
      ];

      requiredAccounts.forEach(acc => {
        const exist = db.prepare('SELECT id FROM accounts WHERE entity_id = ? AND code = ?').get(ent.id, acc.code);
        if (!exist) {
          db.prepare(`
            INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, 1, 0)
          `).run(`ACC-${ent.id}-${acc.code}`, ent.id, acc.code, acc.name, acc.category, acc.sub, acc.normal, acc.code.slice(0, 2) + '00');
        }
      });

      // 2. Seed Sample Biological Assets if none exist
      const bioCount = db.prepare('SELECT COUNT(*) as count FROM biological_assets WHERE entity_id = ?').get(ent.id);
      if (bioCount && bioCount.count === 0) {
        const accTM = db.prepare('SELECT id FROM accounts WHERE entity_id = ? AND code = ?').get(ent.id, '1401');
        const accTBM = db.prepare('SELECT id FROM accounts WHERE entity_id = ? AND code = ?').get(ent.id, '1402');

        const b1Id = `BIO-${ent.id}-01`;
        const b2Id = `BIO-${ent.id}-02`;
        const b3Id = `BIO-${ent.id}-03`;

        db.prepare(`
          INSERT INTO biological_assets (id, entity_id, code, name, category, sub_category, maturity_stage, unit, quantity, planted_year, location, cost_balance, fair_value_balance, asset_account_id)
          VALUES 
          (?, ?, 'BIO-KS-TM01', 'Perkebunan Kelapa Sawit Blok A (Tanaman Menghasilkan - TM)', 'PERKEBUNAN', 'Kelapa Sawit (TBS)', 'MATURE', 'HA', 450, 2018, 'Kebun Riau Estate Blok A1-A15', 18000000000, 24750000000, ?),
          (?, ?, 'BIO-KS-TBM02', 'Perkebunan Kelapa Sawit Blok B (Tanaman Belum Menghasilkan - TBM)', 'PERKEBUNAN', 'Kelapa Sawit (TBS)', 'IMMATURE', 'HA', 200, 2024, 'Kebun Riau Estate Blok B1-B8', 5200000000, 6100000000, ?),
          (?, ?, 'BIO-TRK-SP01', 'Populasi Sapi Perah Friesian Holstein Komersial', 'PETERNAKAN', 'Sapi Perah (Susu Segar)', 'MATURE', 'EKOR', 120, 2023, 'Peternakan Lembang Hub', 3600000000, 4450000000, ?)
        `).run(
          b1Id, ent.id, accTM?.id || null,
          b2Id, ent.id, accTBM?.id || null,
          b3Id, ent.id, accTM?.id || null
        );

        // 3. Seed Sample KJPP Appraisal Report
        const app1Id = `KJPP-${ent.id}-2026-S1`;
        db.prepare(`
          INSERT INTO kjpp_appraisals (id, entity_id, valuation_date, kjpp_name, kjpp_license_no, lead_valuer_name, report_number, valuation_purpose, valuation_standard, valuation_method, discount_rate_wacc, costs_to_sell_rate, commodity_price_benchmark, notes, status)
          VALUES (?, ?, '2026-06-30', 'KJPP Rinaldi, Tjahjono & Rekan', 'KMK No. 128/KM.1/2020', 'Ir. Hendra Gunawan, M.Ec.Dev, MAPPI (Cert.)', 'KJPP-RTR/VAL-BIO/2026/06-042', 'Penilaian Nilai Wajar Pelaporan Keuangan PSAK 69 / IFRS', 'Standar Penilaian Indonesia (SPI 2024) & PSAK 69', 'INCOME_DCF', 11.5, 2.5, 'Harga Rata-rata Tender CPO KPBN & TBS Disbun Riau', 'Penilaian aset biologis kelapa sawit dan peternakan sapi perah periode semester I 2026', 'POSTED')
        `).run(app1Id, ent.id);

        // Seed KJPP Appraisal Items
        const insertItem = db.prepare(`
          INSERT INTO kjpp_appraisal_items (id, appraisal_id, asset_id, quantity, book_value_before, gross_fair_value, costs_to_sell, net_fair_value, fair_value_adjustment, physical_change_amount, price_change_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Item 1: Sawit Blok A: Book 22 Miliar, Gross FV 25.38 M, Cost to sell (2.5%) 634.5 Juta, Net FV 24.75 M -> Adj +2.75 M (Fisik 1.65 M, Harga 1.10 M)
        insertItem.run(`KJI-${app1Id}-01`, app1Id, b1Id, 450, 22000000000, 25384615385, 634615385, 24750000000, 2750000000, 1650000000, 1100000000);
        // Item 2: Sawit Blok B: Book 5.5 M, Gross FV 6.25 M, Cost to sell 156.4 M, Net FV 6.10 M -> Adj +600 Juta (Fisik 450 Jt, Harga 150 Jt)
        insertItem.run(`KJI-${app1Id}-02`, app1Id, b2Id, 200, 5500000000, 6256410256, 156410256, 6100000000, 600000000, 450000000, 150000000);
        // Item 3: Sapi Perah: Book 4.1 M, Gross FV 4.56 M, Cost to sell 114 M, Net FV 4.45 M -> Adj +350 Juta (Fisik 250 Jt, Harga 100 Jt)
        insertItem.run(`KJI-${app1Id}-03`, app1Id, b3Id, 120, 4100000000, 4564102564, 114102564, 4450000000, 350000000, 250000000, 100000000);

        // 4. Seed Biological Movements for Paragraf 50 Reconciliation
        const insertMov = db.prepare(`
          INSERT INTO biological_asset_movements (id, entity_id, asset_id, date, movement_type, amount, quantity_delta, reference_no, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Movements for Sawit Blok A
        insertMov.run(`BAM-${b1Id}-01`, ent.id, b1Id, '2026-01-01', 'INITIAL', 22000000000, 450, 'SALDO-AWAL-2026', 'Saldo Awal Nilai Tercatat Aset Biologis');
        insertMov.run(`BAM-${b1Id}-02`, ent.id, b1Id, '2026-06-30', 'FAIR_VALUE_GAIN_PHYSICAL', 1650000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar akibat Pertumbuhan Fisik & Kematangan (PSAK 69)');
        insertMov.run(`BAM-${b1Id}-03`, ent.id, b1Id, '2026-06-30', 'FAIR_VALUE_GAIN_PRICE', 1100000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar akibat Kenaikan Harga Pasar CPO/TBS (PSAK 69)');

        // Movements for Sawit Blok B
        insertMov.run(`BAM-${b2Id}-01`, ent.id, b2Id, '2026-01-01', 'INITIAL', 5500000000, 200, 'SALDO-AWAL-2026', 'Saldo Awal Nilai Tercatat TBM');
        insertMov.run(`BAM-${b2Id}-02`, ent.id, b2Id, '2026-06-30', 'FAIR_VALUE_GAIN_PHYSICAL', 450000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar Pertumbuhan TBM');
        insertMov.run(`BAM-${b2Id}-03`, ent.id, b2Id, '2026-06-30', 'FAIR_VALUE_GAIN_PRICE', 150000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar Kenaikan Harga');

        // Movements for Sapi Perah
        insertMov.run(`BAM-${b3Id}-01`, ent.id, b3Id, '2026-01-01', 'INITIAL', 4100000000, 120, 'SALDO-AWAL-2026', 'Saldo Awal Nilai Tercatat Peternakan Sapi Perah');
        insertMov.run(`BAM-${b3Id}-02`, ent.id, b3Id, '2026-06-30', 'FAIR_VALUE_GAIN_PHYSICAL', 250000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar Pertumbuhan Bobot & Produktivitas Susu');
        insertMov.run(`BAM-${b3Id}-03`, ent.id, b3Id, '2026-06-30', 'FAIR_VALUE_GAIN_PRICE', 100000000, 0, 'KJPP-RTR/VAL-BIO/2026/06-042', 'Keuntungan Nilai Wajar Harga Pasar Sapi Perah');
      }
    });
  } catch (err) {
    console.error('Error ensuring PSAK 69 defaults:', err.message);
  }
}

initSchema();

module.exports = {
  db,
  dbPath,
  ensureDefaultWarehouses,
  ensurePsak69Defaults
};
