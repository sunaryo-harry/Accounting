const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { getActiveEntityId } = require('./entities');

// Setup Multer for upload proof documents (Surat Jalan, BAP Opname, etc.)
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
    cb(null, 'BUKTI-GUDANG-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Helper to get or create stock record for item in warehouse
function getOrCreateWarehouseStock(entityId, itemId, warehouseId) {
  let row = db.prepare(`
    SELECT * FROM inventory_warehouse_stocks 
    WHERE entity_id = ? AND item_id = ? AND warehouse_id = ?
  `).get(entityId, itemId, warehouseId);

  if (!row) {
    const id = `STK-${itemId}-${warehouseId}`;
    db.prepare(`
      INSERT OR IGNORE INTO inventory_warehouse_stocks (id, entity_id, item_id, warehouse_id, stock)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, entityId, itemId, warehouseId);
    row = { id, entity_id: entityId, item_id: itemId, warehouse_id: warehouseId, stock: 0 };
  }
  return row;
}

// -------------------------------------------------------------
// 1. MASTER MULTI GUDANG (WAREHOUSES)
// -------------------------------------------------------------

// GET all warehouses for active entity with stock statistics
router.get('/warehouses', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();

    const warehouses = db.prepare(`
      SELECT w.*, 
        a.code as account_code, a.name as account_name,
        COALESCE(SUM(iws.stock), 0) as total_stock_qty,
        COALESCE(COUNT(CASE WHEN iws.stock > 0 THEN 1 END), 0) as total_sku_stored,
        COALESCE(SUM(iws.stock * i.cost_price), 0) as total_valuation
      FROM warehouses w
      LEFT JOIN accounts a ON a.id = w.inventory_account_id
      LEFT JOIN inventory_warehouse_stocks iws ON iws.warehouse_id = w.id
      LEFT JOIN inventory_items i ON i.id = iws.item_id
      WHERE w.entity_id = ?
      GROUP BY w.id
      ORDER BY w.code ASC
    `).all(entityId);

    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE new warehouse
router.post('/warehouses', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { code, name, location, pic, inventory_account_id } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Kode dan Nama Gudang wajib diisi' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const cleanName = String(name).trim();

    const exists = db.prepare(`SELECT id FROM warehouses WHERE entity_id = ? AND UPPER(code) = ?`).get(entityId, cleanCode);
    if (exists) {
      return res.status(400).json({ error: `Gudang dengan kode ${cleanCode} sudah terdaftar` });
    }

    const id = `WH-${entityId}-${Date.now().toString(36).toUpperCase()}`;
    db.prepare(`
      INSERT INTO warehouses (id, entity_id, code, name, location, pic, inventory_account_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, entityId, cleanCode, cleanName, location || '', pic || '', inventory_account_id || null);

    // Initialize 0 stock rows for all existing items in this entity
    const items = db.prepare(`SELECT id FROM inventory_items WHERE entity_id = ?`).all(entityId);
    const stockStmt = db.prepare(`
      INSERT OR IGNORE INTO inventory_warehouse_stocks (id, entity_id, item_id, warehouse_id, stock)
      VALUES (?, ?, ?, ?, 0)
    `);
    items.forEach(it => {
      stockStmt.run(`STK-${it.id}-${id}`, entityId, it.id, id);
    });

    res.json({ success: true, id, message: `Gudang ${cleanName} berhasil ditambahkan` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE warehouse
router.put('/warehouses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, location, pic, inventory_account_id, is_active } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Kode dan Nama Gudang wajib diisi' });
    }

    db.prepare(`
      UPDATE warehouses SET
        code = ?, name = ?, location = ?, pic = ?, inventory_account_id = ?, is_active = ?
      WHERE id = ?
    `).run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      location || '',
      pic || '',
      inventory_account_id || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id
    );

    res.json({ success: true, message: 'Data gudang berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE warehouse
router.delete('/warehouses/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if warehouse has active stock
    const stockCheck = db.prepare(`
      SELECT SUM(stock) as total_stock 
      FROM inventory_warehouse_stocks 
      WHERE warehouse_id = ?
    `).get(id);

    if (stockCheck && Number(stockCheck.total_stock) > 0) {
      return res.status(400).json({ 
        error: `Gudang tidak dapat dihapus karena masih memiliki stok ${stockCheck.total_stock} unit. Lakukan transfer stok ke gudang lain terlebih dahulu.` 
      });
    }

    // Check if warehouse has transaction records
    const txCheck = db.prepare(`
      SELECT COUNT(*) as count 
      FROM inventory_transactions 
      WHERE warehouse_id = ? OR from_warehouse_id = ? OR to_warehouse_id = ?
    `).get(id, id, id);

    if (txCheck && txCheck.count > 0) {
      // Soft-delete / deactivate instead
      db.prepare(`UPDATE warehouses SET is_active = 0 WHERE id = ?`).run(id);
      return res.json({ success: true, message: 'Gudang dinonaktifkan karena telah memiliki riwayat mutasi/transaksi' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`DELETE FROM inventory_warehouse_stocks WHERE warehouse_id = ?`).run(id);
      db.prepare(`DELETE FROM warehouses WHERE id = ?`).run(id);
      db.exec('COMMIT;');
      res.json({ success: true, message: 'Gudang berhasil dihapus' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. MASTER BARANG PERSADAAN DENGAN RINCIAN MULTI GUDANG
// -------------------------------------------------------------

// GET all inventory items with breakdown of stocks per warehouse
router.get('/items', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();

    const items = db.prepare(`
      SELECT i.*, 
        (i.current_stock * i.cost_price) as total_valuation,
        CASE WHEN i.current_stock <= i.min_stock THEN 1 ELSE 0 END as is_low_stock,
        ia.code as inventory_account_code, ia.name as inventory_account_name,
        ca.code as cogs_account_code, ca.name as cogs_account_name
      FROM inventory_items i
      LEFT JOIN accounts ia ON ia.id = i.inventory_account_id
      LEFT JOIN accounts ca ON ca.id = i.cogs_account_id
      WHERE i.entity_id = ?
      ORDER BY i.name ASC
    `).all(entityId);

    // Get stock breakdown per warehouse
    const whStocks = db.prepare(`
      SELECT iws.item_id, iws.warehouse_id, iws.stock,
             w.code as warehouse_code, w.name as warehouse_name
      FROM inventory_warehouse_stocks iws
      JOIN warehouses w ON w.id = iws.warehouse_id
      WHERE iws.entity_id = ?
    `).all(entityId);

    const stocksByItem = {};
    whStocks.forEach(s => {
      if (!stocksByItem[s.item_id]) stocksByItem[s.item_id] = [];
      stocksByItem[s.item_id].push({
        warehouse_id: s.warehouse_id,
        warehouse_code: s.warehouse_code,
        warehouse_name: s.warehouse_name,
        stock: Number(s.stock) || 0
      });
    });

    const itemsWithWarehouses = items.map(it => ({
      ...it,
      warehouse_stocks: stocksByItem[it.id] || []
    }));

    const totalStockValue = items.reduce((sum, it) => sum + (Number(it.total_valuation) || 0), 0);
    const lowStockCount = items.filter(it => it.is_low_stock === 1).length;

    res.json({
      items: itemsWithWarehouses,
      totalStockValue,
      totalSKU: items.length,
      lowStockCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE inventory item with optional warehouse assignment
router.post('/items', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { 
      sku, name, category, unit, cost_price, selling_price, 
      current_stock, min_stock, inventory_account_id, cogs_account_id, 
      sales_account_id, warehouse_id 
    } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU dan Nama Barang wajib diisi' });
    }

    const cleanSku = String(sku).trim().toUpperCase();
    const exists = db.prepare(`SELECT id FROM inventory_items WHERE entity_id = ? AND sku = ?`).get(entityId, cleanSku);
    if (exists) {
      return res.status(400).json({ error: `SKU ${cleanSku} sudah terdaftar` });
    }

    const id = 'ITEM-' + Date.now().toString(36).toUpperCase();
    const stockQty = Number(current_stock) || 0;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO inventory_items (id, entity_id, sku, name, category, unit, cost_price, selling_price, current_stock, min_stock, inventory_account_id, cogs_account_id, sales_account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, entityId, cleanSku, String(name).trim(), category || 'Umum', unit || 'PCS',
        Number(cost_price) || 0, Number(selling_price) || 0,
        stockQty, Number(min_stock) || 5,
        inventory_account_id || null, cogs_account_id || null, sales_account_id || null
      );

      // Distribute to warehouses
      const warehouses = db.prepare(`SELECT id FROM warehouses WHERE entity_id = ? ORDER BY code ASC`).all(entityId);
      const targetWhId = warehouse_id || warehouses[0]?.id;

      warehouses.forEach(wh => {
        const assignedStock = (wh.id === targetWhId) ? stockQty : 0;
        db.prepare(`
          INSERT INTO inventory_warehouse_stocks (id, entity_id, item_id, warehouse_id, stock)
          VALUES (?, ?, ?, ?, ?)
        `).run(`STK-${id}-${wh.id}`, entityId, id, wh.id, assignedStock);
      });

      db.exec('COMMIT;');
      res.json({ success: true, id, message: 'Barang persediaan berhasil ditambahkan' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
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

// -------------------------------------------------------------
// 3. JURNAL & MUTASI PERSEDIAAN MULTI GUDANG (IN, OUT, TRANSFER, ADJUSTMENT)
// -------------------------------------------------------------

// GET all inventory journal transactions
router.get('/journals', (req, res) => {
  try {
    const entityId = req.query.entity_id || getActiveEntityId();
    const { warehouse_id, tx_type, startDate, endDate, search } = req.query;

    let query = `
      SELECT it.*,
        i.sku as item_sku, i.name as item_name, i.unit as item_unit,
        w.code as warehouse_code, w.name as warehouse_name,
        fw.code as from_warehouse_code, fw.name as from_warehouse_name,
        tw.code as to_warehouse_code, tw.name as to_warehouse_name,
        ca.code as contra_account_code, ca.name as contra_account_name,
        j.journal_number, j.journal_type
      FROM inventory_transactions it
      JOIN inventory_items i ON i.id = it.item_id
      LEFT JOIN warehouses w ON w.id = it.warehouse_id
      LEFT JOIN warehouses fw ON fw.id = it.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = it.to_warehouse_id
      LEFT JOIN accounts ca ON ca.id = it.contra_account_id
      LEFT JOIN journals j ON j.id = it.journal_id
      WHERE it.entity_id = ?
    `;
    const params = [entityId];

    if (warehouse_id && warehouse_id !== 'ALL') {
      query += ` AND (it.warehouse_id = ? OR it.from_warehouse_id = ? OR it.to_warehouse_id = ?)`;
      params.push(warehouse_id, warehouse_id, warehouse_id);
    }
    if (tx_type && tx_type !== 'ALL') {
      query += ` AND it.tx_type = ?`;
      params.push(tx_type);
    }
    if (startDate) {
      query += ` AND it.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND it.date <= ?`;
      params.push(endDate);
    }
    if (search) {
      query += ` AND (i.name LIKE ? OR i.sku LIKE ? OR it.reference_no LIKE ? OR it.notes LIKE ? OR j.journal_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY it.date DESC, it.created_at DESC`;

    const txs = db.prepare(query).all(...params);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST inventory transaction & auto-create journal entry
router.post('/transactions', upload.single('attachment'), (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { 
      item_id, date, tx_type, qty, unit_cost, 
      warehouse_id, from_warehouse_id, to_warehouse_id,
      contra_account_id, reference_no, notes, auto_journal 
    } = req.body;

    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    if (!item_id) return res.status(400).json({ error: 'Barang persediaan harus dipilih' });
    if (!date) return res.status(400).json({ error: 'Tanggal transaksi wajib diisi' });
    if (!tx_type) return res.status(400).json({ error: 'Jenis mutasi persediaan wajib dipilih' });

    const item = db.prepare(`SELECT * FROM inventory_items WHERE id = ? AND entity_id = ?`).get(item_id, entityId);
    if (!item) return res.status(404).json({ error: 'Data barang persediaan tidak ditemukan' });

    const q = Math.abs(Number(qty)) || 0;
    if (q <= 0 && tx_type !== 'ADJUSTMENT') {
      return res.status(400).json({ error: 'Kuantitas mutasi harus lebih besar dari 0' });
    }

    const cost = Number(unit_cost) > 0 ? Number(unit_cost) : (item.cost_price || 0);
    const txId = 'ITX-' + Date.now().toString(36).toUpperCase();

    // Default accounts lookup
    const defaultInvAcc = item.inventory_account_id || db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '1108' LIMIT 1`).get(entityId)?.id;
    const defaultCogsAcc = item.cogs_account_id || db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '5101' LIMIT 1`).get(entityId)?.id;
    const defaultApAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '2101' LIMIT 1`).get(entityId)?.id;
    const defaultOtherIncomeAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '7101' LIMIT 1`).get(entityId)?.id;

    db.exec('BEGIN TRANSACTION;');
    try {
      let totalCost = 0;
      let jrnId = null;
      let jrnNum = null;
      const doAutoJournal = (auto_journal === 'true' || auto_journal === true || auto_journal === '1');

      if (tx_type === 'IN') {
        // --- 1. BARANG MASUK KE GUDANG (IN) ---
        if (!warehouse_id) throw new Error('Gudang tujuan masuk wajib dipilih');
        const wh = db.prepare(`SELECT * FROM warehouses WHERE id = ?`).get(warehouse_id);
        if (!wh) throw new Error('Gudang tujuan tidak valid');

        totalCost = q * cost;
        const currentWhStock = getOrCreateWarehouseStock(entityId, item_id, warehouse_id);
        const newWhStock = Number(currentWhStock.stock) + q;
        const newItemStock = Number(item.current_stock) + q;

        // Update warehouse stock
        db.prepare(`UPDATE inventory_warehouse_stocks SET stock = ? WHERE id = ?`).run(newWhStock, currentWhStock.id);
        // Update item total stock and weighted average cost if cost is provided
        const newAvgCost = newItemStock > 0 ? (((item.current_stock * item.cost_price) + totalCost) / newItemStock) : cost;
        db.prepare(`UPDATE inventory_items SET current_stock = ?, cost_price = ? WHERE id = ?`).run(newItemStock, newAvgCost, item_id);

        if (doAutoJournal) {
          jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
          jrnNum = `JU-INV-IN-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
          const creditAcc = contra_account_id || defaultApAcc;
          const debitAcc = wh.inventory_account_id || defaultInvAcc;

          if (debitAcc && creditAcc && totalCost > 0) {
            db.prepare(`
              INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name)
              VALUES (?, ?, ?, ?, 'INVENTORY', ?, ?, ?, ?, ?)
            `).run(
              jrnId, entityId, jrnNum, date, reference_no || txId,
              `Penerimaan Persediaan Multi Gudang [${wh.name}]: ${item.name} (${q} ${item.unit})`,
              totalCost, attachmentPath, attachmentName
            );

            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-1`, jrnId, debitAcc, totalCost, 0, `Persediaan Masuk [${wh.code}]`
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-2`, jrnId, creditAcc, 0, totalCost, `Kewajiban / Kas Penerimaan Barang`
            );
          }
        }

        db.prepare(`
          INSERT INTO inventory_transactions (
            id, entity_id, item_id, date, tx_type, qty, unit_cost, total_cost, 
            warehouse_id, contra_account_id, reference_no, notes, attachment_path, attachment_name, journal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txId, entityId, item_id, date, 'IN', q, cost, totalCost,
          warehouse_id, contra_account_id || defaultApAcc, reference_no || '', notes || '',
          attachmentPath, attachmentName, jrnId
        );

      } else if (tx_type === 'OUT') {
        // --- 2. BARANG KELUAR DARI GUDANG (OUT / PEMAKAIAN / HPP) ---
        if (!warehouse_id) throw new Error('Gudang asal pengeluaran wajib dipilih');
        const wh = db.prepare(`SELECT * FROM warehouses WHERE id = ?`).get(warehouse_id);
        if (!wh) throw new Error('Gudang asal tidak valid');

        const currentWhStock = getOrCreateWarehouseStock(entityId, item_id, warehouse_id);
        if (Number(currentWhStock.stock) < q) {
          throw new Error(`Stok di ${wh.name} tidak mencukupi! Tersedia: ${currentWhStock.stock} ${item.unit}, diminta: ${q} ${item.unit}`);
        }

        totalCost = q * cost;
        const newWhStock = Number(currentWhStock.stock) - q;
        const newItemStock = Number(item.current_stock) - q;

        db.prepare(`UPDATE inventory_warehouse_stocks SET stock = ? WHERE id = ?`).run(newWhStock, currentWhStock.id);
        db.prepare(`UPDATE inventory_items SET current_stock = ? WHERE id = ?`).run(newItemStock, item_id);

        if (doAutoJournal) {
          jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
          jrnNum = `JU-INV-OUT-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
          const debitAcc = contra_account_id || defaultCogsAcc;
          const creditAcc = wh.inventory_account_id || defaultInvAcc;

          if (debitAcc && creditAcc && totalCost > 0) {
            db.prepare(`
              INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name)
              VALUES (?, ?, ?, ?, 'INVENTORY', ?, ?, ?, ?, ?)
            `).run(
              jrnId, entityId, jrnNum, date, reference_no || txId,
              `Pengeluaran Persediaan Multi Gudang [${wh.name}]: ${item.name} (${q} ${item.unit})`,
              totalCost, attachmentPath, attachmentName
            );

            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-1`, jrnId, debitAcc, totalCost, 0, `HPP / Beban Pemakaian [${wh.code}]`
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-2`, jrnId, creditAcc, 0, totalCost, `Pengurangan Persediaan [${wh.code}]`
            );
          }
        }

        db.prepare(`
          INSERT INTO inventory_transactions (
            id, entity_id, item_id, date, tx_type, qty, unit_cost, total_cost, 
            warehouse_id, contra_account_id, reference_no, notes, attachment_path, attachment_name, journal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txId, entityId, item_id, date, 'OUT', q, cost, totalCost,
          warehouse_id, contra_account_id || defaultCogsAcc, reference_no || '', notes || '',
          attachmentPath, attachmentName, jrnId
        );

      } else if (tx_type === 'TRANSFER') {
        // --- 3. MUTASI / TRANSFER ANTAR GUDANG (TRANSFER) ---
        if (!from_warehouse_id || !to_warehouse_id) {
          throw new Error('Gudang Asal dan Gudang Tujuan wajib dipilih');
        }
        if (from_warehouse_id === to_warehouse_id) {
          throw new Error('Gudang Asal dan Gudang Tujuan tidak boleh sama');
        }

        const fromWh = db.prepare(`SELECT * FROM warehouses WHERE id = ?`).get(from_warehouse_id);
        const toWh = db.prepare(`SELECT * FROM warehouses WHERE id = ?`).get(to_warehouse_id);
        if (!fromWh || !toWh) throw new Error('Gudang asal atau tujuan tidak valid');

        const fromStock = getOrCreateWarehouseStock(entityId, item_id, from_warehouse_id);
        const toStock = getOrCreateWarehouseStock(entityId, item_id, to_warehouse_id);

        if (Number(fromStock.stock) < q) {
          throw new Error(`Stok di Gudang Asal (${fromWh.name}) tidak mencukupi! Tersedia: ${fromStock.stock} ${item.unit}, diminta: ${q} ${item.unit}`);
        }

        totalCost = q * cost;
        const newFromStock = Number(fromStock.stock) - q;
        const newToStock = Number(toStock.stock) + q;

        db.prepare(`UPDATE inventory_warehouse_stocks SET stock = ? WHERE id = ?`).run(newFromStock, fromStock.id);
        db.prepare(`UPDATE inventory_warehouse_stocks SET stock = ? WHERE id = ?`).run(newToStock, toStock.id);
        // Total company inventory stock remains unchanged

        if (doAutoJournal && totalCost > 0) {
          jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
          jrnNum = `JU-INV-TRF-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

          const fromAcc = fromWh.inventory_account_id || defaultInvAcc;
          const toAcc = toWh.inventory_account_id || defaultInvAcc;

          db.prepare(`
            INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name)
            VALUES (?, ?, ?, ?, 'INVENTORY', ?, ?, ?, ?, ?)
          `).run(
            jrnId, entityId, jrnNum, date, reference_no || txId,
            `Transfer Persediaan Multi Gudang: ${item.name} (${q} ${item.unit}) dari ${fromWh.name} ke ${toWh.name}`,
            totalCost, attachmentPath, attachmentName
          );

          db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
            `JI-${jrnId}-1`, jrnId, toAcc, totalCost, 0, `Mutasi Masuk [${toWh.code}]`
          );
          db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
            `JI-${jrnId}-2`, jrnId, fromAcc, 0, totalCost, `Mutasi Keluar [${fromWh.code}]`
          );
        }

        db.prepare(`
          INSERT INTO inventory_transactions (
            id, entity_id, item_id, date, tx_type, qty, unit_cost, total_cost, 
            warehouse_id, from_warehouse_id, to_warehouse_id, reference_no, notes, attachment_path, attachment_name, journal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txId, entityId, item_id, date, 'TRANSFER', q, cost, totalCost,
          to_warehouse_id, from_warehouse_id, to_warehouse_id, reference_no || '', notes || '',
          attachmentPath, attachmentName, jrnId
        );

      } else if (tx_type === 'ADJUSTMENT') {
        // --- 4. STOCK OPNAME / PENYESUAIAN PER GUDANG (ADJUSTMENT) ---
        if (!warehouse_id) throw new Error('Gudang stock opname wajib dipilih');
        const wh = db.prepare(`SELECT * FROM warehouses WHERE id = ?`).get(warehouse_id);
        if (!wh) throw new Error('Gudang tidak valid');

        const currentWhStock = getOrCreateWarehouseStock(entityId, item_id, warehouse_id);
        const actualQty = Number(qty);
        const currentQty = Number(currentWhStock.stock);
        const diffQty = actualQty - currentQty;

        totalCost = Math.abs(diffQty) * cost;
        const newItemStock = Number(item.current_stock) + diffQty;

        db.prepare(`UPDATE inventory_warehouse_stocks SET stock = ? WHERE id = ?`).run(actualQty, currentWhStock.id);
        db.prepare(`UPDATE inventory_items SET current_stock = ? WHERE id = ?`).run(newItemStock, item_id);

        if (doAutoJournal && diffQty !== 0 && totalCost > 0) {
          jrnId = 'JRN-' + Date.now().toString(36).toUpperCase();
          jrnNum = `JU-INV-ADJ-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
          const invAcc = wh.inventory_account_id || defaultInvAcc;

          if (diffQty > 0) {
            // Surplus stock (Lebih): Debit Inventory, Credit Selisih Stok / Pendapatan Lain
            const creditAcc = contra_account_id || defaultOtherIncomeAcc;
            db.prepare(`
              INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name)
              VALUES (?, ?, ?, ?, 'INVENTORY', ?, ?, ?, ?, ?)
            `).run(
              jrnId, entityId, jrnNum, date, reference_no || txId,
              `Stock Opname Selisih Lebih [${wh.name}]: ${item.name} (+${diffQty} ${item.unit})`,
              totalCost, attachmentPath, attachmentName
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-1`, jrnId, invAcc, totalCost, 0, `Penyesuaian Fisik Lebih [${wh.code}]`
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-2`, jrnId, creditAcc, 0, totalCost, `Pendapatan / Selisih Lebih Stok`
            );
          } else {
            // Deficit stock (Kurang / Rusak): Debit Beban HPP / Kerusakan, Credit Inventory
            const debitAcc = contra_account_id || defaultCogsAcc;
            db.prepare(`
              INSERT INTO journals (id, entity_id, journal_number, date, journal_type, reference_no, description, total_amount, attachment_path, attachment_name)
              VALUES (?, ?, ?, ?, 'INVENTORY', ?, ?, ?, ?, ?)
            `).run(
              jrnId, entityId, jrnNum, date, reference_no || txId,
              `Stock Opname Selisih Kurang [${wh.name}]: ${item.name} (${diffQty} ${item.unit})`,
              totalCost, attachmentPath, attachmentName
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-1`, jrnId, debitAcc, totalCost, 0, `Beban Selisih Stok / Kerusakan [${wh.code}]`
            );
            db.prepare(`INSERT INTO journal_items (id, journal_id, account_id, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)`).run(
              `JI-${jrnId}-2`, jrnId, invAcc, 0, totalCost, `Penyesuaian Fisik Kurang [${wh.code}]`
            );
          }
        }

        db.prepare(`
          INSERT INTO inventory_transactions (
            id, entity_id, item_id, date, tx_type, qty, unit_cost, total_cost, 
            warehouse_id, contra_account_id, reference_no, notes, attachment_path, attachment_name, journal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txId, entityId, item_id, date, 'ADJUSTMENT', actualQty, cost, totalCost,
          warehouse_id, contra_account_id || defaultCogsAcc, reference_no || '', notes || '',
          attachmentPath, attachmentName, jrnId
        );
      }

      db.exec('COMMIT;');
      res.json({ 
        success: true, 
        id: txId, 
        journal_id: jrnId,
        journal_number: jrnNum,
        message: 'Jurnal persediaan multi gudang berhasil dicatat' 
      });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. KARTU STOK MULTI GUDANG (STOCK CARD)
// -------------------------------------------------------------

router.get('/stock-card/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const entityId = req.query.entity_id || getActiveEntityId();
    const warehouseId = req.query.warehouse_id; // 'ALL' or specific warehouse_id

    const item = db.prepare(`SELECT * FROM inventory_items WHERE id = ? AND entity_id = ?`).get(itemId, entityId);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan' });

    let query = `
      SELECT it.*,
        w.code as warehouse_code, w.name as warehouse_name,
        fw.code as from_warehouse_code, fw.name as from_warehouse_name,
        tw.code as to_warehouse_code, tw.name as to_warehouse_name,
        j.journal_number
      FROM inventory_transactions it
      LEFT JOIN warehouses w ON w.id = it.warehouse_id
      LEFT JOIN warehouses fw ON fw.id = it.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = it.to_warehouse_id
      LEFT JOIN journals j ON j.id = it.journal_id
      WHERE it.item_id = ? AND it.entity_id = ?
    `;
    const params = [itemId, entityId];

    const isSpecificWh = (warehouseId && warehouseId !== 'ALL');
    if (isSpecificWh) {
      query += ` AND (it.warehouse_id = ? OR it.from_warehouse_id = ? OR it.to_warehouse_id = ?)`;
      params.push(warehouseId, warehouseId, warehouseId);
    }

    query += ` ORDER BY it.date ASC, it.created_at ASC`;

    const txs = db.prepare(query).all(...params);

    let runningQty = 0;
    let runningValuation = 0;

    const stockCard = txs.map(t => {
      const q = Number(t.qty) || 0;
      const unitCost = Number(t.unit_cost) || item.cost_price;
      const totalCost = Number(t.total_cost) || (q * unitCost);

      let inQty = 0, inCost = 0, outQty = 0, outCost = 0;

      if (!isSpecificWh) {
        // Consolidated company stock card
        if (t.tx_type === 'IN') {
          inQty = q;
          inCost = totalCost;
          runningQty += q;
          runningValuation += totalCost;
        } else if (t.tx_type === 'OUT') {
          outQty = q;
          outCost = totalCost;
          runningQty -= q;
          runningValuation -= totalCost;
        } else if (t.tx_type === 'TRANSFER') {
          // Internal transfer: does not change total company quantity
          inQty = 0;
          outQty = 0;
        } else if (t.tx_type === 'ADJUSTMENT') {
          const diff = q - runningQty;
          if (diff >= 0) {
            inQty = diff;
            inCost = diff * unitCost;
          } else {
            outQty = Math.abs(diff);
            outCost = Math.abs(diff) * unitCost;
          }
          runningQty = q;
          runningValuation = runningQty * unitCost;
        }
      } else {
        // Warehouse specific stock card
        if (t.tx_type === 'IN' && t.warehouse_id === warehouseId) {
          inQty = q;
          inCost = totalCost;
          runningQty += q;
          runningValuation += totalCost;
        } else if (t.tx_type === 'OUT' && t.warehouse_id === warehouseId) {
          outQty = q;
          outCost = totalCost;
          runningQty -= q;
          runningValuation -= totalCost;
        } else if (t.tx_type === 'TRANSFER') {
          if (t.to_warehouse_id === warehouseId) {
            // Incoming transfer into this warehouse
            inQty = q;
            inCost = totalCost;
            runningQty += q;
            runningValuation += totalCost;
          } else if (t.from_warehouse_id === warehouseId) {
            // Outgoing transfer from this warehouse
            outQty = q;
            outCost = totalCost;
            runningQty -= q;
            runningValuation -= totalCost;
          }
        } else if (t.tx_type === 'ADJUSTMENT' && t.warehouse_id === warehouseId) {
          const diff = q - runningQty;
          if (diff >= 0) {
            inQty = diff;
            inCost = diff * unitCost;
          } else {
            outQty = Math.abs(diff);
            outCost = Math.abs(diff) * unitCost;
          }
          runningQty = q;
          runningValuation = runningQty * unitCost;
        }
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

    let currentWhStock = item.current_stock;
    if (isSpecificWh) {
      const whStockRow = db.prepare(`
        SELECT stock FROM inventory_warehouse_stocks 
        WHERE entity_id = ? AND item_id = ? AND warehouse_id = ?
      `).get(entityId, itemId, warehouseId);
      currentWhStock = whStockRow ? Number(whStockRow.stock) : 0;
    }

    res.json({
      item,
      warehouse_id: warehouseId || 'ALL',
      current_stock: currentWhStock,
      current_valuation: runningValuation || (currentWhStock * item.cost_price),
      transactions: stockCard
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. BATCH IMPORT INVENTORY ITEMS & MULTI WAREHOUSE
// -------------------------------------------------------------

router.post('/import', (req, res) => {
  try {
    const entityId = req.body.entity_id || getActiveEntityId();
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data barang persediaan untuk diimpor' });
    }

    const defaultInvAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '1108' LIMIT 1`).get(entityId);
    const defaultCogsAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '5101' LIMIT 1`).get(entityId);
    const defaultSalesAcc = db.prepare(`SELECT id FROM accounts WHERE entity_id = ? AND code = '4101' LIMIT 1`).get(entityId);

    const warehouses = db.prepare(`SELECT id, code FROM warehouses WHERE entity_id = ? ORDER BY code ASC`).all(entityId);
    const defaultWh = warehouses[0];

    const upsertStmt = db.prepare(`
      INSERT INTO inventory_items (id, entity_id, sku, name, category, unit, cost_price, selling_price, current_stock, min_stock, valuation_method, inventory_account_id, cogs_account_id, sales_account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        unit = excluded.unit,
        cost_price = excluded.cost_price,
        selling_price = excluded.selling_price,
        current_stock = excluded.current_stock,
        min_stock = excluded.min_stock
    `);

    const stockStmt = db.prepare(`
      INSERT OR REPLACE INTO inventory_warehouse_stocks (id, entity_id, item_id, warehouse_id, stock)
      VALUES (?, ?, ?, ?, ?)
    `);

    let imported = 0;
    db.exec('BEGIN TRANSACTION;');
    try {
      items.forEach(it => {
        if (!it.sku || !it.name) return;
        const sku = String(it.sku).trim().toUpperCase();
        const id = `ITEM-${entityId}-${sku.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const stockQty = Number(it.current_stock) || 0;

        upsertStmt.run(
          id,
          entityId,
          sku,
          String(it.name).trim(),
          it.category || 'Barang Dagang',
          it.unit || 'PCS',
          Number(it.cost_price) || 0,
          Number(it.selling_price) || 0,
          stockQty,
          Number(it.min_stock) || 5,
          it.valuation_method || 'AVERAGE',
          it.inventory_account_id || defaultInvAcc?.id || null,
          it.cogs_account_id || defaultCogsAcc?.id || null,
          it.sales_account_id || defaultSalesAcc?.id || null
        );

        // Assign to warehouse
        let assignedWhId = defaultWh?.id;
        if (it.warehouse_code) {
          const matchedWh = warehouses.find(w => w.code.toUpperCase() === String(it.warehouse_code).trim().toUpperCase());
          if (matchedWh) assignedWhId = matchedWh.id;
        }

        warehouses.forEach(wh => {
          const whStock = (wh.id === assignedWhId) ? stockQty : 0;
          stockStmt.run(`STK-${id}-${wh.id}`, entityId, id, wh.id, whStock);
        });

        imported++;
      });
      db.exec('COMMIT;');
      res.json({ success: true, count: imported, message: `Berhasil mengimpor ${imported} data barang persediaan` });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
