const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Helper to get account balances (Initial + Journal movements)
function getAccountBalances(entityId, startDate, endDate) {
  const accounts = db.prepare(`
    SELECT a.*, 
      COALESCE(ib.debit, 0) as init_debit,
      COALESCE(ib.credit, 0) as init_credit
    FROM accounts a
    LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ?
    WHERE a.entity_id = ?
    ORDER BY a.code ASC
  `).all(entityId, entityId);

  let dateFilter = '';
  const dateParams = [entityId];
  if (startDate) {
    dateFilter += ` AND j.date >= ?`;
    dateParams.push(startDate);
  }
  if (endDate) {
    dateFilter += ` AND j.date <= ?`;
    dateParams.push(endDate);
  }

  const movements = db.prepare(`
    SELECT ji.account_id,
      COALESCE(SUM(ji.debit), 0) as period_debit,
      COALESCE(SUM(ji.credit), 0) as period_credit
    FROM journal_items ji
    JOIN journals j ON j.id = ji.journal_id
    WHERE j.entity_id = ? ${dateFilter}
    GROUP BY ji.account_id
  `).all(...dateParams);

  const movMap = {};
  movements.forEach(m => {
    movMap[m.account_id] = m;
  });

  return accounts.map(acc => {
    const mov = movMap[acc.id] || { period_debit: 0, period_credit: 0 };
    const pDebit = Number(mov.period_debit) || 0;
    const pCredit = Number(mov.period_credit) || 0;
    const iDebit = Number(acc.init_debit) || 0;
    const iCredit = Number(acc.init_credit) || 0;

    const totalDebit = iDebit + pDebit;
    const totalCredit = iCredit + pCredit;

    let endingBalance = 0;
    if (acc.normal_balance === 'DEBIT') {
      endingBalance = totalDebit - totalCredit;
    } else {
      endingBalance = totalCredit - totalDebit;
    }

    return {
      ...acc,
      initial_debit: iDebit,
      initial_credit: iCredit,
      period_debit: pDebit,
      period_credit: pCredit,
      total_debit: totalDebit,
      total_credit: totalCredit,
      ending_balance: endingBalance
    };
  });
}

