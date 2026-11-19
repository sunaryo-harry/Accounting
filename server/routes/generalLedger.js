const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Configure Multer for PDF transaction proof uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'BUKTI-GL-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

// GET General Ledger (Buku Besar)
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { account_id, startDate, endDate } = req.query;

    if (!entityId) return res.status(400).json({ error: 'Entitas tidak ditemukan' });

    // 1. Get Accounts to display
    let accountsQuery = `
      SELECT a.*,
        COALESCE(ib.debit, 0) as initial_debit,
        COALESCE(ib.credit, 0) as initial_credit
      FROM accounts a
      LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ?
      WHERE a.entity_id = ?
    `;
    const accParams = [entityId, entityId];

    if (account_id && account_id !== 'ALL') {
      accountsQuery += ` AND a.id = ?`;
      accParams.push(account_id);
    }
    accountsQuery += ` ORDER BY a.code ASC`;

    const accounts = db.prepare(accountsQuery).all(...accParams);

    // 2. For each account, compute transactions and running balance
    const result = accounts.map(acc => {
      // Calculate prior balance if startDate is specified
      let priorDebit = Number(acc.initial_debit) || 0;
      let priorCredit = Number(acc.initial_credit) || 0;

      if (startDate) {
        const priorMovements = db.prepare(`
          SELECT 
            COALESCE(SUM(ji.debit), 0) as debit,
            COALESCE(SUM(ji.credit), 0) as credit
          FROM journal_items ji
          JOIN journals j ON j.id = ji.journal_id
          WHERE ji.account_id = ? AND j.entity_id = ? AND j.date < ?
        `).get(acc.id, entityId, startDate);

        priorDebit += Number(priorMovements.debit) || 0;
        priorCredit += Number(priorMovements.credit) || 0;
      }

      // Starting balance as of startDate
      let openingBalance = 0;
      if (acc.normal_balance === 'DEBIT') {
        openingBalance = priorDebit - priorCredit;
      } else {
        openingBalance = priorCredit - priorDebit;
      }

      // Query movements in current period
      let txQuery = `
        SELECT 
          ji.id as item_id,
          ji.debit,
          ji.credit,
          ji.memo,
          j.id as journal_id,
          j.journal_number,
          j.date,
          j.journal_type,
          j.reference_no,
          j.description,
          j.attachment_path,
          j.attachment_name
        FROM journal_items ji
        JOIN journals j ON j.id = ji.journal_id
        WHERE ji.account_id = ? AND j.entity_id = ?
      `;
      const txParams = [acc.id, entityId];

      if (startDate) {
        txQuery += ` AND j.date >= ?`;
        txParams.push(startDate);
      }
      if (endDate) {
        txQuery += ` AND j.date <= ?`;
        txParams.push(endDate);
      }
      txQuery += ` ORDER BY j.date ASC, j.journal_number ASC, ji.rowid ASC`;

      const movements = db.prepare(txQuery).all(...txParams);

      // Compute running balance
      let currentRunningBalance = openingBalance;
      let periodTotalDebit = 0;
      let periodTotalCredit = 0;

      const transactionsWithBalance = movements.map(m => {
        const d = Number(m.debit) || 0;
        const c = Number(m.credit) || 0;
        periodTotalDebit += d;
        periodTotalCredit += c;

        if (acc.normal_balance === 'DEBIT') {
          currentRunningBalance += (d - c);
        } else {
          currentRunningBalance += (c - d);
        }

        return {
          ...m,
          running_balance: currentRunningBalance
        };
      });

      return {
        account_id: acc.id,
        account_code: acc.code,
        account_name: acc.name,
        category: acc.category,
        normal_balance: acc.normal_balance,
        opening_balance: openingBalance,
        period_debit: periodTotalDebit,
        period_credit: periodTotalCredit,
        closing_balance: currentRunningBalance,
        movements: transactionsWithBalance
      };
    });

    res.json({
      entityId,
      startDate: startDate || null,
      endDate: endDate || null,
      accounts: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Voucher Details for a General Ledger transaction
router.get('/voucher/:journal_id', (req, res) => {
  try {
    const { journal_id } = req.params;
    const journal = db.prepare('SELECT * FROM journals WHERE id = ?').get(journal_id);
    if (!journal) {
      return res.status(404).json({ error: 'Jurnal / Transaksi tidak ditemukan' });
    }

    const items = db.prepare(`
      SELECT ji.*, a.code as account_code, a.name as account_name, a.normal_balance
      FROM journal_items ji
      JOIN accounts a ON a.id = ji.account_id
      WHERE ji.journal_id = ?
      ORDER BY ji.rowid ASC
    `).all(journal_id);

    res.json({
      journal,
      items,
      sharedNotice: items.length > 1 
        ? `Transaksi ini memiliki ${items.length} mutasi akun dalam satu nomor bukti (${journal.journal_number}). Bukti PDF yang diunggah akan otomatis terhubung ke seluruh mutasi akun tersebut.`
        : 'Bukti PDF akan ditautkan ke transaksi ini.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Upload PDF Proof for General Ledger Transaction
router.post('/upload-proof', upload.single('attachment'), (req, res) => {
  try {
    const journalId = req.body.journal_id;
    if (!journalId) {
      return res.status(400).json({ error: 'ID Jurnal / Transaksi wajib disertakan' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File dokumen bukti (PDF) wajib dipilih' });
    }

    const journal = db.prepare('SELECT * FROM journals WHERE id = ?').get(journalId);
    if (!journal) {
      return res.status(404).json({ error: 'Transaksi jurnal tidak ditemukan' });
    }

    const attachmentPath = `/uploads/${req.file.filename}`;
    const attachmentName = req.file.originalname;

    db.prepare(`
      UPDATE journals SET
        attachment_path = ?,
        attachment_name = ?
      WHERE id = ?
    `).run(attachmentPath, attachmentName, journalId);

    // Get count of affected journal items/accounts in ledger
    const countItems = db.prepare('SELECT COUNT(*) as count FROM journal_items WHERE journal_id = ?').get(journalId);

    res.json({
      success: true,
      message: `Bukti format PDF berhasil diunggah! Terhubung otomatis ke ${countItems.count} baris mutasi buku besar pada No. Jurnal ${journal.journal_number}.`,
      journal_id: journalId,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      affectedItemsCount: countItems.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Proof attachment from General Ledger transaction
router.delete('/proof/:journal_id', (req, res) => {
  try {
    const { journal_id } = req.params;
    db.prepare(`
      UPDATE journals SET
        attachment_path = NULL,
        attachment_name = NULL
      WHERE id = ?
    `).run(journal_id);

    res.json({ success: true, message: 'File bukti transaksi berhasil dihapus dari buku besar' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
