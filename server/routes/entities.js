const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Helper to get active entity
function getActiveEntityId() {
  const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'active_entity_id'`).get();
  if (row) return row.value;
  const first = db.prepare(`SELECT id FROM entities LIMIT 1`).get();
  return first ? first.id : null;
}

// GET all entities
router.get('/', (req, res) => {
  try {
    const activeId = getActiveEntityId();
    const entities = db.prepare('SELECT * FROM entities ORDER BY name ASC').all();
    res.json({
      activeEntityId: activeId,
      entities: entities.map(e => ({
        ...e,
        isActive: e.id === activeId
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET active entity
router.get('/active', (req, res) => {
  try {
    const activeId = getActiveEntityId();
    if (!activeId) return res.status(404).json({ error: 'No entity found' });
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(activeId);
    res.json(entity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SET active entity
router.post('/active/:id', (req, res) => {
  try {
    const { id } = req.params;
    const exists = db.prepare('SELECT id FROM entities WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Entity not found' });

    db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('active_entity_id', ?)`).run(id);
    res.json({ success: true, activeEntityId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE entity
router.post('/', (req, res) => {
  try {
    const { name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name } = req.body;
    if (!name || !npwp) {
      return res.status(400).json({ error: 'Nama dan NPWP wajib diisi' });
    }

    const id = 'ENT-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO entities (id, name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, npwp, kpp || '', address || '', phone || '', email || '', fiscal_year || 2026, currency || 'IDR', director_name || '');

    // Clone standard COA for the new entity
    const sampleEntity = db.prepare(`SELECT id FROM entities WHERE id != ? LIMIT 1`).get(id);
    if (sampleEntity) {
      const accounts = db.prepare(`SELECT * FROM accounts WHERE entity_id = ?`).all(sampleEntity.id);
      const insertAcc = db.prepare(`
        INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object, tax_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      accounts.forEach(acc => {
        const newAccId = `ACC-${id}-${acc.code}`;
        insertAcc.run(newAccId, id, acc.code, acc.name, acc.category, acc.sub_category, acc.normal_balance, acc.parent_code, acc.level, acc.is_tax_deductible, acc.is_tax_object, acc.tax_type);
      });
    }

    res.json({ success: true, id, message: 'Entitas baru dan bagan akun berhasil dibuat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE entity
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name } = req.body;

    db.prepare(`
      UPDATE entities SET
        name = ?, npwp = ?, kpp = ?, address = ?, phone = ?, email = ?, fiscal_year = ?, currency = ?, director_name = ?
      WHERE id = ?
    `).run(name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name, id);

    res.json({ success: true, message: 'Data entitas berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE entity
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const countRow = db.prepare('SELECT COUNT(*) as count FROM entities').get();
    if (countRow.count <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus. Sistem harus memiliki minimal satu entitas aktif.' });
    }

    const currentActive = getActiveEntityId();
    let newActiveId = currentActive;

    db.exec('BEGIN TRANSACTION;');
    try {
      // Delete cascade relations if not handled by sqlite foreign keys
      db.prepare('DELETE FROM initial_balances WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM journal_items WHERE journal_id IN (SELECT id FROM journals WHERE entity_id = ?)').run(id);
      db.prepare('DELETE FROM journals WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM inventory_transactions WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM inventory_items WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM payments WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM contacts WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM fixed_assets WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM tax_withholdings WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM fiscal_reconciliations WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM spt_1771_data WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM accounts WHERE entity_id = ?').run(id);
      db.prepare('DELETE FROM entities WHERE id = ?').run(id);

      if (currentActive === id) {
        const remaining = db.prepare('SELECT id FROM entities LIMIT 1').get();
        if (remaining) {
          newActiveId = remaining.id;
          db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('active_entity_id', ?)`).run(newActiveId);
        }
      }

      db.exec('COMMIT;');
      res.json({ success: true, message: 'Entitas dan seluruh data terkait berhasil dihapus', newActiveId });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BATCH IMPORT entities
router.post('/import', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data entitas untuk diimpor' });
    }

    const sampleEntity = db.prepare(`SELECT id FROM entities LIMIT 1`).get();
    const insertStmt = db.prepare(`
      INSERT INTO entities (id, name, npwp, kpp, address, phone, email, fiscal_year, currency, director_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      items.forEach(e => {
        if (!e.name || !e.npwp) return;
        const id = 'ENT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
        insertStmt.run(
          id,
          e.name,
          e.npwp,
          e.kpp || '',
          e.address || '',
          e.phone || '',
          e.email || '',
          parseInt(e.fiscal_year) || 2026,
          e.currency || 'IDR',
          e.director_name || ''
        );

        // Clone COA from sample entity if exists
        if (sampleEntity) {
          const accounts = db.prepare(`SELECT * FROM accounts WHERE entity_id = ?`).all(sampleEntity.id);
          const insertAcc = db.prepare(`
            INSERT INTO accounts (id, entity_id, code, name, category, sub_category, normal_balance, parent_code, level, is_tax_deductible, is_tax_object, tax_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          accounts.forEach(acc => {
            const newAccId = `ACC-${id}-${acc.code}`;
            insertAcc.run(newAccId, id, acc.code, acc.name, acc.category, acc.sub_category, acc.normal_balance, acc.parent_code, acc.level, acc.is_tax_deductible, acc.is_tax_object, acc.tax_type);
          });
        }
        importedCount++;
      });
      db.exec('COMMIT;');
      res.json({ success: true, count: importedCount, message: `Berhasil mengimpor ${importedCount} entitas baru` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  getActiveEntityId
};
