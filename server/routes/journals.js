const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Set up Multer for attachment uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'BUKTI-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// GET all journals with pagination & filter
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { type, startDate, endDate, search } = req.query;

    let query = `
      SELECT j.*, 
        COUNT(ji.id) as item_count,
        SUM(ji.debit) as calculated_total
      FROM journals j
      LEFT JOIN journal_items ji ON ji.journal_id = j.id
      WHERE j.entity_id = ?
    `;
    const params = [entityId];

    if (type && type !== 'ALL') {
      query += ` AND j.journal_type = ?`;
      params.push(type);
    }
    if (startDate) {
      query += ` AND j.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND j.date <= ?`;
      params.push(endDate);
    }
    if (search) {
      query += ` AND (j.journal_number LIKE ? OR j.description LIKE ? OR j.reference_no LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY j.id ORDER BY j.date DESC, j.journal_number DESC`;

    const journals = db.prepare(query).all(...params);

    res.json(journals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single journal with items
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const journal = db.prepare(`SELECT * FROM journals WHERE id = ?`).get(id);
    if (!journal) return res.status(404).json({ error: 'Jurnal tidak ditemukan' });

    const items = db.prepare(`
      SELECT ji.*, a.code as account_code, a.name as account_name, a.normal_balance
      FROM journal_items ji
      JOIN accounts a ON a.id = ji.account_id
      WHERE ji.journal_id = ?
      ORDER BY ji.rowid ASC
    `).all(id);

    res.json({
      ...journal,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE journal with items & optional file upload
router.post('/', upload.single('attachment'), (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { journal_number, date, journal_type, reference_no, description, created_by } = req.body;
    let items = req.body.items;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ error: 'Format data item jurnal tidak valid' });
      }
    }

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'Jurnal minimal harus memiliki 2 baris akun (Debit dan Kredit)' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    items.forEach(it => {
      totalDebit += Number(it.debit) || 0;
      totalCredit += Number(it.credit) || 0;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ 
        error: `Jurnal tidak seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) != Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')})` 
      });
    }

    // Generate Journal Number if not provided
    const autoNumber = journal_number || `JU-${date.replace(/-/g, '').slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const journalId = 'JRN-' + Date.now().toString(36).toUpperCase();

    let attachmentPath = null;
    let attachmentName = null;
    if (req.file) {
      attachmentPath = `/uploads/${req.file.filename}`;
      attachmentName = req.file.originalname;
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        journalId, entityId, autoNumber, date, journal_type || 'GENERAL',
        reference_no || '', description, totalDebit, attachmentPath, attachmentName, created_by || 'Admin'
      );

      const insertItem = db.prepare(`
        INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      items.forEach((it, idx) => {
        const itemId = `JI-${journalId}-${idx + 1}`;
        insertItem.run(itemId, journalId, it.account_id, Number(it.debit) || 0, Number(it.credit) || 0, it.memo || '');
      });

      db.exec('COMMIT;');
      res.json({ success: true, id: journalId, journal_number: autoNumber, message: 'Jurnal berhasil dicatat' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE journal (Edit functionality)
router.put('/:id', upload.single('attachment'), (req, res) => {
  try {
    const { id } = req.params;
    const { journal_number, date, journal_type, reference_no, description } = req.body;
    let items = req.body.items;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ error: 'Format data item jurnal tidak valid' });
      }
    }

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'Jurnal minimal harus memiliki 2 baris akun' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    items.forEach(it => {
      totalDebit += Number(it.debit) || 0;
      totalCredit += Number(it.credit) || 0;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: 'Jurnal tidak seimbang antara Debit dan Kredit' });
    }

    let attachmentSql = '';
    const updateParams = [journal_number, date, journal_type, reference_no, description, totalDebit];
    
    if (req.file) {
      attachmentSql = ', attachment_path = ?, attachment_name = ?';
      updateParams.push(`/uploads/${req.file.filename}`, req.file.originalname);
    }
    updateParams.push(id);

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE journals SET
          journal_number = ?, date = ?, journal_type = ?, reference_no = ?, description = ?, total_amount = ?
          ${attachmentSql}
        WHERE id = ?
      `).run(...updateParams);

      // Re-insert items
      db.prepare(`DELETE FROM journal_items WHERE journal_id = ?`).run(id);

      const insertItem = db.prepare(`
        INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      items.forEach((it, idx) => {
        const itemId = `JI-${id}-${idx + 1}`;
        insertItem.run(itemId, id, it.account_id, Number(it.debit) || 0, Number(it.credit) || 0, it.memo || '');
      });

      db.exec('COMMIT;');
      res.json({ success: true, message: 'Jurnal berhasil diperbarui' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE journal
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM journals WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Jurnal berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
