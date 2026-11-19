const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// GET full SPT 1771 Package (Induk + Lampiran I - VI)
router.get('/', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;

    const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(entityId);
    if (!entity) return res.status(404).json({ error: 'Entitas tidak ditemukan' });

    // 1. REVENUE (Peredaran Usaha)
    const revRow = db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as omzet
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'PENDAPATAN' AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));
    const peredaranUsaha = Number(revRow.omzet) || 0;

    // 2. COGS (Harga Pokok Penjualan)
    const cogsRow = db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as hpp
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'HPP' AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));
    const hpp = Number(cogsRow.hpp) || 0;

    // 3. OPERATING EXPENSES (Biaya Usaha)
    const opexRow = db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as opex
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'BEBAN_OPERASIONAL' AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));
    const biayaUsaha = Number(opexRow.opex) || 0;

    // 4. OTHER INCOME & EXPENSES (Penghasilan & Biaya Luar Usaha)
    const otherIncRow = db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as inc
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'PENDAPATAN_LAIN' AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));
    const penghasilanLuarUsaha = Number(otherIncRow.inc) || 0;

    const otherExpRow = db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as exp
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category = 'BEBAN_LAIN' AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));
    const biayaLuarUsaha = Number(otherExpRow.exp) || 0;

    // Penghasilan Neto Komersial
    const penghasilanNetoKomersial = peredaranUsaha - hpp - biayaUsaha + penghasilanLuarUsaha - biayaLuarUsaha;

    // 5. FISCAL ADJUSTMENTS (Penyesuaian Fiskal)
    const fiscalItems = db.prepare(`
      SELECT * FROM fiscal_reconciliations WHERE entity_id = ? AND fiscal_year = ?
    `).all(entityId, year);

    let penyesuaianFiskalPositif = 0;
    let penyesuaianFiskalNegatif = 0;

    fiscalItems.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'POSITIF') penyesuaianFiskalPositif += amt;
      else if (item.type === 'NEGATIF') penyesuaianFiskalNegatif += amt;
    });

    // Penghasilan Neto Fiskal
    const penghasilanNetoFiskal = penghasilanNetoKomersial + penyesuaianFiskalPositif - penyesuaianFiskalNegatif;
    const pkp = Math.max(0, penghasilanNetoFiskal);

    // PPh Terutang (Pasal 31E: 50% * 22% = 11% for small enterprise)
    const pphTerutang = pkp * 0.11;

    // 6. TAX CREDITS (Kredit Pajak PPh 22, 23, 25)
    const credits = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tax_type = 'PPH22' THEN tax_amount ELSE 0 END), 0) as pph22,
        COALESCE(SUM(CASE WHEN tax_type = 'PPH23' THEN tax_amount ELSE 0 END), 0) as pph23,
        COALESCE(SUM(CASE WHEN tax_type = 'PPH25' THEN tax_amount ELSE 0 END), 0) as pph25
      FROM tax_withholdings
      WHERE entity_id = ? AND period_year = ?
    `).get(entityId, year);

    const kreditPph22 = Number(credits.pph22) || 0;
    const kreditPph23 = Number(credits.pph23) || 0;
    const kreditPph25 = Number(credits.pph25) || 0;
    const totalKreditPajak = kreditPph22 + kreditPph23 + kreditPph25;

    // PPh Kurang / Lebih Bayar (PPh Pasal 29 / 28A)
    const pphKurangLebihBayar = pphTerutang - totalKreditPajak;

    // 7. LAMPIRAN II: Detailed Breakdown of Expenses
    const detailedExpenses = db.prepare(`
      SELECT a.code, a.name, a.sub_category,
             COALESCE(SUM(ji.debit - ji.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
      LEFT JOIN journals j ON j.id = ji.journal_id AND strftime('%Y', j.date) = ?
      WHERE a.entity_id = ? AND a.category IN ('HPP', 'BEBAN_OPERASIONAL', 'BEBAN_LAIN')
      GROUP BY a.id
      HAVING amount > 0
      ORDER BY a.code ASC
    `).all(String(year), entityId);

    // 8. LAMPIRAN III: Detailed Tax Credits Withholding List
    const taxCreditsList = db.prepare(`
      SELECT t.*, c.name as withholding_agent_name, c.npwp as withholding_agent_npwp
      FROM tax_withholdings t
      LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.entity_id = ? AND t.period_year = ? AND t.tax_type IN ('PPH22', 'PPH23')
      ORDER BY t.date ASC
    `).all(entityId, year);

    // 9. LAMPIRAN IV: Final Tax Income
    const finalIncomeList = db.prepare(`
      SELECT t.*, c.name as payer_name
      FROM tax_withholdings t
      LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.entity_id = ? AND t.period_year = ? AND (t.is_final = 1 OR t.tax_type = 'PPH4_2')
      ORDER BY t.date ASC
    `).all(entityId, year);

    // 10. LAMPIRAN V & VI: Saved JSON
    const lampiranVRow = db.prepare(`
      SELECT data_json FROM spt_1771_data WHERE entity_id = ? AND fiscal_year = ? AND section = 'LAMPIRAN_V'
    `).get(entityId, year);
    const lampiranVData = lampiranVRow ? JSON.parse(lampiranVRow.data_json) : { shareholders: [], officers: [] };

    res.json({
      entity,
      fiscalYear: year,
      form1771Induk: {
        nomorForm: '1771',
        namaWajibPajak: entity.name,
        npwp: entity.npwp,
        kpp: entity.kpp,
        tahunPajak: year,
        periodePembukuan: `01/01/${year} s.d. 31/12/${year}`,
        bagianA: {
          penghasilanNetoKomersialDN: penghasilanNetoKomersial,
          penghasilanNetoKomersialLN: 0,
          totalPenghasilanNetoKomersial: penghasilanNetoKomersial,
          penyesuaianFiskalPositif,
          penyesuaianFiskalNegatif,
          penghasilanNetoFiskal
        },
        bagianB: {
          kompensasiKerugianFiskal: 0,
          penghasilanKenaPajak: pkp
        },
        bagianC: {
          pphTerutang,
          dasarHukumTarif: 'Pasal 31E UU PPh (Tarif Efektif 11%)'
        },
        bagianD: {
          kreditPph22,
          kreditPph23,
          kreditPph25,
          totalKreditPajak
        },
        bagianE: {
          pphKurangLebihBayar,
          status: pphKurangLebihBayar > 0 ? 'PPh Pasal 29 (Kurang Bayar)' : (pphKurangLebihBayar < 0 ? 'PPh Pasal 28A (Lebih Bayar)' : 'Nihil')
        }
      },
      lampiranI: {
        title: 'Formulir 1771 - I : Penghasilan Neto Fiskal',
        peredaranUsaha,
        hpp,
        biayaUsaha,
        penghasilanLuarUsaha,
        biayaLuarUsaha,
        penghasilanNetoKomersial,
        koreksiFiskalPositifDetail: fiscalItems.filter(f => f.type === 'POSITIF'),
        koreksiFiskalNegatifDetail: fiscalItems.filter(f => f.type === 'NEGATIF'),
        penyesuaianFiskalPositif,
        penyesuaianFiskalNegatif,
        penghasilanNetoFiskal
      },
      lampiranII: {
        title: 'Formulir 1771 - II : Perincian Harga Pokok Penjualan, Biaya Usaha Lainnya & Luar Usaha',
        details: detailedExpenses,
        totalBiaya: hpp + biayaUsaha + biayaLuarUsaha
      },
      lampiranIII: {
        title: 'Formulir 1771 - III : Kredit Pajak Dalam Negeri (PPh 22 & PPh 23)',
        items: taxCreditsList,
        totalKreditPajakDalamNegeri: kreditPph22 + kreditPph23
      },
      lampiranIV: {
        title: 'Formulir 1771 - IV : Penghasilan yang Dikenakan PPh Final dan Bukan Objek Pajak',
        items: finalIncomeList,
        totalDPPFinal: finalIncomeList.reduce((s, it) => s + (Number(it.dpp) || 0), 0),
        totalPajakTerutangFinal: finalIncomeList.reduce((s, it) => s + (Number(it.tax_amount) || 0), 0)
      },
      lampiranV: {
        title: 'Formulir 1771 - V : Daftar Pemegang Saham / Pemilik Modal dan Susunan Pengurus / Komisaris',
        shareholders: lampiranVData.shareholders || [],
        officers: lampiranVData.officers || []
      },
      lampiranVI: {
        title: 'Formulir 1771 - VI : Daftar Penyertaan Modal pada Perusahaan Afiliasi & Pinjaman',
        affiliates: [],
        shareholderLoans: []
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Lampiran V / VI Data
router.put('/section', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { fiscal_year, section, data } = req.body;

    const id = `SPT-${entityId}-${fiscal_year}-${section}`;
    db.prepare(`
      INSERT INTO spt_1771_data (id, entity_id, fiscal_year, section, data_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_id, fiscal_year, section) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(id, entityId, Number(fiscal_year) || 2026, section, JSON.stringify(data));

    res.json({ success: true, message: `Data ${section} berhasil disimpan` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
