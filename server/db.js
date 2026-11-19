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

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      tx_type TEXT NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
      qty REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      reference_no TEXT,
      notes TEXT,
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
  `);
}

initSchema();

module.exports = {
  db,
  dbPath
};
