const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// GET all tax records (PPN, PPh 21, 22, 23, 4(2))
router.get('/records', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { tax_type, month, year } = req.query;

    let query = `
      SELECT t.*, c.name as contact_name
      FROM tax_withholdings t
      LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.entity_id = ?
    `;
    const params = [entityId];

    if (tax_type && tax_type !== 'ALL') {
      query += ` AND t.tax_type = ?`;
      params.push(tax_type);
    }
    if (month) {
      query += ` AND t.period_month = ?`;
      params.push(Number(month));
    }
    if (year) {
      query += ` AND t.period_year = ?`;
      params.push(Number(year));
    }
    query += ` ORDER BY t.date DESC, t.period_month DESC`;

    const records = db.prepare(query).all(...params);

    const totalDPP = records.reduce((s, r) => s + (Number(r.dpp) || 0), 0);
    const totalTax = records.reduce((s, r) => s + (Number(r.tax_amount) || 0), 0);

    res.json({
      records,
      totalDPP,
      totalTax
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE / RECORD Tax Entry
router.post('/records', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { tax_type, period_month, period_year, bukti_potong_no, faktur_pajak_no, date, contact_id, npwp, name, dpp, tax_rate, tax_amount, is_final, notes } = req.body;

    if (!tax_type || !period_month || !period_year || !date) {
      return res.status(400).json({ error: 'Jenis Pajak, Masa, Tahun, dan Tanggal wajib diisi' });
    }

    const d = Number(dpp) || 0;
    const rate = Number(tax_rate) || 0;
    const tax = Number(tax_amount) !== undefined ? Number(tax_amount) : (d * rate) / 100;

    const id = 'TAX-' + Date.now().toString(36).toUpperCase();

    db.prepare(`
      INSERT INTO tax_withholdings (id, entity_id, tax_type, period_month, period_year, bukti_potong_no, faktur_pajak_no, date, contact_id, npwp, name, dpp, tax_rate, tax_amount, is_final, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entityId, tax_type, Number(period_month), Number(period_year),
      bukti_potong_no || '', faktur_pajak_no || '', date,
      contact_id || null, npwp || '', name || '', d, rate, tax, is_final ? 1 : 0, notes || ''
    );

    res.json({ success: true, id, message: 'Data pajak berhasil dicatat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET EQUALISASI PAJAK (Crucial for Tax Audits & DJP Coretax Compliance)
router.get('/equalization', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;

    // 1. EQUALISASI OMZET PENJUALAN VS DPP PPN KELUARAN
    // From GL: Total Pendapatan (Account Category 'PENDAPATAN')
    const revGl = db.prepare(`
      SELECT 
        COALESCE(SUM(ji.credit - ji.debit), 0) as total_omzet_gl
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'PENDAPATAN'
        AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    // From Tax Records: DPP PPN Keluaran
    const ppnOut = db.prepare(`
      SELECT 
        COALESCE(SUM(dpp), 0) as total_dpp_ppn,
        COALESCE(SUM(tax_amount), 0) as total_ppn_amount
      FROM tax_withholdings
      WHERE entity_id = ? AND tax_type = 'PPN_KELUARAN' AND period_year = ?
    `).get(entityId, year);

    const omzetGl = Number(revGl.total_omzet_gl) || 0;
    const dppPpn = Number(ppnOut.total_dpp_ppn) || 0;
    const diffOmzet = omzetGl - dppPpn;

    // 2. EQUALISASI BIAYA GAJI / PERSONALIA VS DPP PPH PASAL 21
    const salaryGl = db.prepare(`
      SELECT 
        COALESCE(SUM(ji.debit - ji.credit), 0) as total_salary_gl
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.code = '6101'
        AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const pph21 = db.prepare(`
      SELECT 
        COALESCE(SUM(dpp), 0) as total_dpp_pph21,
        COALESCE(SUM(tax_amount), 0) as total_tax_pph21
      FROM tax_withholdings
      WHERE entity_id = ? AND tax_type = 'PPH21' AND period_year = ?
    `).get(entityId, year);

    const gajiGl = Number(salaryGl.total_salary_gl) || 0;
    const dpp21 = Number(pph21.total_dpp_pph21) || 0;
    const diffGaji = gajiGl - dpp21;

    // 3. EQUALISASI BIAYA JASA & SEWA VS DPP PPH 23 & PPH 4 AYAT 2
    const serviceGl = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN a.code = '6109' THEN ji.debit - ji.credit ELSE 0 END), 0) as total_jasa_gl,
        COALESCE(SUM(CASE WHEN a.code = '6104' THEN ji.debit - ji.credit ELSE 0 END), 0) as total_sewa_gl
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.code IN ('6109', '6104')
        AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const pph23_42 = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tax_type = 'PPH23' THEN dpp ELSE 0 END), 0) as total_dpp_pph23,
        COALESCE(SUM(CASE WHEN tax_type = 'PPH23' THEN tax_amount ELSE 0 END), 0) as total_tax_pph23,
        COALESCE(SUM(CASE WHEN tax_type = 'PPH4_2' THEN dpp ELSE 0 END), 0) as total_dpp_pph42,
        COALESCE(SUM(CASE WHEN tax_type = 'PPH4_2' THEN tax_amount ELSE 0 END), 0) as total_tax_pph42
      FROM tax_withholdings
      WHERE entity_id = ? AND tax_type IN ('PPH23', 'PPH4_2') AND period_year = ?
    `).get(entityId, year);

    const jasaGl = Number(serviceGl.total_jasa_gl) || 0;
    const sewaGl = Number(serviceGl.total_sewa_gl) || 0;
    const dpp23 = Number(pph23_42.total_dpp_pph23) || 0;
    const dpp42 = Number(pph23_42.total_dpp_pph42) || 0;

    res.json({
      year,
      entityId,
      equalizations: [
        {
          id: 'EQ-PPN',
          title: 'Equalisasi Omzet Penjualan vs DPP PPN Keluaran',
          taxObject: 'Penjualan Barang & Jasa (Objek PPN)',
          glAmount: omzetGl,
          glDescription: 'Peredaran Bruto / Penjualan di Laporan Laba Rugi',
          sptAmount: dppPpn,
          sptDescription: 'DPP PPN Keluaran pada SPT Masa PPN 1111',
          difference: diffOmzet,
          status: Math.abs(diffOmzet) < 1 ? 'EQUAL' : 'UNRECONCILED',
          taxDue: Number(ppnOut.total_ppn_amount) || 0,
          explanation: diffOmzet === 0 ? 'Sesuai (Equal / Tidak Ada Selisih)' : 'Terdapat selisih waktu penerbitan faktur pajak atau uang muka penjualan'
        },
        {
          id: 'EQ-PPH21',
          title: 'Equalisasi Beban Gaji & Imbalan Tenaga Kerja vs DPP PPh Pasal 21',
          taxObject: 'Beban Gaji, Upah, Tunjangan & Honorarium',
          glAmount: gajiGl,
          glDescription: 'Akun 6101 Beban Gaji & THR di Buku Besar',
          sptAmount: dpp21,
          sptDescription: 'Jumlah Penghasilan Bruto pada SPT Masa PPh 21',
          difference: diffGaji,
          status: Math.abs(diffGaji) < 1 ? 'EQUAL' : 'UNRECONCILED',
          taxDue: Number(pph21.total_tax_pph21) || 0,
          explanation: diffGaji === 0 ? 'Sesuai (Equal / Tidak Ada Selisih)' : 'Selisih natura yang bukan objek PPh 21 atau imbalan non-karyawan'
        },
        {
          id: 'EQ-PPH23',
          title: 'Equalisasi Beban Jasa Profesional / Konsultan vs DPP PPh Pasal 23',
          taxObject: 'Jasa Teknik, Manajemen, Audit & Konsultan (2%)',
          glAmount: jasaGl,
          glDescription: 'Akun 6109 Beban Jasa Audit & Konsultan di Buku Besar',
          sptAmount: dpp23,
          sptDescription: 'DPP Objek PPh 23 pada Bukti Potong / SPT Masa PPh 23',
          difference: jasaGl - dpp23,
          status: Math.abs(jasaGl - dpp23) < 1 ? 'EQUAL' : 'UNRECONCILED',
          taxDue: Number(pph23_42.total_tax_pph23) || 0,
          explanation: (jasaGl - dpp23) === 0 ? 'Sesuai (Equal / Tidak Ada Selisih)' : 'Selisih biaya jasa luar negeri atau reimbursement non-objek'
        },
        {
          id: 'EQ-PPH42',
          title: 'Equalisasi Beban Sewa Gedung & Kantor vs DPP PPh Final Pasal 4(2)',
          taxObject: 'Sewa Tanah dan/atau Bangunan (Final 10%)',
          glAmount: sewaGl,
          glDescription: 'Akun 6104 Beban Sewa Kantor di Buku Besar',
          sptAmount: dpp42,
          sptDescription: 'DPP PPh Final 4(2) pada SPT Masa PPh Final',
          difference: sewaGl - dpp42,
          status: Math.abs(sewaGl - dpp42) < 1 ? 'EQUAL' : 'UNRECONCILED',
          taxDue: Number(pph23_42.total_tax_pph42) || 0,
          explanation: (sewaGl - dpp42) === 0 ? 'Sesuai (Equal / Tidak Ada Selisih)' : 'Selisih amortisasi sewa dibayar dimuka dari periode sebelumnya'
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET PPN 1111 Summary (SPT Masa PPN)
router.get('/spt-ppn-summary', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;
    const month = Number(req.query.month) || 2;

    const ppnOut = db.prepare(`
      SELECT COALESCE(SUM(dpp), 0) as dpp, COALESCE(SUM(tax_amount), 0) as tax
      FROM tax_withholdings
      WHERE entity_id = ? AND tax_type = 'PPN_KELUARAN' AND period_month = ? AND period_year = ?
    `).get(entityId, month, year);

    const ppnIn = db.prepare(`
      SELECT COALESCE(SUM(dpp), 0) as dpp, COALESCE(SUM(tax_amount), 0) as tax
      FROM tax_withholdings
      WHERE entity_id = ? AND tax_type = 'PPN_MASUKAN' AND period_month = ? AND period_year = ?
    `).get(entityId, month, year);

    const ppnKeluaran = Number(ppnOut.tax) || 0;
    const ppnMasukan = Number(ppnIn.tax) || 0;
    const netPPN = ppnKeluaran - ppnMasukan; // > 0 Kurang Bayar, < 0 Lebih Bayar

    res.json({
      period: { month, year },
      penyerahanBKP: {
        dpp: Number(ppnOut.dpp) || 0,
        ppn: ppnKeluaran
      },
      perolehanBKP: {
        dpp: Number(ppnIn.dpp) || 0,
        ppn: ppnMasukan
      },
      perhitunganPPN: {
        ppnKeluaran,
        ppnMasukan,
        kurangLebihBayar: netPPN,
        status: netPPN > 0 ? 'PPN KURANG BAYAR' : (netPPN < 0 ? 'PPN LEBIH BAYAR' : 'NIHIL')
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BATCH IMPORT Tax Withholdings & Bukti Potong / Faktur Pajak
router.post('/import', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data bukti potong pajak untuk diimpor' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO tax_withholdings (id, entity_id, tax_type, period_month, period_year, bukti_potong_no, faktur_pajak_no, date, name, npwp, dpp, tax_rate, tax_amount, is_final, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      items.forEach(t => {
        if (!t.tax_type || !t.dpp) return;
        const id = 'TAX-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
        const dpp = Number(t.dpp) || 0;
        const rate = Number(t.tax_rate) || 0;
        const taxAmt = Number(t.tax_amount) || Math.round(dpp * (rate / 100));

        insertStmt.run(
          id,
          entityId,
          String(t.tax_type).trim().toUpperCase(),
          parseInt(t.period_month) || new Date().getMonth() + 1,
          parseInt(t.period_year) || 2026,
          t.bukti_potong_no || null,
          t.faktur_pajak_no || null,
          t.date || new Date().toISOString().slice(0, 10),
          t.name ? String(t.name).trim() : 'Lawan Transaksi',
          t.npwp || null,
          dpp,
          rate,
          taxAmt,
          t.is_final ? 1 : 0,
          t.notes || 'Import Bukti Pajak'
        );
        imported++;
      });
      db.exec('COMMIT;');
      res.json({ success: true, count: imported, message: `Berhasil mengimpor ${imported} data bukti potong / faktur pajak!` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
