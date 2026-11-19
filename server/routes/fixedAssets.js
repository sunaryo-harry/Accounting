const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Fiscal rates map according to Indonesian tax law
const FISCAL_RATES = {
  GOL1: { name: 'Kelompok 1 (Bukan Bangunan - 4 Tahun)', years: 4, rate: 0.25 },
  GOL2: { name: 'Kelompok 2 (Bukan Bangunan - 8 Tahun)', years: 8, rate: 0.125 },
  GOL3: { name: 'Kelompok 3 (Bukan Bangunan - 16 Tahun)', years: 16, rate: 0.0625 },
  GOL4: { name: 'Kelompok 4 (Bukan Bangunan - 20 Tahun)', years: 20, rate: 0.05 },
  BANGUNAN_PERMANEN: { name: 'Bangunan Permanen (20 Tahun)', years: 20, rate: 0.05 },
  BANGUNAN_SEMI: { name: 'Bangunan Tidak Permanen (10 Tahun)', years: 10, rate: 0.10 },
  NON_DEPRECIABLE: { name: 'Tanah / Tidak Disusutkan', years: 0, rate: 0 }
};

// GET all Fixed Assets with Commercial & Fiscal Depreciation Schedule
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const assets = db.prepare(`
      SELECT fa.*,
             a1.code as asset_account_code, a1.name as asset_account_name,
             a2.code as accum_account_code, a2.name as accum_account_name,
             a3.code as exp_account_code, a3.name as exp_account_name
      FROM fixed_assets fa
      LEFT JOIN accounts a1 ON a1.id = fa.asset_account_id
      LEFT JOIN accounts a2 ON a2.id = fa.accum_deprec_account_id
      LEFT JOIN accounts a3 ON a3.id = fa.deprec_expense_account_id
      WHERE fa.entity_id = ?
      ORDER BY fa.acquisition_date ASC
    `).all(entityId);

    const now = new Date();
    const currentYear = now.getFullYear();

    let totalAcquisitionCost = 0;
    let totalCommercialAnnualDeprec = 0;
    let totalFiscalAnnualDeprec = 0;
    let totalFiscalCorrection = 0;

    const detailedAssets = assets.map(a => {
      const cost = Number(a.acquisition_cost) || 0;
      const salvage = Number(a.salvage_value) || 0;
      const commLife = Number(a.commercial_useful_life_years) || 1;
      const fiscalInfo = FISCAL_RATES[a.fiscal_group] || { years: 4, rate: 0.25 };

      // Annual Commercial Depreciation (Straight Line)
      let annualCommDeprec = 0;
      if (commLife > 0 && a.fiscal_group !== 'NON_DEPRECIABLE') {
        annualCommDeprec = (cost - salvage) / commLife;
      }

      // Annual Fiscal Depreciation (Straight Line according to UU PPh)
      let annualFiscalDeprec = 0;
      if (a.fiscal_group !== 'NON_DEPRECIABLE') {
        annualFiscalDeprec = cost * fiscalInfo.rate;
      }

      // Difference (Koreksi Fiskal): Positif if Commercial > Fiscal, Negatif if Commercial < Fiscal
      const fiscalDifference = annualCommDeprec - annualFiscalDeprec;

      totalAcquisitionCost += cost;
      totalCommercialAnnualDeprec += annualCommDeprec;
      totalFiscalAnnualDeprec += annualFiscalDeprec;
      totalFiscalCorrection += fiscalDifference;

      return {
        ...a,
        fiscal_group_name: fiscalInfo.name,
        fiscal_years: fiscalInfo.years,
        fiscal_rate_pct: fiscalInfo.rate * 100,
        commercial_annual_deprec: annualCommDeprec,
        commercial_monthly_deprec: annualCommDeprec / 12,
        fiscal_annual_deprec: annualFiscalDeprec,
        fiscal_monthly_deprec: annualFiscalDeprec / 12,
        fiscal_difference: fiscalDifference, // Selisih Penyusutan
        fiscal_correction_type: fiscalDifference > 0 ? 'KOREKSI_POSITIF' : (fiscalDifference < 0 ? 'KOREKSI_NEGATIF' : 'NIHIL')
      };
    });

    res.json({
      summary: {
        totalAssets: assets.length,
        totalAcquisitionCost,
        totalCommercialAnnualDeprec,
        totalFiscalAnnualDeprec,
        totalFiscalCorrection
      },
      fiscalRates: FISCAL_RATES,
      assets: detailedAssets
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE Fixed Asset
router.post('/', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { code, name, category, acquisition_date, acquisition_cost, salvage_value, commercial_useful_life_years, fiscal_group, asset_account_id, accum_deprec_account_id, deprec_expense_account_id, notes } = req.body;

    if (!code || !name || !acquisition_date || !acquisition_cost) {
      return res.status(400).json({ error: 'Kode, Nama, Tanggal Perolehan, dan Harga Perolehan wajib diisi' });
    }

    const fiscalInfo = FISCAL_RATES[fiscal_group] || { rate: 0.25 };
    const id = 'FA-' + Date.now().toString(36).toUpperCase();

    db.prepare(`
      INSERT INTO fixed_assets (id, entity_id, code, name, category, acquisition_date, acquisition_cost, salvage_value, commercial_method, commercial_useful_life_years, fiscal_group, fiscal_method, fiscal_rate, asset_account_id, accum_deprec_account_id, deprec_expense_account_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STRAIGHT_LINE', ?, ?, 'STRAIGHT_LINE', ?, ?, ?, ?, ?)
    `).run(
      id, entityId, code, name, category || 'Inventaris', acquisition_date,
      Number(acquisition_cost) || 0, Number(salvage_value) || 0,
      Number(commercial_useful_life_years) || 4, fiscal_group || 'GOL1',
      fiscalInfo.rate, asset_account_id || null, accum_deprec_account_id || null, deprec_expense_account_id || null, notes || ''
    );

    res.json({ success: true, id, message: 'Aktiva tetap berhasil didaftarkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fixed Asset
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM fixed_assets WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Aktiva tetap berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
