const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// GET all inventory items
router.get('/items', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const items = db.prepare(`
      SELECT i.*, 
        (i.current_stock * i.cost_price) as total_valuation,
        CASE WHEN i.current_stock <= i.min_stock THEN 1 ELSE 0 END as is_low_stock
      FROM inventory_items i
      WHERE i.entity_id = ?
      ORDER BY i.name ASC
    `).all(entityId);

    const totalStockValue = items.reduce((sum, it) => sum + (Number(it.total_valuation) || 0), 0);
    const lowStockCount = items.filter(it => it.is_low_stock === 1).length;

    res.json({
      items,
      totalStockValue,
      totalSKU: items.length,
      lowStockCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE inventory item
router.post('/items', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { sku, name, category, unit, cost_price, selling_price, current_stock, min_stock, inventory_account_id, cogs_account_id, sales_account_id } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU dan Nama Barang wajib diisi' });
    }

    const exists = db.prepare(`SELECT id FROM inventory_items WHERE entity_id = ? AND sku = ?`).get(entityId, sku);
    if (exists) {
      return res.status(400).json({ error: `SKU ${sku} sudah terdaftar` });
    }

    const id = 'ITEM-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO inventory_items (id, entity_id, sku, name, category, unit, cost_price, selling_price, current_stock, min_stock, inventory_account_id, cogs_account_id, sales_account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entityId, sku, name, category || 'Umum', unit || 'PCS',
      Number(cost_price) || 0, Number(selling_price) || 0,
      Number(current_stock) || 0, Number(min_stock) || 5,
      inventory_account_id || null, cogs_account_id || null, sales_account_id || null
    );

    res.json({ success: true, id, message: 'Barang persediaan berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE inventory item
router.put('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { sku, name, category, unit, cost_price, selling_price, min_stock, inventory_account_id, cogs_account_id, sales_account_id } = req.body;

    db.prepare(`
      UPDATE inventory_items SET
        sku = ?, name = ?, category = ?, unit = ?, cost_price = ?, selling_price = ?, min_stock = ?,
        inventory_account_id = ?, cogs_account_id = ?, sales_account_id = ?
      WHERE id = ?
    `).run(
      sku, name, category, unit, Number(cost_price) || 0, Number(selling_price) || 0, Number(min_stock) || 5,
      inventory_account_id || null, cogs_account_id || null, sales_account_id || null, id
    );

    res.json({ success: true, message: 'Data persediaan berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Stock Card (Kartu Stok) for a specific item
router.get('/stock-card/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const entityId = req.query.entity_id || getActiveEntityId();
    const item = db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(itemId);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan' });

    const txs = db.prepare(`
      SELECT * FROM inventory_transactions
      WHERE item_id = ? AND entity_id = ?
      ORDER BY date ASC, created_at ASC
    `).all(itemId, entityId);

    let runningQty = 0;
    let runningValuation = 0;

    const stockCard = txs.map(t => {
      const qty = Number(t.qty) || 0;
      const unitCost = Number(t.unit_cost) || 0;
      const totalCost = Number(t.total_cost) || 0;

      let inQty = 0, inCost = 0, outQty = 0, outCost = 0;

      if (t.tx_type === 'IN') {
        inQty = qty;
        inCost = totalCost;
        runningQty += qty;
        runningValuation += totalCost;
      } else if (t.tx_type === 'OUT') {
        outQty = qty;
        outCost = totalCost;
        runningQty -= qty;
        runningValuation -= totalCost;
      } else if (t.tx_type === 'ADJUSTMENT') {
        const diff = qty - runningQty;
        if (diff >= 0) {
          inQty = diff;
          inCost = diff * unitCost;
        } else {
          outQty = Math.abs(diff);
          outCost = Math.abs(diff) * unitCost;
        }
        runningQty = qty;
        runningValuation = runningQty * unitCost;
      }

      const avgUnitCost = runningQty > 0 ? (runningValuation / runningQty) : unitCost;

      return {
        ...t,
        in_qty: inQty,
        in_cost: inCost,
        out_qty: outQty,
        out_cost: outCost,
        balance_qty: runningQty,
        avg_cost: avgUnitCost,
        balance_valuation: runningValuation
      };
    });

    res.json({
      item,
      current_stock: runningQty || item.current_stock,
      current_valuation: runningValuation || (item.current_stock * item.cost_price),
      transactions: stockCard
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST inventory transaction (Mutasi Stok IN, OUT, ADJUSTMENT)
router.post('/transactions', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { item_id, date, tx_type, qty, unit_cost, reference_no, notes, auto_journal } = req.body;

    const item = db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(item_id);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan' });

    const q = Number(qty) || 0;
    const cost = Number(unit_cost) !== undefined && Number(unit_cost) > 0 ? Number(unit_cost) : item.cost_price;
    const totalCost = q * cost;

    let newStock = item.current_stock;
    if (tx_type === 'IN') {
      newStock += q;
    } else if (tx_type === 'OUT') {
      if (item.current_stock < q) {
        return res.status(400).json({ error: `Stok tidak mencukupi! Stok saat ini: ${item.current_stock} ${item.unit}` });
      }
      newStock -= q;
    } else if (tx_type === 'ADJUSTMENT') {
      newStock = q;
    }

    const txId = 'ITX-' + Date.now().toString(36).toUpperCase();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO inventory_transactions (id, entity_id, item_id, date, tx_type, qty, unit_cost, total_cost, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(txId, entityId, item_id, date, tx_type, q, cost, totalCost, reference_no || '', notes || '');

      db.prepare(`
        UPDATE inventory_items SET current_stock = ?, cost_price = ? WHERE id = ?
      `).run(newStock, cost, item_id);

      // Auto-journal entry if requested
      if (auto_journal && item.inventory_account_id && item.cogs_account_id) {
        const jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
        const jrnNum = `JU-STK-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

        if (tx_type === 'OUT') {
          // Debit COGS, Credit Inventory
          db.prepare(`
            INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount)
            VALUES (?, ?, ?, ?, 'GENERAL', ?, ?, ?)
          `).run(jrnId, entityId, jrnNum, date, reference_no || txId, `Pemakaian/Penjualan Stok: ${item.name} (${q} ${item.unit})`, totalCost);

          db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
            `JI-${jrnId}-1`, jrnId, item.cogs_account_id, totalCost, 0, 'HPP Barang'
          );
          db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
            `JI-${jrnId}-2`, jrnId, item.inventory_account_id, 0, totalCost, 'Pengurangan Persediaan'
          );
        }
      }

      db.exec('COMMIT;');
      res.json({ success: true, id: txId, newStock, message: 'Mutasi persediaan berhasil dicatat' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
