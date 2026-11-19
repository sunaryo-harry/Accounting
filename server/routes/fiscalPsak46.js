const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Standard Corporate Tax Rate in Indonesia (UU HPP)
const STATUTORY_TAX_RATE = 0.22; // 22%

// GET Fiscal Reconciliation & PSAK 46 Deferred Tax Computation
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;

    // 1. Calculate Commercial Profit Before Tax from Income Statement accounts
    const revenues = db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category IN ('PENDAPATAN', 'PENDAPATAN_LAIN')
        AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category IN ('HPP', 'BEBAN_OPERASIONAL', 'BEBAN_LAIN')
        AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const totalRev = Number(revenues.total) || 0;
    const totalExp = Number(expenses.total) || 0;
    // Commercial Profit Before Tax
    const commercialProfitBeforeTax = totalRev - totalExp;

    // 2. Fetch Fiscal Adjustments from database
    const fiscalItems = db.prepare(`
      SELECT * FROM fiscal_reconciliations
      WHERE entity_id = ? AND fiscal_year = ?
      ORDER BY type DESC, id ASC
    `).all(entityId, year);

    let positivePermanentDiff = 0;
    let positiveTemporaryDiff = 0;
    let negativePermanentDiff = 0;
    let negativeTemporaryDiff = 0;

    const classifiedItems = fiscalItems.map(item => {
      const amt = Number(item.amount) || 0;
      const isTemp = item.is_temporary === 1;

      if (item.type === 'POSITIF') {
        if (isTemp) {
          positiveTemporaryDiff += amt;
        } else {
          positivePermanentDiff += amt;
        }
      } else if (item.type === 'NEGATIF') {
        if (isTemp) {
          negativeTemporaryDiff += amt;
        } else {
          negativePermanentDiff += amt;
        }
      }

      return {
        ...item,
        difference_nature: isTemp ? 'BEDA TEMPORER (PSAK 46)' : 'BEDA TETAP (PERMANENT)'
      };
    });

    const totalPositiveCorrection = positivePermanentDiff + positiveTemporaryDiff;
    const totalNegativeCorrection = negativePermanentDiff + negativeTemporaryDiff;

    // Penghasilan Kena Pajak (Taxable Income / PKP)
    const taxableIncome = Math.max(0, commercialProfitBeforeTax + totalPositiveCorrection - totalNegativeCorrection);

    // 3. Perhitungan Pajak Kini (Current Tax Expense - Pasal 17 / Pasal 31E)
    // For small-medium business (< 50 Milyar peredaran bruto), Pasal 31E provides 50% discount on first 4.8 Milyar
    const isEligible31E = totalRev < 50000000000;
    let currentTaxExpense = 0;

    if (isEligible31E) {
      if (totalRev <= 4800000000) {
        // Full 50% reduction on 22% rate = 11%
        currentTaxExpense = taxableIncome * (STATUTORY_TAX_RATE * 0.5);
      } else {
        // Proportionate facility
        const facilityPortion = (4800000000 / totalRev) * taxableIncome;
        const nonFacilityPortion = taxableIncome - facilityPortion;
        currentTaxExpense = (facilityPortion * STATUTORY_TAX_RATE * 0.5) + (nonFacilityPortion * STATUTORY_TAX_RATE);
      }
    } else {
      currentTaxExpense = taxableIncome * STATUTORY_TAX_RATE;
    }

    // 4. Perhitungan Pajak Tangguhan (PSAK 46 / Deferred Tax)
    // Net Temporary Differences
    const netDeductibleTemporary = positiveTemporaryDiff - negativeTemporaryDiff;
    
    // Deferred Tax Effect for Current Year
    // If Net Temporary Difference is positive (deductible), it produces Deferred Tax Benefit / Deferred Tax Asset (DTA)
    const deferredTaxAmount = netDeductibleTemporary * STATUTORY_TAX_RATE;
    const isDeferredTaxAsset = deferredTaxAmount >= 0;

    // Total Tax Expense (Current Tax + Deferred Tax Expense / - Benefit)
    const deferredTaxExpense = -deferredTaxAmount; // Benefit reduces tax expense
    const totalTaxExpense = currentTaxExpense + deferredTaxExpense;

    // Commercial Net Income After Tax
    const netCommercialIncome = commercialProfitBeforeTax - totalTaxExpense;

    // Effective Tax Rate (ETR)
    const effectiveTaxRate = commercialProfitBeforeTax > 0 ? (totalTaxExpense / commercialProfitBeforeTax) * 100 : 0;

    res.json({
      entityId,
      fiscalYear: year,
      taxRates: {
        statutoryRate: STATUTORY_TAX_RATE * 100,
        article31EApplied: isEligible31E,
        effectiveTaxRate: Number(effectiveTaxRate.toFixed(2))
      },
      commercialSummary: {
        totalRevenue: totalRev,
        totalExpenses: totalExp,
        commercialProfitBeforeTax
      },
      fiscalAdjustments: {
        items: classifiedItems,
        positivePermanentDiff,
        positiveTemporaryDiff,
        totalPositiveCorrection,
        negativePermanentDiff,
        negativeTemporaryDiff,
        totalNegativeCorrection,
        taxableIncome
      },
      currentTax: {
        taxableIncome,
        currentTaxExpense,
        article31EFacilityDescription: isEligible31E ? 'Fasilitas Pengurangan Tarif 50% sesuai Pasal 31E UU PPh' : 'Tarif Umum Pasal 17 (22%)'
      },
      psak46DeferredTax: {
        positiveTemporaryDiff, // Misal: Beda penyusutan fiskal, CKPN
        negativeTemporaryDiff,
        netTemporaryDifference: netDeductibleTemporary,
        deferredTaxRate: STATUTORY_TAX_RATE * 100,
        deferredTaxAmount: Math.abs(deferredTaxAmount),
        classification: isDeferredTaxAsset ? 'ASET PAJAK TANGGUHAN (DEFERRED TAX ASSET - DTA)' : 'LIABILITAS PAJAK TANGGUHAN (DTL)',
        pnlImpact: isDeferredTaxAsset ? 'MANFAAT PAJAK TANGGUHAN (PENGURANG BEBAN PAJAK)' : 'BEBAN PAJAK TANGGUHAN',
        deferredTaxJournal: {
          debitAccount: isDeferredTaxAsset ? '1301 - Aset Pajak Tangguhan (DTA)' : '8102 - Beban Pajak Tangguhan',
          creditAccount: isDeferredTaxAsset ? '8102 - Manfaat Pajak Tangguhan' : '2203 - Liabilitas Pajak Tangguhan (DTL)',
          amount: Math.abs(deferredTaxAmount)
        }
      },
      auditorReconciliation: {
        commercialProfitBeforeTax,
        taxAtStatutoryRate: commercialProfitBeforeTax * STATUTORY_TAX_RATE,
        permanentDifferenceTaxImpact: (positivePermanentDiff - negativePermanentDiff) * STATUTORY_TAX_RATE,
        taxRateDifferenceBenefit: (commercialProfitBeforeTax * STATUTORY_TAX_RATE) - currentTaxExpense,
        totalTaxExpense,
        netCommercialIncome
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / ADD Fiscal Adjustment Item
router.post('/adjustments', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { fiscal_year, item_code, description, type, is_temporary, amount, notes } = req.body;

    if (!description || !type || !amount) {
      return res.status(400).json({ error: 'Deskripsi, Jenis (Positif/Negatif), dan Jumlah wajib diisi' });
    }

    const id = 'FISC-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO fiscal_reconciliations (id, entity_id, fiscal_year, item_code, description, type, is_temporary, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entityId, Number(fiscal_year) || 2026, item_code || 'CUSTOM', description,
      type, is_temporary ? 1 : 0, Number(amount) || 0, notes || ''
    );

    res.json({ success: true, id, message: 'Koreksi fiskal berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fiscal Adjustment Item
router.delete('/adjustments/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM fiscal_reconciliations WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Koreksi fiskal berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BATCH IMPORT Fiscal Adjustments (PSAK 46 / Koreksi Fiskal)
router.post('/import', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { items, fiscal_year } = req.body;
    const year = parseInt(fiscal_year) || 2026;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data koreksi fiskal untuk diimpor' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO fiscal_reconciliations (id, entity_id, fiscal_year, item_code, description, type, is_temporary, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      items.forEach(f => {
        if (!f.description || !f.amount) return;
        const id = 'FISC-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
        insertStmt.run(
          id,
          entityId,
          parseInt(f.fiscal_year) || year,
          f.item_code || 'IMP',
          String(f.description).trim(),
          (f.type || 'POSITIF').toUpperCase(),
          f.is_temporary ? 1 : 0,
          Number(f.amount) || 0,
          f.notes || ''
        );
        imported++;
      });
      db.exec('COMMIT;');
      res.json({ success: true, count: imported, message: `Berhasil mengimpor ${imported} data koreksi fiskal & PSAK 46!` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
