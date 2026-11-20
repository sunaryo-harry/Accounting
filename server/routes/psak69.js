const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Setup Multer for KJPP Appraisal Report Uploads (PDF/DOC)
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
    cb(null, 'LAPORAN-KJPP-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

// -------------------------------------------------------------
// 1. MASTER ASET BIOLOGIS (PSAK 69)
// -------------------------------------------------------------

// GET all biological assets
router.get('/assets', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();

    const assets = db.prepare(`
      SELECT ba.*, 
        a.code as account_code, a.name as account_name,
        (ba.fair_value_balance - ba.cost_balance) as accumulated_fair_value_adjustment
      FROM biological_assets ba
      LEFT JOIN accounts a ON a.id = ba.asset_account_id
      WHERE ba.entity_id = ?
      ORDER BY ba.category ASC, ba.code ASC
    `).all(entityId);

    const totalCost = assets.reduce((sum, a) => sum + (Number(a.cost_balance) || 0), 0);
    const totalFairValue = assets.reduce((sum, a) => sum + (Number(a.fair_value_balance) || 0), 0);
    const totalAdjustment = totalFairValue - totalCost;

    const matureAssets = assets.filter(a => a.maturity_stage === 'MATURE');
    const immatureAssets = assets.filter(a => a.maturity_stage === 'IMMATURE');

    const totalHectares = assets.filter(a => a.unit === 'HA').reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
    const totalLivestock = assets.filter(a => a.unit === 'EKOR').reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);

    res.json({
      assets,
      summary: {
        totalCost,
        totalFairValue,
        totalAdjustment,
        matureCount: matureAssets.length,
        immatureCount: immatureAssets.length,
        totalHectares,
        totalLivestock,
        matureFairValue: matureAssets.reduce((sum, a) => sum + (Number(a.fair_value_balance) || 0), 0),
        immatureFairValue: immatureAssets.reduce((sum, a) => sum + (Number(a.fair_value_balance) || 0), 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE biological asset
router.post('/assets', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { 
      code, name, category, sub_category, maturity_stage, unit, 
      quantity, planted_year, location, cost_balance, fair_value_balance, asset_account_id 
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Kode dan Nama Aset Biologis wajib diisi' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const exists = db.prepare(`SELECT id FROM biological_assets WHERE entity_id = ? AND code = ?`).get(entityId, cleanCode);
    if (exists) {
      return res.status(400).json({ error: `Kode aset biologis ${cleanCode} sudah terdaftar` });
    }

    const id = `BIO-${entityId}-${Date.now().toString(36).toUpperCase()}`;
    const cost = Number(cost_balance) || 0;
    const fairVal = Number(fair_value_balance) > 0 ? Number(fair_value_balance) : cost;

    // Default account assignment if omitted
    let accId = asset_account_id;
    if (!accId) {
      const targetCode = maturity_stage === 'IMMATURE' ? '1402' : '1401';
      accId = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = ? LIMIT 1`).get(entityId, targetCode)?.id || null;
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO biological_assets (
          id, entity_id, code, name, category, sub_category, maturity_stage, unit, 
          quantity, planted_year, location, cost_balance, fair_value_balance, asset_account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, entityId, cleanCode, String(name).trim(),
        category || 'PERKEBUNAN', sub_category || '',
        maturity_stage || 'MATURE', unit || 'HA',
        Number(quantity) || 0, Number(planted_year) || new Date().getFullYear(),
        location || '', cost, fairVal, accId
      );

      // Record initial movement in Paragraf 50 table
      db.prepare(`
        INSERT INTO biological_asset_movements (id, entity_id, asset_id, date, movement_type, amount, quantity_delta, reference_no, description)
        VALUES (?, ?, ?, ?, 'INITIAL', ?, ?, 'PENGAKUAN-AWAL', 'Pengakuan Awal Aset Biologis PSAK 69')
      `).run(`BAM-${id}-INIT`, entityId, id, new Date().toISOString().slice(0, 10), fairVal, Number(quantity) || 0);

      db.exec('COMMIT;');
      res.json({ success: true, id, message: 'Aset biologis berhasil didaftarkan' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE biological asset
router.put('/assets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, category, sub_category, maturity_stage, unit, 
      quantity, planted_year, location, cost_balance, fair_value_balance, asset_account_id 
    } = req.body;

    db.prepare(`
      UPDATE biological_assets SET
        code = ?, name = ?, category = ?, sub_category = ?, maturity_stage = ?, unit = ?,
        quantity = ?, planted_year = ?, location = ?, cost_balance = ?, fair_value_balance = ?, asset_account_id = ?
      WHERE id = ?
    `).run(
      String(code).trim().toUpperCase(), String(name).trim(), category, sub_category || '',
      maturity_stage, unit, Number(quantity) || 0, Number(planted_year) || null,
      location || '', Number(cost_balance) || 0, Number(fair_value_balance) || 0, asset_account_id || null,
      id
    );

    res.json({ success: true, message: 'Data aset biologis berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE biological asset
router.delete('/assets/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM biological_assets WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Aset biologis berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. LAPORAN & KERTAS KERJA PENILAIAN KJPP (SPI 2024 & PSAK 69)
// -------------------------------------------------------------

// GET all appraisals
router.get('/appraisals', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();

    const appraisals = db.prepare(`
      SELECT ka.*,
        COUNT(kai.id) as assessed_items_count,
        COALESCE(SUM(kai.gross_fair_value), 0) as total_gross_fair_value,
        COALESCE(SUM(kai.costs_to_sell), 0) as total_costs_to_sell,
        COALESCE(SUM(kai.net_fair_value), 0) as total_net_fair_value,
        COALESCE(SUM(kai.fair_value_adjustment), 0) as total_fair_value_adjustment,
        COALESCE(SUM(kai.physical_change_amount), 0) as total_physical_change,
        COALESCE(SUM(kai.price_change_amount), 0) as total_price_change
      FROM kjpp_appraisals ka
      LEFT JOIN kjpp_appraisal_items kai ON kai.appraisal_id = ka.id
      WHERE ka.entity_id = ?
      GROUP BY ka.id
      ORDER BY ka.valuation_date DESC, ka.created_at DESC
    `).all(entityId);

    res.json(appraisals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET appraisal detail with items
router.get('/appraisals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const appraisal = db.prepare(`SELECT * FROM kjpp_appraisals WHERE id = ?`).get(id);
    if (!appraisal) return res.status(404).json({ error: 'Laporan penilaian KJPP tidak ditemukan' });

    const items = db.prepare(`
      SELECT kai.*,
        ba.code as asset_code, ba.name as asset_name, ba.category as asset_category,
        ba.maturity_stage, ba.unit as asset_unit,
        j.journal_number
      FROM kjpp_appraisal_items kai
      JOIN biological_assets ba ON ba.id = kai.asset_id
      LEFT JOIN journals j ON j.id = kai.journal_id
      WHERE kai.appraisal_id = ?
      ORDER BY ba.code ASC
    `).all(id);

    res.json({
      ...appraisal,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE appraisal with assessment items & auto-journaling
router.post('/appraisals', upload.single('attachment'), (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const {
      valuation_date, kjpp_name, kjpp_license_no, lead_valuer_name,
      report_number, valuation_purpose, valuation_standard, valuation_method,
      discount_rate_wacc, costs_to_sell_rate, commodity_price_benchmark, notes,
      auto_post_journal
    } = req.body;

    let items = [];
    if (typeof req.body.items === 'string') {
      try { items = JSON.parse(req.body.items); } catch(e) { items = []; }
    } else if (Array.isArray(req.body.items)) {
      items = req.body.items;
    }

    if (!valuation_date || !kjpp_name || !report_number) {
      return res.status(400).json({ error: 'Tanggal Penilaian, Nama KJPP, dan No. Laporan Penilaian wajib diisi' });
    }

    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    const appraisalId = `KJPP-${entityId}-${Date.now().toString(36).toUpperCase()}`;
    const wacc = Number(discount_rate_wacc) || 11.5;
    const ctsRate = Number(costs_to_sell_rate) || 2.5;

    // Lookup accounts for Fair Value Gain and Loss
    const defaultGainAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '7105' LIMIT 1`).get(entityId)?.id;
    const defaultLossAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '7205' LIMIT 1`).get(entityId)?.id;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO kjpp_appraisals (
          id, entity_id, valuation_date, kjpp_name, kjpp_license_no, lead_valuer_name,
          report_number, valuation_purpose, valuation_standard, valuation_method,
          discount_rate_wacc, costs_to_sell_rate, commodity_price_benchmark, notes,
          attachment_path, attachment_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        appraisalId, entityId, valuation_date, kjpp_name, kjpp_license_no || '', lead_valuer_name || '',
        report_number, valuation_purpose || 'Pelaporan Keuangan PSAK 69 / SPI 2024',
        valuation_standard || 'SPI 2024 & PSAK 69 Agrikultur',
        valuation_method || 'INCOME_DCF', wacc, ctsRate,
        commodity_price_benchmark || '', notes || '',
        attachmentPath, attachmentName, 'COMPLETED'
      );

      const insertItemStmt = db.prepare(`
        INSERT INTO kjpp_appraisal_items (
          id, appraisal_id, asset_id, quantity, book_value_before, gross_fair_value,
          costs_to_sell, net_fair_value, fair_value_adjustment, physical_change_amount,
          price_change_amount, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateAssetStmt = db.prepare(`
        UPDATE biological_assets SET fair_value_balance = ? WHERE id = ?
      `);

      const insertMovStmt = db.prepare(`
        INSERT INTO biological_asset_movements (
          id, entity_id, asset_id, date, movement_type, amount, quantity_delta, reference_no, description, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let totalAdjSum = 0;
      let journalRows = [];

      items.forEach((it, idx) => {
        const asset = db.prepare(`SELECT * FROM biological_assets WHERE id = ?`).get(it.asset_id);
        if (!asset) return;

        const bookBefore = Number(asset.fair_value_balance) || Number(asset.cost_balance) || 0;
        const grossFv = Number(it.gross_fair_value) || 0;
        const cts = it.costs_to_sell !== undefined ? Number(it.costs_to_sell) : (grossFv * (ctsRate / 100));
        const netFv = grossFv - cts;
        const adj = netFv - bookBefore;

        totalAdjSum += adj;

        // Breakdown Paragraf 51: Physical vs Price changes (default 60% physical, 40% price if not specified)
        const physRatio = it.physical_change_ratio !== undefined ? Number(it.physical_change_ratio) : 0.6;
        const physAmount = adj * physRatio;
        const priceAmount = adj - physAmount;

        const itemId = `KJI-${appraisalId}-${idx + 1}`;
        insertItemStmt.run(
          itemId, appraisalId, it.asset_id, Number(it.quantity) || asset.quantity,
          bookBefore, grossFv, cts, netFv, adj, physAmount, priceAmount, null
        );

        // Update fair value balance in biological_assets
        updateAssetStmt.run(netFv, it.asset_id);

        // Record physical and price movements for Paragraf 50 reconciliation
        if (adj >= 0) {
          if (physAmount > 0) {
            insertMovStmt.run(`BAM-${itemId}-P`, entityId, it.asset_id, valuation_date, 'FAIR_VALUE_GAIN_PHYSICAL', physAmount, 0, report_number, `Keuntungan Nilai Wajar Fisik PSAK 69 [${kjpp_name}]`, null);
          }
          if (priceAmount > 0) {
            insertMovStmt.run(`BAM-${itemId}-M`, entityId, it.asset_id, valuation_date, 'FAIR_VALUE_GAIN_PRICE', priceAmount, 0, report_number, `Keuntungan Nilai Wajar Harga Pasar PSAK 69 [${kjpp_name}]`, null);
          }
        } else {
          const absPhys = Math.abs(physAmount);
          const absPrice = Math.abs(priceAmount);
          if (absPhys > 0) {
            insertMovStmt.run(`BAM-${itemId}-PL`, entityId, it.asset_id, valuation_date, 'FAIR_VALUE_LOSS_PHYSICAL', absPhys, 0, report_number, `Penurunan Nilai Wajar Fisik PSAK 69 [${kjpp_name}]`, null);
          }
          if (absPrice > 0) {
            insertMovStmt.run(`BAM-${itemId}-ML`, entityId, it.asset_id, valuation_date, 'FAIR_VALUE_LOSS_PRICE', absPrice, 0, report_number, `Penurunan Nilai Wajar Harga Pasar PSAK 69 [${kjpp_name}]`, null);
          }
        }

        journalRows.push({
          asset,
          adj,
          absAdj: Math.abs(adj)
        });
      });

      // Handle Auto-Journaling if requested
      const doAutoJournal = (auto_post_journal === 'true' || auto_post_journal === true || auto_post_journal === '1');
      let createdJournalId = null;

      if (doAutoJournal && journalRows.length > 0 && Math.abs(totalAdjSum) > 0) {
        createdJournalId = 'JRN-' + Date.now().toString(36).toUpperCase();
        const jrnNum = `JU-BIO-PSAK69-${valuation_date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

        let totalJournalDebit = 0;
        const lineItems = [];

        journalRows.forEach((jr, rIdx) => {
          if (jr.adj === 0) return;
          const assetAccId = jr.asset.asset_account_id;
          if (!assetAccId) return;

          if (jr.adj > 0) {
            // Gain: Debit Asset Biologis, Credit Keuntungan Penilaian (7105)
            lineItems.push({
              id: `JI-${createdJournalId}-${rIdx * 2 + 1}`,
              account_id: assetAccId,
              debit: jr.absAdj,
              credit: 0,
              memo: `Penyesuaian Nilai Wajar Aset Biologis: ${jr.asset.name}`
            });
            lineItems.push({
              id: `JI-${createdJournalId}-${rIdx * 2 + 2}`,
              account_id: defaultGainAcc,
              debit: 0,
              credit: jr.absAdj,
              memo: `Keuntungan Perubahan Nilai Wajar PSAK 69 [${kjpp_name}]`
            });
            totalJournalDebit += jr.absAdj;
          } else {
            // Loss: Debit Kerugian Penilaian (7205), Credit Asset Biologis
            lineItems.push({
              id: `JI-${createdJournalId}-${rIdx * 2 + 1}`,
              account_id: defaultLossAcc,
              debit: jr.absAdj,
              credit: 0,
              memo: `Kerugian Perubahan Nilai Wajar PSAK 69 [${kjpp_name}]`
            });
            lineItems.push({
              id: `JI-${createdJournalId}-${rIdx * 2 + 2}`,
              account_id: assetAccId,
              debit: 0,
              credit: jr.absAdj,
              memo: `Penurunan Nilai Wajar Aset Biologis: ${jr.asset.name}`
            });
            totalJournalDebit += jr.absAdj;
          }
        });

        if (lineItems.length > 0 && totalJournalDebit > 0) {
          db.prepare(`
            INSERT INTO journals (
              id, entity_id, journal_number, date, journal_type, reference_no,
              description, total_amount, attachment_path, attachment_name
            ) VALUES (?, ?, ?, ?, 'ADJUSTING', ?, ?, ?, ?, ?)
          `).run(
            createdJournalId, entityId, jrnNum, valuation_date, report_number,
            `Penyesuaian Nilai Wajar Aset Biologis PSAK 69 - Laporan KJPP No. ${report_number}`,
            totalJournalDebit, attachmentPath, attachmentName
          );

          const insertJI = db.prepare(`
            INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          lineItems.forEach(li => {
            if (li.account_id) {
              insertJI.run(li.id, createdJournalId, li.account_id, li.debit, li.credit, li.memo);
            }
          });

          // Link journal_id to appraisal and appraisal_items
          db.prepare(`UPDATE kjpp_appraisals SET status = 'POSTED' WHERE id = ?`).run(appraisalId);
          db.prepare(`UPDATE kjpp_appraisal_items SET journal_id = ? WHERE appraisal_id = ?`).run(createdJournalId, appraisalId);
        }
      }

      db.exec('COMMIT;');
      res.json({
        success: true,
        id: appraisalId,
        journal_id: createdJournalId,
        message: 'Laporan Penilaian KJPP dan kertas kerja PSAK 69 berhasil dicatat'
      });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST journal from existing appraisal
router.post('/appraisals/:id/post-journal', (req, res) => {
  try {
    const { id } = req.params;
    const entityId = req.body.entity_id || getActiveEntityId();

    const appraisal = db.prepare(`SELECT * FROM kjpp_appraisals WHERE id = ?`).get(id);
    if (!appraisal) return res.status(404).json({ error: 'Laporan penilaian KJPP tidak ditemukan' });

    const items = db.prepare(`
      SELECT kai.*, ba.name as asset_name, ba.asset_account_id
      FROM kjpp_appraisal_items kai
      JOIN biological_assets ba ON ba.id = kai.asset_id
      WHERE kai.appraisal_id = ?
    `).all(id);

    const defaultGainAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '7105' LIMIT 1`).get(entityId)?.id;
    const defaultLossAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '7205' LIMIT 1`).get(entityId)?.id;

    const jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
    const jrnNum = `JU-BIO-PSAK69-${appraisal.valuation_date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    let totalDebit = 0;
    const lineItems = [];

    items.forEach((it, idx) => {
      const adj = Number(it.fair_value_adjustment) || 0;
      if (adj === 0 || !it.asset_account_id) return;
      const absAdj = Math.abs(adj);

      if (adj > 0) {
        lineItems.push({
          id: `JI-${jrnId}-${idx * 2 + 1}`,
          account_id: it.asset_account_id,
          debit: absAdj,
          credit: 0,
          memo: `Penyesuaian Nilai Wajar Aset Biologis: ${it.asset_name}`
        });
        lineItems.push({
          id: `JI-${jrnId}-${idx * 2 + 2}`,
          account_id: defaultGainAcc,
          debit: 0,
          credit: absAdj,
          memo: `Keuntungan Perubahan Nilai Wajar PSAK 69 [${appraisal.kjpp_name}]`
        });
        totalDebit += absAdj;
      } else {
        lineItems.push({
          id: `JI-${jrnId}-${idx * 2 + 1}`,
          account_id: defaultLossAcc,
          debit: absAdj,
          credit: 0,
          memo: `Kerugian Perubahan Nilai Wajar PSAK 69 [${appraisal.kjpp_name}]`
        });
        lineItems.push({
          id: `JI-${jrnId}-${idx * 2 + 2}`,
          account_id: it.asset_account_id,
          debit: 0,
          credit: absAdj,
          memo: `Penurunan Nilai Wajar Aset Biologis: ${it.asset_name}`
        });
        totalDebit += absAdj;
      }
    });

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada penyesuaian nilai wajar yang perlu dijurnal atau akun belum dipetakan' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO journals (
          id, entity_id, journal_number, date, journal_type, reference_no,
          description, total_amount, attachment_path, attachment_name
        ) VALUES (?, ?, ?, ?, 'ADJUSTING', ?, ?, ?, ?, ?)
      `).run(
        jrnId, entityId, jrnNum, appraisal.valuation_date, appraisal.report_number,
        `Posting Jurnal Penyesuaian Nilai Wajar PSAK 69 - Laporan KJPP No. ${appraisal.report_number}`,
        totalDebit, appraisal.attachment_path, appraisal.attachment_name
      );

      const insertJI = db.prepare(`
        INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      lineItems.forEach(li => {
        insertJI.run(li.id, jrnId, li.account_id, li.debit, li.credit, li.memo);
      });

      db.prepare(`UPDATE kjpp_appraisals SET status = 'POSTED' WHERE id = ?`).run(id);
      db.prepare(`UPDATE kjpp_appraisal_items SET journal_id = ? WHERE appraisal_id = ?`).run(jrnId, id);

      db.exec('COMMIT;');
      res.json({ success: true, journal_id: jrnId, journal_number: jrnNum, message: 'Voucher Jurnal PSAK 69 berhasil diposting' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. LAPORAN REKONSILIASI PERUBAHAN NILAI TERCATAT (PARAGRAF 50 PSAK 69)
// -------------------------------------------------------------

router.get('/reconciliation', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const fiscalYear = req.query.fiscal_year || '2026';

    const assets = db.prepare(`SELECT * FROM biological_assets WHERE entity_id = ? ORDER BY code ASC`).all(entityId);

    const movements = db.prepare(`
      SELECT bam.*, ba.code as asset_code, ba.name as asset_name, ba.category as asset_category, ba.maturity_stage
      FROM biological_asset_movements bam
      JOIN biological_assets ba ON ba.id = bam.asset_id
      WHERE bam.entity_id = ? AND strftime('%Y', bam.date) = ?
      ORDER BY bam.date ASC
    `).all(entityId, String(fiscalYear));

    // Group into reconciliation matrix
    const matrix = assets.map(ast => {
      const astMovs = movements.filter(m => m.asset_id === ast.id);

      const initialAmount = astMovs.filter(m => m.movement_type === 'INITIAL').reduce((s, m) => s + m.amount, 0) || Number(ast.cost_balance);
      const additionPurchase = astMovs.filter(m => m.movement_type === 'ADDITION_PURCHASE').reduce((s, m) => s + m.amount, 0);
      const developmentCost = astMovs.filter(m => m.movement_type === 'DEVELOPMENT_COST').reduce((s, m) => s + m.amount, 0);

      const fvGainPhysical = astMovs.filter(m => m.movement_type === 'FAIR_VALUE_GAIN_PHYSICAL').reduce((s, m) => s + m.amount, 0);
      const fvGainPrice = astMovs.filter(m => m.movement_type === 'FAIR_VALUE_GAIN_PRICE').reduce((s, m) => s + m.amount, 0);
      const fvLossPhysical = astMovs.filter(m => m.movement_type === 'FAIR_VALUE_LOSS_PHYSICAL').reduce((s, m) => s + m.amount, 0);
      const fvLossPrice = astMovs.filter(m => m.movement_type === 'FAIR_VALUE_LOSS_PRICE').reduce((s, m) => s + m.amount, 0);

      const netPhysicalChange = fvGainPhysical - fvLossPhysical;
      const netPriceChange = fvGainPrice - fvLossPrice;
      const netFairValueAdjustment = netPhysicalChange + netPriceChange;

      const harvestDecrease = astMovs.filter(m => m.movement_type === 'HARVEST_DECREASE').reduce((s, m) => s + m.amount, 0);
      const disposal = astMovs.filter(m => m.movement_type === 'DISPOSAL').reduce((s, m) => s + m.amount, 0);

      const endingBalance = initialAmount + additionPurchase + developmentCost + netFairValueAdjustment - harvestDecrease - disposal;

      return {
        asset_id: ast.id,
        code: ast.code,
        name: ast.name,
        category: ast.category,
        sub_category: ast.sub_category,
        maturity_stage: ast.maturity_stage,
        unit: ast.unit,
        quantity: ast.quantity,
        initial_balance: initialAmount,
        addition_purchase: additionPurchase,
        development_cost: developmentCost,
        net_physical_change: netPhysicalChange,
        net_price_change: netPriceChange,
        net_fair_value_adjustment: netFairValueAdjustment,
        harvest_decrease: harvestDecrease,
        disposal: disposal,
        ending_balance: endingBalance
      };
    });

    const totals = matrix.reduce((acc, row) => ({
      initial_balance: acc.initial_balance + row.initial_balance,
      addition_purchase: acc.addition_purchase + row.addition_purchase,
      development_cost: acc.development_cost + row.development_cost,
      net_physical_change: acc.net_physical_change + row.net_physical_change,
      net_price_change: acc.net_price_change + row.net_price_change,
      net_fair_value_adjustment: acc.net_fair_value_adjustment + row.net_fair_value_adjustment,
      harvest_decrease: acc.harvest_decrease + row.harvest_decrease,
      disposal: acc.disposal + row.disposal,
      ending_balance: acc.ending_balance + row.ending_balance
    }), {
      initial_balance: 0, addition_purchase: 0, development_cost: 0,
      net_physical_change: 0, net_price_change: 0, net_fair_value_adjustment: 0,
      harvest_decrease: 0, disposal: 0, ending_balance: 0
    });

    res.json({
      fiscal_year: fiscalYear,
      rows: matrix,
      totals
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. MODEL PENILAIAN DCF & ANALISIS SENSITIVITAS KJPP
// -------------------------------------------------------------

router.get('/dcf-calculator', (req, res) => {
  try {
    const { 
      hectares, mature_years, projected_yield_ton_per_ha, 
      commodity_price_per_ton, upkeep_cost_per_ha, harvest_cost_per_ton,
      wacc_rate, costs_to_sell_percent 
    } = req.query;

    const ha = Number(hectares) || 450;
    const remainingYears = Number(mature_years) || 18;
    const yieldTon = Number(projected_yield_ton_per_ha) || 24; // Ton TBS per Ha per tahun
    const priceTon = Number(commodity_price_per_ton) || 2650000; // Rp 2.650.000 / ton TBS
    const upkeepHa = Number(upkeep_cost_per_ha) || 16500000; // Rp 16.5 Juta / Ha per tahun
    const harvestCostTon = Number(harvest_cost_per_ton) || 280000; // Rp 280.000 / ton panen & transport
    const wacc = Number(wacc_rate) || 11.5; // 11.5% WACC
    const ctsRate = Number(costs_to_sell_percent) || 2.5; // 2.5% Costs to sell

    // Annual Projection
    const projections = [];
    let grossFairValue = 0;

    for (let t = 1; t <= remainingYears; t++) {
      // Yield curve profile (peak at year 7-14, modest decline after)
      let yieldFactor = 1.0;
      if (t <= 3) yieldFactor = 0.9 + (t * 0.05);
      else if (t > 12) yieldFactor = Math.max(0.75, 1.0 - ((t - 12) * 0.03));

      const annualTotalProductionTon = ha * yieldTon * yieldFactor;
      const grossRevenue = annualTotalProductionTon * priceTon;
      const totalUpkeepCost = ha * upkeepHa;
      const totalHarvestCost = annualTotalProductionTon * harvestCostTon;
      const totalOperatingCost = totalUpkeepCost + totalHarvestCost;

      const netCashFlow = grossRevenue - totalOperatingCost;
      const discountFactor = Math.pow(1 + (wacc / 100), t);
      const presentValue = netCashFlow / discountFactor;

      grossFairValue += presentValue;

      if (t <= 5 || t === remainingYears) {
        projections.push({
          year: t,
          yield_per_ha: (yieldTon * yieldFactor).toFixed(1),
          total_production_ton: Math.round(annualTotalProductionTon),
          revenue: Math.round(grossRevenue),
          operating_cost: Math.round(totalOperatingCost),
          net_cash_flow: Math.round(netCashFlow),
          discount_factor: discountFactor.toFixed(4),
          present_value: Math.round(presentValue)
        });
      }
    }

    const costsToSell = grossFairValue * (ctsRate / 100);
    const netFairValue = grossFairValue - costsToSell;

    // SENSITIVITY MATRIX (WACC vs Commodity Price)
    // WACC variations: -1%, base, +1%
    // Price variations: -10%, -5%, base, +5%, +10%
    const waccSteps = [wacc - 1.0, wacc, wacc + 1.0];
    const priceSteps = [0.90, 0.95, 1.00, 1.05, 1.10];

    const sensitivityMatrix = waccSteps.map(w => {
      const row = { wacc: w.toFixed(2) };
      priceSteps.forEach(pF => {
        let scGrossFv = 0;
        for (let t = 1; t <= remainingYears; t++) {
          let yieldFactor = 1.0;
          if (t <= 3) yieldFactor = 0.9 + (t * 0.05);
          else if (t > 12) yieldFactor = Math.max(0.75, 1.0 - ((t - 12) * 0.03));

          const scProduction = ha * yieldTon * yieldFactor;
          const scRevenue = scProduction * (priceTon * pF);
          const scCost = (ha * upkeepHa) + (scProduction * harvestCostTon);
          const scNcf = scRevenue - scCost;
          scGrossFv += scNcf / Math.pow(1 + (w / 100), t);
        }
        const scNetFv = scGrossFv * (1 - (ctsRate / 100));
        const priceLabel = ((pF - 1.0) * 100) >= 0 ? `+${Math.round((pF - 1.0) * 100)}%` : `${Math.round((pF - 1.0) * 100)}%`;
        row[`price_${priceLabel}`] = Math.round(scNetFv);
        row[`diff_percent_${priceLabel}`] = (((scNetFv - netFairValue) / netFairValue) * 100).toFixed(2);
      });
      return row;
    });

    res.json({
      parameters: {
        hectares: ha,
        mature_years: remainingYears,
        yield_per_ha: yieldTon,
        price_per_ton: priceTon,
        upkeep_per_ha: upkeepHa,
        harvest_cost_per_ton: harvestCostTon,
        wacc: wacc,
        costs_to_sell_rate: ctsRate
      },
      results: {
        gross_fair_value: Math.round(grossFairValue),
        costs_to_sell: Math.round(costsToSell),
        net_fair_value_fvlcts: Math.round(netFairValue),
        net_fair_value_per_ha: Math.round(netFairValue / ha)
      },
      sample_projections: projections,
      sensitivity_matrix: sensitivityMatrix
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. LAPORAN PENGUNGKAPAN RESMI PSAK 69 (CALK & AUDITOR PACKAGE)
// -------------------------------------------------------------

router.get('/disclosure', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(entityId);
    const assets = db.prepare(`SELECT * FROM biological_assets WHERE entity_id = ?`).all(entityId);
    const latestAppraisal = db.prepare(`SELECT * FROM kjpp_appraisals WHERE entity_id = ? ORDER BY valuation_date DESC LIMIT 1`).get(entityId);

    const totalFv = assets.reduce((s, a) => s + (Number(a.fair_value_balance) || 0), 0);
    const matureFv = assets.filter(a => a.maturity_stage === 'MATURE').reduce((s, a) => s + (Number(a.fair_value_balance) || 0), 0);
    const immatureFv = assets.filter(a => a.maturity_stage === 'IMMATURE').reduce((s, a) => s + (Number(a.fair_value_balance) || 0), 0);

    const disclosureText = `
CATATAN ATAS LAPORAN KEUANGAN (CALK) - ASET BIOLOGIS (PSAK 69)
Entitas: ${entity?.name || 'Perusahaan'}
Tahun Fiskal: 2026 | Standar: PSAK 69 (Agrikultur)

1. Kebijakan Akuntansi:
Sesuai dengan PSAK 69, Perusahaan mengukur aset biologis pada saat pengakuan awal dan pada setiap akhir periode pelaporan pada Nilai Wajar dikurangi Biaya untuk Menjual (Fair Value less Costs to Sell - FVLCTS). Keuntungan atau kerugian yang timbul dari perubahan nilai wajar dikurangi biaya untuk menjual aset biologis diakui dalam laba rugi pada periode terjadinya.

2. Pengukuran Nilai Wajar Independen:
Nilai wajar aset biologis Perusahaan pada tanggal 30 Juni 2026 dinilai oleh penilai independen terdaftar ${latestAppraisal?.kjpp_name || 'Kantor Jasa Penilai Publik (KJPP)'} berdasarkan Surat Izin Penilai ${latestAppraisal?.kjpp_license_no || '-'} dalam Laporan Penilaian No. ${latestAppraisal?.report_number || '-'}.

3. Asumsi dan Masukan Signifikan yang Tidak Dapat Diobservasi (Hierarki Nilai Wajar Level 3):
- Metode Penilaian: ${latestAppraisal?.valuation_method === 'INCOME_DCF' ? 'Pendekatan Pendapatan dengan Metode Diskonto Arus Kas (Discounted Cash Flow - DCF)' : 'Pendekatan Pasar'}
- Tingkat Diskonto (WACC): ${latestAppraisal?.discount_rate_wacc || 11.5}% per tahun
- Estimasi Biaya untuk Menjual: ${latestAppraisal?.costs_to_sell_rate || 2.5}%
- Tolok Ukur Harga: ${latestAppraisal?.commodity_price_benchmark || 'Harga rata-rata komoditas pasar tender'}

4. Ringkasan Nilai Tercatat Aset Biologis:
- Tanaman Menghasilkan / Ternak Dewasa (Mature): Rp ${matureFv.toLocaleString('id-ID')}
- Tanaman Belum Menghasilkan (Immature / TBM): Rp ${immatureFv.toLocaleString('id-ID')}
- Total Nilai Wajar Aset Biologis (PSAK 69): Rp ${totalFv.toLocaleString('id-ID')}
    `.trim();

    res.json({
      entity,
      latest_appraisal: latestAppraisal,
      disclosure_text: disclosureText,
      total_fair_value: totalFv,
      mature_fair_value: matureFv,
      immature_fair_value: immatureFv
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