// 1. TRIAL BALANCE (NERACA SALDO 4 & 6 KOLOM)
router.get('/trial-balance', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { startDate, endDate } = req.query;

    const balances = getAccountBalances(entityId, startDate, endDate);

    let sumInitDebit = 0, sumInitCredit = 0;
    let sumPeriodDebit = 0, sumPeriodCredit = 0;
    let sumEndDebit = 0, sumEndCredit = 0;

    const rows = balances.map(acc => {
      sumInitDebit += acc.initial_debit;
      sumInitCredit += acc.initial_credit;
      sumPeriodDebit += acc.period_debit;
      sumPeriodCredit += acc.period_credit;

      let endDebit = 0, endCredit = 0;
      if (acc.normal_balance === 'DEBIT') {
        if (acc.ending_balance >= 0) endDebit = acc.ending_balance;
        else endCredit = Math.abs(acc.ending_balance);
      } else {
        if (acc.ending_balance >= 0) endCredit = acc.ending_balance;
        else endDebit = Math.abs(acc.ending_balance);
      }

      sumEndDebit += endDebit;
      sumEndCredit += endCredit;

      return {
        account_id: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normal_balance: acc.normal_balance,
        initial_debit: acc.initial_debit,
        initial_credit: acc.initial_credit,
        period_debit: acc.period_debit,
        period_credit: acc.period_credit,
        ending_debit: endDebit,
        ending_credit: endCredit
      };
    });

    res.json({
      entityId,
      startDate: startDate || null,
      endDate: endDate || null,
      summary: {
        initDebit: sumInitDebit,
        initCredit: sumInitCredit,
        initBalanced: Math.abs(sumInitDebit - sumInitCredit) < 0.01,
        periodDebit: sumPeriodDebit,
        periodCredit: sumPeriodCredit,
        periodBalanced: Math.abs(sumPeriodDebit - sumPeriodCredit) < 0.01,
        endDebit: sumEndDebit,
        endCredit: sumEndCredit,
        endBalanced: Math.abs(sumEndDebit - sumEndCredit) < 0.01
      },
      rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. LABA RUGI KOMPREHENSIF (INCOME STATEMENT)
router.get('/income-statement', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { startDate, endDate } = req.query;
    const balances = getAccountBalances(entityId, startDate, endDate);

    // Grouping
    const revenues = [];
    const cogs = [];
    const opex = [];
    const otherRevenues = [];
    const otherExpenses = [];
    const taxes = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOpex = 0;
    let totalOtherRev = 0;
    let totalOtherExp = 0;
    let totalTaxExp = 0;

    balances.forEach(acc => {
      // Income statement uses period movements
      const pDebit = acc.period_debit;
      const pCredit = acc.period_credit;
      let net = 0;

      if (acc.category === 'PENDAPATAN') {
        net = pCredit - pDebit;
        if (net !== 0) {
          revenues.push({ ...acc, amount: net });
          totalRevenue += net;
        }
      } else if (acc.category === 'HPP') {
        net = pDebit - pCredit;
        if (net !== 0) {
          cogs.push({ ...acc, amount: net });
          totalCogs += net;
        }
      } else if (acc.category === 'BEBAN_OPERASIONAL') {
        net = pDebit - pCredit;
        if (net !== 0) {
          opex.push({ ...acc, amount: net });
          totalOpex += net;
        }
      } else if (acc.category === 'PENDAPATAN_LAIN') {
        net = pCredit - pDebit;
        if (net !== 0) {
          otherRevenues.push({ ...acc, amount: net });
          totalOtherRev += net;
        }
      } else if (acc.category === 'BEBAN_LAIN') {
        net = pDebit - pCredit;
        if (net !== 0) {
          otherExpenses.push({ ...acc, amount: net });
          totalOtherExp += net;
        }
      } else if (acc.category === 'PAJAK') {
        net = pDebit - pCredit;
        if (net !== 0) {
          taxes.push({ ...acc, amount: net });
          totalTaxExp += net;
        }
      }
    });

    const grossProfit = totalRevenue - totalCogs;
    const operatingIncome = grossProfit - totalOpex;
    const earningsBeforeTax = operatingIncome + totalOtherRev - totalOtherExp;
    
    // Auto calculate estimated tax if none recorded yet in journal
    const estimatedTax = totalTaxExp !== 0 ? totalTaxExp : Math.max(0, earningsBeforeTax * 0.11);
    const netIncome = earningsBeforeTax - estimatedTax;

    res.json({
      entityId,
      startDate: startDate || null,
      endDate: endDate || null,
      revenues: { items: revenues, total: totalRevenue },
      cogs: { items: cogs, total: totalCogs },
      grossProfit,
      opex: { items: opex, total: totalOpex },
      operatingIncome, // EBIT
      otherIncomeExpenses: {
        otherRevenues: { items: otherRevenues, total: totalOtherRev },
        otherExpenses: { items: otherExpenses, total: totalOtherExp },
        netOther: totalOtherRev - totalOtherExp
      },
      earningsBeforeTax, // EBT
      taxes: { items: taxes, total: estimatedTax },
      netIncome
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. NERACA (BALANCE SHEET / STATEMENT OF FINANCIAL POSITION)
router.get('/balance-sheet', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const asOfDate = req.query.as_of_date || req.query.endDate || new Date().toISOString().slice(0, 10);
    const balances = getAccountBalances(entityId, null, asOfDate);

    // Compute Net Income up to asOfDate
    let totalRev = 0, totalExp = 0;
    balances.forEach(acc => {
      if (acc.category === 'PENDAPATAN' || acc.category === 'PENDAPATAN_LAIN') {
        totalRev += (acc.period_credit - acc.period_debit);
      } else if (acc.category === 'HPP' || acc.category === 'BEBAN_OPERASIONAL' || acc.category === 'BEBAN_LAIN' || acc.category === 'PAJAK') {
        totalExp += (acc.period_debit - acc.period_credit);
      }
    });
    const currentPeriodNetIncome = totalRev - totalExp;

    const currentAssets = [];
    const nonCurrentAssets = [];
    const currentLiabilities = [];
    const longTermLiabilities = [];
    const equities = [];

    let totalCurrentAssets = 0;
    let totalNonCurrentAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalLongTermLiabilities = 0;
    let totalEquities = 0;

    balances.forEach(acc => {
      const bal = acc.ending_balance;
      if (bal === 0) return;

      if (acc.category === 'ASET_LANCAR') {
        currentAssets.push({ ...acc, amount: bal });
        totalCurrentAssets += bal;
      } else if (acc.category === 'ASET_TETAP') {
        nonCurrentAssets.push({ ...acc, amount: bal });
        totalNonCurrentAssets += bal;
      } else if (acc.category === 'KEWAJIBAN_LANCAR') {
        currentLiabilities.push({ ...acc, amount: bal });
        totalCurrentLiabilities += bal;
      } else if (acc.category === 'KEWAJIBAN_JK_PANJANG') {
        longTermLiabilities.push({ ...acc, amount: bal });
        totalLongTermLiabilities += bal;
      } else if (acc.category === 'EKUITAS') {
        equities.push({ ...acc, amount: bal });
        totalEquities += bal;
      }
    });

    // Add current period net income to equity
    totalEquities += currentPeriodNetIncome;

    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquities;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

    res.json({
      entityId,
      asOfDate,
      assets: {
        currentAssets: { items: currentAssets, total: totalCurrentAssets },
        nonCurrentAssets: { items: nonCurrentAssets, total: totalNonCurrentAssets },
        totalAssets
      },
      liabilities: {
        currentLiabilities: { items: currentLiabilities, total: totalCurrentLiabilities },
        longTermLiabilities: { items: longTermLiabilities, total: totalLongTermLiabilities },
        totalLiabilities
      },
      equity: {
        items: equities,
        currentPeriodNetIncome,
        totalEquity: totalEquities
      },
      totalLiabilitiesAndEquity,
      difference: totalAssets - totalLiabilitiesAndEquity,
      isBalanced
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ARUS KAS (STATEMENT OF CASH FLOWS)
router.get('/cash-flow', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [entityId];
    if (startDate) {
      dateFilter += ` AND j.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND j.date <= ?`;
      params.push(endDate);
    }

    // Cash and Bank accounts: codes starting with '1101', '1102', '1103', '1104'
    const cashMovements = db.prepare(`
      SELECT ji.debit, ji.credit, j.journal_type, j.description, j.date, a.code as acc_code, a.category as acc_cat
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.code IN ('1101', '1102', '1103', '1104') ${dateFilter}
      ORDER BY j.date ASC
    `).all(...params);

    let operatingIn = 0;
    let operatingOut = 0;
    let investingOut = 0;
    let financingIn = 0;
    let financingOut = 0;

    cashMovements.forEach(m => {
      const d = Number(m.debit) || 0;
      const c = Number(m.credit) || 0;

      if (m.journal_type === 'SALES' || m.journal_type === 'CASH_IN') {
        operatingIn += d;
      } else if (m.journal_type === 'PURCHASE' || m.journal_type === 'CASH_OUT') {
        operatingOut += c;
      } else if (m.journal_type === 'GENERAL' || m.journal_type === 'TAX') {
        if (d > 0) operatingIn += d;
        if (c > 0) operatingOut += c;
      }
    });

    const netOperating = operatingIn - operatingOut;
    const netInvesting = -investingOut;
    const netFinancing = financingIn - financingOut;
    const netCashChange = netOperating + netInvesting + netFinancing;

    // Opening cash balance
    const initCashRow = db.prepare(`
      SELECT 
        COALESCE(SUM(ib.debit - ib.credit), 0) as init_cash
      FROM initial_balances ib
      JOIN accounts a ON a.id = ib.account_id
      WHERE ib.entity_id = ? AND a.code IN ('1101', '1102', '1103', '1104')
    `).get(entityId);

    const openingCash = Number(initCashRow.init_cash) || 0;
    const closingCash = openingCash + netCashChange;

    res.json({
      entityId,
      period: { startDate, endDate },
      operatingActivities: {
        receiptsFromCustomers: operatingIn,
        paymentsToSuppliersAndExpenses: operatingOut,
        netCashFromOperations: netOperating
      },
      investingActivities: {
        purchaseOfFixedAssets: investingOut,
        netCashFromInvesting: netInvesting
      },
      financingActivities: {
        capitalContribution: financingIn,
        dividendOrLoanPayments: financingOut,
        netCashFromFinancing: netFinancing
      },
      summary: {
        netCashChange,
        openingCashBalance: openingCash,
        closingCashBalance: closingCash
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. PERUBAHAN EKUITAS (STATEMENT OF CHANGES IN EQUITY)
router.get('/equity-changes', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;

    // Get equity initial balances
    const equityAccounts = db.prepare(`
      SELECT a.id, a.code, a.name, a.sub_category,
             COALESCE(ib.credit - ib.debit, 0) as beginning_balance
      FROM accounts a
      LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ?
      WHERE a.entity_id = ? AND a.category = 'EKUITAS'
      ORDER BY a.code ASC
    `).all(entityId, entityId);

    // Compute Net Income for the period
    const rev = db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as r
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category IN ('PENDAPATAN', 'PENDAPATAN_LAIN') AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const exp = db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as e
      FROM journal_items ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN accounts a ON a.id = ji.account_id
      WHERE j.entity_id = ? AND a.category IN ('HPP', 'BEBAN_OPERASIONAL', 'BEBAN_LAIN', 'PAJAK') AND strftime('%Y', j.date) = ?
    `).get(entityId, String(year));

    const netIncome = (Number(rev.r) || 0) - (Number(exp.e) || 0);

    let totalBeginningEquity = 0;
    let totalEndingEquity = 0;

    const sections = equityAccounts.map(acc => {
      const beg = Number(acc.beginning_balance) || 0;
      totalBeginningEquity += beg;

      let additions = 0;
      let deductions = 0;

      if (acc.code === '3202' || acc.code === '3201') {
        // Retained Earnings / Current Period Net Income
        additions = netIncome;
      }

      const end = beg + additions - deductions;
      totalEndingEquity += end;

      return {
        ...acc,
        beginning_balance: beg,
        additions,
        deductions,
        ending_balance: end
      };
    });

    res.json({
      entityId,
      year,
      totalBeginningEquity,
      currentYearNetIncome: netIncome,
      totalEndingEquity,
      sections
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ANALISIS RASIO KEUANGAN, EBITDA & OPEX
router.get('/analysis', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const asOfDate = req.query.as_of_date || new Date().toISOString().slice(0, 10);
    const year = new Date(asOfDate).getFullYear();

    const balances = getAccountBalances(entityId, null, asOfDate);

    // Balance Sheet totals
    let kasBank = 0;
    let piutang = 0;
    let persediaan = 0;
    let asetLancar = 0;
    let totalAset = 0;
    let hutangLancar = 0;
    let totalHutang = 0;
    let totalEkuitas = 0;

    balances.forEach(acc => {
      const bal = acc.ending_balance;
      if (acc.category === 'ASET_LANCAR') {
        asetLancar += bal;
        if (acc.code.startsWith('1101') || acc.code.startsWith('1102') || acc.code.startsWith('1103') || acc.code.startsWith('1104')) kasBank += bal;
        if (acc.code === '1105' || acc.code === '1106') piutang += bal;
        if (acc.code === '1108' || acc.code === '1109') persediaan += bal;
      }
      if (acc.category === 'ASET_LANCAR' || acc.category === 'ASET_TETAP') totalAset += bal;
      if (acc.category === 'KEWAJIBAN_LANCAR') hutangLancar += bal;
      if (acc.category === 'KEWAJIBAN_LANCAR' || acc.category === 'KEWAJIBAN_JK_PANJANG') totalHutang += bal;
      if (acc.category === 'EKUITAS') totalEkuitas += bal;
    });

    // Income Statement movements
    let omzet = 0, hpp = 0, opex = 0, penyusutan = 0, bunga = 0, labaBersih = 0;
    const opexBreakdown = [];

    balances.forEach(acc => {
      const pD = acc.period_debit;
      const pC = acc.period_credit;
      if (acc.category === 'PENDAPATAN') omzet += (pC - pD);
      if (acc.category === 'HPP') hpp += (pD - pC);
      if (acc.category === 'BEBAN_OPERASIONAL') {
        const amt = pD - pC;
        opex += amt;
        if (acc.code === '6110') penyusutan += amt;
        if (amt > 0) {
          opexBreakdown.push({
            code: acc.code,
            name: acc.name,
            sub: acc.sub_category,
            amount: amt
          });
        }
      }
      if (acc.code === '7201') bunga += (pD - pC);
    });

    const labaKotor = omzet - hpp;
    const ebit = labaKotor - opex;
    const ebitda = ebit + penyusutan;
    labaBersih = ebit - bunga;

    // RATIOS
    // 1. Likuiditas
    const currentRatio = hutangLancar > 0 ? (asetLancar / hutangLancar) : 0;
    const quickRatio = hutangLancar > 0 ? ((asetLancar - persediaan) / hutangLancar) : 0;
    const cashRatio = hutangLancar > 0 ? (kasBank / hutangLancar) : 0;
    const workingCapital = asetLancar - hutangLancar;

    // 2. Solvabilitas / Leverage
    const debtToAssetRatio = totalAset > 0 ? (totalHutang / totalAset) * 100 : 0;
    const debtToEquityRatio = totalEkuitas > 0 ? (totalHutang / totalEkuitas) * 100 : 0;
    const interestCoverage = bunga > 0 ? (ebit / bunga) : 999;

    // 3. Profitabilitas
    const grossProfitMargin = omzet > 0 ? (labaKotor / omzet) * 100 : 0;
    const operatingProfitMargin = omzet > 0 ? (ebit / omzet) * 100 : 0;
    const netProfitMargin = omzet > 0 ? (labaBersih / omzet) * 100 : 0;
    const returnOnAssets = totalAset > 0 ? (labaBersih / totalAset) * 100 : 0;
    const returnOnEquity = totalEkuitas > 0 ? (labaBersih / totalEkuitas) * 100 : 0;

    // 4. Aktivitas
    const assetTurnover = totalAset > 0 ? (omzet / totalAset) : 0;
    const dso = omzet > 0 ? (piutang / omzet) * 365 : 0; // Days Sales Outstanding

    res.json({
      entityId,
      asOfDate,
      ebitdaAnalysis: {
        revenue: omzet,
        cogs: hpp,
        grossProfit: labaKotor,
        opexTotal: opex,
        depreciationAmortization: penyusutan,
        ebitda,
        ebitdaMargin: omzet > 0 ? (ebitda / omzet) * 100 : 0,
        ebit,
        ebitMargin: operatingProfitMargin,
        netIncome: labaBersih
      },
      opexAnalysis: {
        totalOpex: opex,
        opexRatioToRevenue: omzet > 0 ? (opex / omzet) * 100 : 0,
        items: opexBreakdown.sort((a, b) => b.amount - a.amount).map(it => ({
          ...it,
          pctOfOpex: opex > 0 ? (it.amount / opex) * 100 : 0,
          pctOfRevenue: omzet > 0 ? (it.amount / omzet) * 100 : 0
        }))
      },
      financialRatios: {
        liquidity: {
          currentRatio: Number(currentRatio.toFixed(2)),
          quickRatio: Number(quickRatio.toFixed(2)),
          cashRatio: Number(cashRatio.toFixed(2)),
          netWorkingCapital: workingCapital,
          health: currentRatio >= 1.5 ? 'HEALTHY' : (currentRatio >= 1.0 ? 'MODERATE' : 'TIGHT')
        },
        solvency: {
          debtToAssetRatio: Number(debtToAssetRatio.toFixed(2)),
          debtToEquityRatio: Number(debtToEquityRatio.toFixed(2)),
          interestCoverageRatio: Number(interestCoverage.toFixed(2)),
          health: debtToEquityRatio <= 150 ? 'HEALTHY' : 'LEVERAGED'
        },
        profitability: {
          grossProfitMargin: Number(grossProfitMargin.toFixed(2)),
          operatingProfitMargin: Number(operatingProfitMargin.toFixed(2)),
          netProfitMargin: Number(netProfitMargin.toFixed(2)),
          returnOnAssets: Number(returnOnAssets.toFixed(2)),
          returnOnEquity: Number(returnOnEquity.toFixed(2))
        },
        activity: {
          totalAssetTurnover: Number(assetTurnover.toFixed(2)),
          daysSalesOutstanding: Number(dso.toFixed(1))
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. LAMPIRAN AUDITOR (AUDITOR PACK / CATATAN ATAS LAPORAN KEUANGAN)
router.get('/auditor-pack', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const year = Number(req.query.year) || 2026;

    const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(entityId);
    if (!entity) return res.status(404).json({ error: 'Entitas tidak ditemukan' });

    // Schedule of Cash & Banks
    const cashList = db.prepare(`
      SELECT a.code, a.name, 
        COALESCE(ib.debit, 0) + COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0) as balance
      FROM accounts a
      LEFT JOIN initial_balances ib ON ib.account_id = a.id AND ib.entity_id = ?
      LEFT JOIN journal_items ji ON ji.account_id = a.id
      LEFT JOIN journals j ON j.id = ji.journal_id AND j.entity_id = ?
      WHERE a.entity_id = ? AND a.code IN ('1101', '1102', '1103', '1104')
      GROUP BY a.id
    `).all(entityId, entityId, entityId);

    // Schedule of Fixed Assets
    const assets = db.prepare(`SELECT * FROM fixed_assets WHERE entity_id = ?`).all(entityId);

    // Schedule of AR & AP
    const arInvoices = db.prepare(`
      SELECT inv.*, c.name as contact_name FROM invoices inv
      JOIN contacts c ON c.id = inv.contact_id
      WHERE inv.entity_id = ? AND inv.invoice_type = 'AR'
    `).all(entityId);

    const apInvoices = db.prepare(`
      SELECT inv.*, c.name as contact_name FROM invoices inv
      JOIN contacts c ON c.id = inv.contact_id
      WHERE inv.entity_id = ? AND inv.invoice_type = 'AP'
    `).all(entityId);

    res.json({
      entity,
      year,
      notes: [
        {
          noteNumber: 'Catatan 1',
          title: 'Umum & Kebijakan Akuntansi',
          content: `${entity.name} didirikan di Indonesia dengan NPWP ${entity.npwp} dan terdaftar pada ${entity.kpp}. Laporan keuangan disusun berdasarkan Standar Akuntansi Keuangan di Indonesia (SAK/PSAK) menggunakan basis akrual dan metode historis. Persediaan dinilai dengan metode rata-rata tertimbang (Weighted Average). Aktiva tetap disusutkan dengan metode garis lurus (Straight-Line Method). Pajak penghasilan dihitung sesuai peraturan perpajakan yang berlaku (UU HPP / PSAK 46).`
        },
        {
          noteNumber: 'Catatan 2',
          title: 'Kas dan Setara Kas',
          items: cashList,
          total: cashList.reduce((s, it) => s + (Number(it.balance) || 0), 0)
        },
        {
          noteNumber: 'Catatan 3',
          title: 'Piutang Usaha',
          items: arInvoices,
          totalOutstanding: arInvoices.reduce((s, it) => s + (Number(it.balance_due) || 0), 0)
        },
        {
          noteNumber: 'Catatan 4',
          title: 'Hutang Usaha',
          items: apInvoices,
          totalOutstanding: apInvoices.reduce((s, it) => s + (Number(it.balance_due) || 0), 0)
        },
        {
          noteNumber: 'Catatan 5',
          title: 'Aset Tetap & Penyusutan',
          items: assets,
          totalCost: assets.reduce((s, it) => s + (Number(it.acquisition_cost) || 0), 0)
        },
        {
          noteNumber: 'Catatan 6',
          title: 'Perpajakan & Rekonsiliasi Fiskal (PSAK 46)',
          content: 'Pajak tangguhan diakui atas semua perbedaan temporer antara dasar pengenaan pajak atas aset dan liabilitas dengan nilai tercatatnya untuk tujuan pelaporan keuangan sesuai PSAK 46.'
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
