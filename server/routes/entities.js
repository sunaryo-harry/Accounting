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

module.exports = {
  router,
  getActiveEntityId
};
