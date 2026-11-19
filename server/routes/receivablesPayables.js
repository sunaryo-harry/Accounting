const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// GET Contacts (Customers / Vendors / etc.)
router.get('/contacts', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const type = req.query.type; // 'CUSTOMER' or 'VENDOR'
    
    let query = `SELECT * FROM contacts WHERE entity_id = ?`;
    const params = [entityId];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    query += ` ORDER BY name ASC`;

    const contacts = db.prepare(query).all(...params);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE Contact
router.post('/contacts', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { type, name, npwp, nik, email, phone, address, payment_terms_days } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Nama dan Tipe kontak wajib diisi' });
    }

    const id = (type === 'CUSTOMER' ? 'CUST-' : 'VEND-') + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO contacts (id, entity_id, type, name, npwp, nik, email, phone, address, payment_terms_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entityId, type, name, npwp || '', nik || '', email || '', phone || '', address || '', payment_terms_days || 30);

    res.json({ success: true, id, message: 'Kontak berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Invoices (AR / AP)
router.get('/invoices', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { type, status } = req.query; // type: 'AR' or 'AP'

    let query = `
      SELECT inv.*, c.name as contact_name, c.npwp as contact_npwp, c.phone as contact_phone
      FROM invoices inv
      JOIN contacts c ON c.id = inv.contact_id
      WHERE inv.entity_id = ?
    `;
    const params = [entityId];

    if (type) {
      query += ` AND inv.invoice_type = ?`;
      params.push(type);
    }
    if (status && status !== 'ALL') {
      query += ` AND inv.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY inv.due_date ASC, inv.date DESC`;

    const invoices = db.prepare(query).all(...params);

    const totalBilled = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);

    res.json({
      invoices,
      totalBilled,
      totalPaid,
      totalOutstanding
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE Invoice (AR / AP)
router.post('/invoices', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { contact_id, invoice_type, invoice_no, date, due_date, subtotal, tax_rate, faktur_pajak_no, notes, auto_journal } = req.body;

    if (!contact_id || !invoice_type || !invoice_no || !date) {
      return res.status(400).json({ error: 'Pelanggan/Pemasok, Nomor Faktur, dan Tanggal wajib diisi' });
    }

    const sub = Number(subtotal) || 0;
    const rate = Number(tax_rate) !== undefined ? Number(tax_rate) : 11;
    const tax = (sub * rate) / 100;
    const total = sub + tax;

    const id = `INV-${invoice_type}-` + Date.now().toString(36).toUpperCase();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO invoices (id, entity_id, contact_id, invoice_type, invoice_no, date, due_date, subtotal, tax_amount, tax_rate, total_amount, paid_amount, balance_due, status, faktur_pajak_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'UNPAID', ?, ?)
      `).run(
        id, entityId, contact_id, invoice_type, invoice_no, date, due_date || date,
        sub, tax, rate, total, total, faktur_pajak_no || '', notes || ''
      );

      // Auto record tax withholding if tax > 0
      if (tax > 0) {
        const contact = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(contact_id);
        const taxType = invoice_type === 'AR' ? 'PPN_KELUARAN' : 'PPN_MASUKAN';
        const d = new Date(date);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        db.prepare(`
          INSERT INTO tax_withholdings (id, entity_id, tax_type, period_month, period_year, faktur_pajak_no, date, contact_id, npwp, name, dpp, tax_rate, tax_amount, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `TAX-${id}`, entityId, taxType, month, year, faktur_pajak_no || '', date,
          contact_id, contact?.npwp || '', contact?.name || '', sub, rate, tax, `Faktur Pajak atas ${invoice_no}`
        );
      }

      db.exec('COMMIT;');
      res.json({ success: true, id, message: `Faktur ${invoice_type} berhasil dicatat` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RECORD Payment (Pelunasan Piutang / Pembayaran Hutang)
router.post('/payments', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { invoice_id, date, amount, payment_method, account_id, reference_no, notes } = req.body;

    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoice_id);
    if (!invoice) return res.status(404).json({ error: 'Faktur tidak ditemukan' });

    const payAmt = Number(amount) || 0;
    if (payAmt <= 0) {
      return res.status(400).json({ error: 'Jumlah pembayaran harus lebih besar dari 0' });
    }

    if (payAmt > invoice.balance_due + 0.01) {
      return res.status(400).json({ 
        error: `Jumlah pembayaran (Rp ${payAmt.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${invoice.balance_due.toLocaleString('id-ID')})` 
      });
    }

    const newPaid = invoice.paid_amount + payAmt;
    const newBalance = Math.max(0, invoice.total_amount - newPaid);
    const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIAL';

    const payId = 'PAY-' + Date.now().toString(36).toUpperCase();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO payments (id, entity_id, invoice_id, date, amount, payment_method, account_id, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(payId, entityId, invoice_id, date, payAmt, payment_method || 'BANK_TRANSFER', account_id, reference_no || '', notes || '');

      db.prepare(`
        UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?
      `).run(newPaid, newBalance, newStatus, invoice_id);

      db.exec('COMMIT;');
      res.json({ success: true, id: payId, newBalance, status: newStatus, message: 'Pembayaran berhasil dibukukan' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Aging Schedule (Analisis Umur Piutang & Hutang)
router.get('/aging', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const type = req.query.type || 'AR'; // 'AR' or 'AP'
    const asOfDate = req.query.as_of_date || new Date().toISOString().slice(0, 10);

    const invoices = db.prepare(`
      SELECT inv.*, c.name as contact_name, c.npwp as contact_npwp
      FROM invoices inv
      JOIN contacts c ON c.id = inv.contact_id
      WHERE inv.entity_id = ? AND inv.invoice_type = ? AND inv.balance_due > 0
      ORDER BY c.name ASC, inv.due_date ASC
    `).all(entityId, type);

    const todayMs = new Date(asOfDate).getTime();

    let bucketCurrent = 0;   // Not yet due
    let bucket1_30 = 0;      // 1-30 days overdue
    let bucket31_60 = 0;     // 31-60 days overdue
    let bucket61_90 = 0;     // 61-90 days overdue
    let bucketOver90 = 0;    // > 90 days overdue

    const details = invoices.map(inv => {
      const dueMs = new Date(inv.due_date).getTime();
      const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
      const bal = Number(inv.balance_due) || 0;

      let bCurrent = 0, b1_30 = 0, b31_60 = 0, b61_90 = 0, bOver90 = 0;

      if (diffDays <= 0) {
        bCurrent = bal;
        bucketCurrent += bal;
      } else if (diffDays <= 30) {
        b1_30 = bal;
        bucket1_30 += bal;
      } else if (diffDays <= 60) {
        b31_60 = bal;
        bucket31_60 += bal;
      } else if (diffDays <= 90) {
        b61_90 = bal;
        bucket61_90 += bal;
      } else {
        bOver90 = bal;
        bucketOver90 += bal;
      }

      return {
        ...inv,
        overdue_days: diffDays > 0 ? diffDays : 0,
        bucket_current: bCurrent,
        bucket_1_30: b1_30,
        bucket_31_60: b31_60,
        bucket_61_90: b61_90,
        bucket_over_90: bOver90
      };
    });

    const totalOutstanding = bucketCurrent + bucket1_30 + bucket31_60 + bucket61_90 + bucketOver90;

    res.json({
      entityId,
      type,
      asOfDate,
      summary: {
        totalOutstanding,
        bucketCurrent,
        bucket1_30,
        bucket31_60,
        bucket61_90,
        bucketOver90
      },
      details
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
