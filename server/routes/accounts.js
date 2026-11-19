const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// GET all accounts for an entity
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    if (!entityId) return res.status(400).json({ error: 'Entitas tidak ditemukan' });

    const accounts = db.prepare(`
      SELECT a.*, 
        COALESCE(ib.debit, 0) as initial_debit,
        COALESCE(ib.credit, 0) as initial_credit
      FROM accounts a
      LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ?
      WHERE a.entity_id = ?
      ORDER BY a.code ASC
    `).all(entityId, entityId);

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE account (Expanded with Parent Account & Hierarchy Level)
router.post('/', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { code, name, category, sub_category, normal_balance, parent_code, is_tax_deductible, is_tax_object, tax_type } = req.body;

    if (!code || !name || !category || !normal_balance) {
      return res.status(400).json({ error: 'Kode, Nama, Kategori, dan Saldo Normal wajib diisi' });
    }

    const exists = db.prepare('SELECT id FROM accounts WHERE entity_id = ? AND code = ?').get(entityId, code);
    if (exists) {
      return res.status(400).json({ error: `Kode akun ${code} sudah terdaftar pada entitas ini` });
    }

    let calculatedLevel = 1;
    if (parent_code) {
      const parent = db.prepare('SELECT level FROM accounts WHERE entity_id = ? AND code = ?').get(entityId, parent_code);
      if (parent) {
        calculatedLevel = (parent.level || 1) + 1;
      }
    } else {
      // Auto level based on code length or dots
      if (code.includes('-') || code.includes('.')) {
        calculatedLevel = code.split(/[-.]/).length;
      } else if (code.length > 4) {
        calculatedLevel = 2;
      }
    }

    const id = `ACC-${entityId}-${code.replace(/[^a-zA-Z0-9]/g, '_')}`;
    db.prepare(`
      INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object, tax_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entityId, code, name, category, sub_category || '', normal_balance,
      parent_code || null, calculatedLevel,
      is_tax_deductible !== undefined ? (is_tax_deductible ? 1 : 0) : 1,
      is_tax_object !== undefined ? (is_tax_object ? 1 : 0) : 0,
      tax_type || null
    );

    res.json({ success: true, id, message: 'Akun berhasil ditambahkan dan dikembangkan ke dalam struktur bagan akun' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE account
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, sub_category, normal_balance, parent_code, is_tax_deductible, is_tax_object, tax_type } = req.body;

    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Akun tidak ditemukan' });

    let calculatedLevel = existing.level || 1;
    if (parent_code && parent_code !== existing.parent_code) {
      const parent = db.prepare('SELECT level FROM accounts WHERE entity_id = ? AND code = ?').get(existing.entity_id, parent_code);
      if (parent) {
        calculatedLevel = (parent.level || 1) + 1;
      }
    }

    db.prepare(`
      UPDATE accounts SET
        name = ?, category = ?, sub_category = ?, normal_balance = ?,
        parent_code = ?, level = ?,
        is_tax_deductible = ?, is_tax_object = ?, tax_type = ?
      WHERE id = ?
    `).run(
      name, category, sub_category || '', normal_balance,
      parent_code || null, calculatedLevel,
      is_tax_deductible ? 1 : 0, is_tax_object ? 1 : 0, tax_type || null, id
    );

    res.json({ success: true, message: 'Akun berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE account
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Check if account has journal entries
    const inJournal = db.prepare('SELECT COUNT(*) as count FROM journal_items WHERE account_id = ?').get(id);
    if (inJournal.count > 0) {
      return res.status(400).json({ error: 'Akun tidak dapat dihapus karena sudah memiliki transaksi jurnal' });
    }

    db.prepare('DELETE FROM initial_balances WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Akun berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Initial Balances (Saldo Awal)
router.get('/initial-balances', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const fiscalYear = parseInt(req.query.fiscal_year) || 2026;

    const items = db.prepare(`
      SELECT a.id as account_id, a.code, a.name, a.category, a.normal_balance,
             COALESCE(ib.debit, 0) as debit,
             COALESCE(ib.credit, 0) as credit,
             ib.as_of_date
      FROM accounts a
      LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ? AND ib.fiscal_year = ?
      WHERE a.entity_id = ?
      ORDER BY a.code ASC
    `).all(entityId, fiscalYear, entityId);

    const totalDebit = items.reduce((sum, it) => sum + (Number(it.debit) || 0), 0);
    const totalCredit = items.reduce((sum, it) => sum + (Number(it.credit) || 0), 0);
    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01;

    res.json({
      entityId,
      fiscalYear,
      items,
      totalDebit,
      totalCredit,
      difference,
      isBalanced
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / Save Initial Balances (Batch update)
router.post('/initial-balances', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const fiscalYear = parseInt(req.body.fiscal_year) || 2026;
    const asOfDate = req.body.as_of_date || `${fiscalYear}-01-01`;
    const entries = req.body.entries; // Array of { account_id, debit, credit }

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Format data tidak valid' });
    }

    let totalDebit = 0;
    let totalCredit = 0;

    const upsertStmt = db.prepare(`
      INSERT INTO initial_balances (id, entity_id, account_id, debit, credit, fiscal_year, as_of_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        debit = excluded.debit,
        credit = excluded.credit,
        as_of_date = excluded.as_of_date
    `);

    // Use transaction for atomic save
    db.exec('BEGIN TRANSACTION;');
    try {
      entries.forEach((e, idx) => {
        const d = Number(e.debit) || 0;
        const c = Number(e.credit) || 0;
        totalDebit += d;
        totalCredit += c;

        const id = `IB-${entityId}-${e.account_id}`;
        upsertStmt.run(id, entityId, e.account_id, d, c, fiscalYear, asOfDate);
      });
      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01;

    res.json({
      success: true,
      message: isBalanced 
        ? 'Saldo awal berhasil disimpan dan SEIMBANG (Balanced)!' 
        : `Saldo awal berhasil disimpan, namun terdapat SELISIH sebesar Rp ${difference.toLocaleString('id-ID')} antara Total Debit dan Total Kredit.`,
      totalDebit,
      totalCredit,
      difference,
      isBalanced
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BATCH IMPORT accounts & initial balances
router.post('/import', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { items, fiscal_year } = req.body;
    const year = parseInt(fiscal_year) || 2026;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data akun yang dikirim untuk diimpor' });
    }

    const upsertAccount = db.prepare(`
      INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object, tax_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        sub_category = excluded.sub_category,
        normal_balance = excluded.normal_balance,
        parent_code = excluded.parent_code,
        level = excluded.level,
        is_tax_deductible = excluded.is_tax_deductible,
        is_tax_object = excluded.is_tax_object,
        tax_type = excluded.tax_type
    `);

    const upsertInitialBalance = db.prepare(`
      INSERT INTO initial_balances (id, entity_id, account_id, debit, credit, fiscal_year, as_of_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        debit = excluded.debit,
        credit = excluded.credit
    `);

    let importedCount = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      items.forEach(a => {
        if (!a.code || !a.name) return;
        const code = String(a.code).trim();
        const accId = `ACC-${entityId}-${code.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const category = a.category || 'BEBAN_OPERASIONAL';
        const normal = (a.normal_balance || (['ASET_LANCAR', 'ASET_TETAP', 'BEBAN_OPERASIONAL', 'HPP', 'BEBAN_LAIN'].includes(category) ? 'DEBIT' : 'KREDIT')).toUpperCase();
        const level = parseInt(a.level) || (code.includes('-') ? code.split('-').length : 1);

        upsertAccount.run(
          accId,
          entityId,
          code,
          String(a.name).trim(),
          category,
          a.sub_category || '',
          normal,
          a.parent_code || null,
          level,
          a.is_tax_deductible !== undefined ? (Number(a.is_tax_deductible) === 0 ? 0 : 1) : 1,
          a.is_tax_object ? 1 : 0,
          a.tax_type || null
        );

        if (a.initial_debit !== undefined || a.initial_credit !== undefined) {
          const d = Number(a.initial_debit) || 0;
          const c = Number(a.initial_credit) || 0;
          const ibId = `IB-${entityId}-${accId}`;
          upsertInitialBalance.run(ibId, entityId, accId, d, c, year, `${year}-01-01`);
        }

        importedCount++;
      });
      db.exec('COMMIT;');
      res.json({ success: true, count: importedCount, message: `Berhasil mengimpor/memperbarui ${importedCount} akun bagan akun` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
