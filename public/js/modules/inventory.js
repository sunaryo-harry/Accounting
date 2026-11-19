/**
 * Inventory & Stock Card Module (Persediaan & Kartu Stok)
 */

Modules.Inventory = {
  items: [],
  accounts: [],

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Data Persediaan...</div>`;

    try {
      const [invRes, accRes] = await Promise.all([
        fetch(`/api/inventory/items?entity_id=${App.activeEntity.id}`),
        fetch(`/api/accounts?entity_id=${App.activeEntity.id}`)
      ]);

      const invData = await invRes.json();
      this.items = invData.items || [];
      this.accounts = await accRes.json();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📦</span> Persediaan Barang Dagang & Kartu Stok
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Metode Penilaian: Weighted Average & FIFO | Integrasi Akun HPP
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-gold" onclick="Modules.Inventory.showTransactionModal()">
              <span>🔄</span> Catat Mutasi / Stock Opname
            </button>
            <button class="btn btn-primary" onclick="Modules.Inventory.showAddItemModal()">
              <span>➕</span> Tambah Barang Baru
            </button>
            <button class="btn btn-outline" onclick="Modules.Inventory.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('DAFTAR VALUASI PERSEDIAAN', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- STAT CARDS -->
        <div class="grid-cards">
          <div class="stat-card accent-gold">
            <div class="stat-title">Total Valuasi Persediaan</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(invData.totalStockValue || 0)}</div>
            <div class="stat-sub">Sesuai Saldo Akun Persediaan di Neraca</div>
          </div>
          <div class="stat-card accent-navy">
            <div class="stat-title">Jumlah Item / SKU Terdaftar</div>
            <div class="stat-value">${invData.totalSKU || 0} SKU</div>
            <div class="stat-sub">Kategori: Hardware IT, Security & Power</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Peringatan Stok Minimum</div>
            <div class="stat-value" style="color: ${invData.lowStockCount > 0 ? '#DC2626' : '#059669'};">
              ${invData.lowStockCount || 0} Item
            </div>
            <div class="stat-sub">${invData.lowStockCount > 0 ? 'Perlu Restock Segera!' : 'Seluruh Stok Aman'}</div>
          </div>
        </div>

        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Master Barang & Status Stok</div>
            <input type="text" id="inv-search-input" class="form-control" placeholder="Cari SKU atau nama barang..." style="width: 250px;" oninput="Modules.Inventory.filterItems()">
          </div>

          <div style="overflow-x: auto;">
            <table class="coretax-table" id="inv-table">
              <thead>
                <tr>
                  <th style="width: 120px;">SKU</th>
                  <th>Nama Barang</th>
                  <th>Kategori</th>
                  <th class="text-center" style="width: 80px;">Satuan</th>
                  <th class="text-right" style="width: 130px;">Harga Pokok (HPP)</th>
                  <th class="text-right" style="width: 130px;">Harga Jual</th>
                  <th class="text-center" style="width: 110px;">Stok Saat Ini</th>
                  <th class="text-right" style="width: 150px;">Total Valuasi (Rp)</th>
                  <th class="text-center" style="width: 120px;">Kartu Stok</th>
                </tr>
              </thead>
              <tbody id="inv-table-body">
                ${this.renderRows(this.items)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat persediaan: ${err.message}</div>`;
    }
  },

  renderRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="9" class="text-center" style="padding: 20px;">Belum ada data barang persediaan.</td></tr>`;
    }

    return list.map(it => `
      <tr>
        <td><strong>${it.sku}</strong></td>
        <td>
          <strong>${it.name}</strong>
          ${it.is_low_stock ? '<span class="badge badge-danger" style="margin-left: 6px;">Low Stock</span>' : ''}
        </td>
        <td><span class="badge badge-neutral">${it.category}</span></td>
        <td class="text-center">${it.unit}</td>
        <td class="text-right">${App.formatIDR(it.cost_price)}</td>
        <td class="text-right font-weight-bold" style="color: #0284C7;">${App.formatIDR(it.selling_price)}</td>
        <td class="text-center">
          <span class="badge ${it.is_low_stock ? 'badge-danger' : 'badge-success'}" style="font-size: 12px;">
            ${it.current_stock} ${it.unit}
          </span>
        </td>
        <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(it.total_valuation)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-gold" onclick="Modules.Inventory.showStockCard('${it.id}')">
            📊 Kartu Stok
          </button>
        </td>
      </tr>
    `).join('');
  },

  filterItems: function() {
    const q = document.getElementById('inv-search-input')?.value.toLowerCase() || '';
    const filtered = this.items.filter(it => it.sku.toLowerCase().includes(q) || it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q));
    document.getElementById('inv-table-body').innerHTML = this.renderRows(filtered);
  },

  showStockCard: async function(itemId) {
    try {
      const res = await fetch(`/api/inventory/stock-card/${itemId}?entity_id=${App.activeEntity.id}`);
      const data = await res.json();
      const item = data.item;

      let rowsHtml = data.transactions.map(t => `
        <tr>
          <td>${t.date}</td>
          <td><span class="badge ${t.tx_type === 'IN' ? 'badge-success' : (t.tx_type === 'OUT' ? 'badge-danger' : 'badge-warning')}">${t.tx_type}</span></td>
          <td>${t.reference_no || '-'}</td>
          <td>${t.notes || '-'}</td>
          <td class="text-right">${t.in_qty > 0 ? t.in_qty : '-'}</td>
          <td class="text-right">${t.in_cost > 0 ? App.formatIDR(t.in_cost) : '-'}</td>
          <td class="text-right">${t.out_qty > 0 ? t.out_qty : '-'}</td>
          <td class="text-right">${t.out_cost > 0 ? App.formatIDR(t.out_cost) : '-'}</td>
          <td class="text-center font-weight-bold">${t.balance_qty}</td>
          <td class="text-right">${App.formatIDR(t.avg_cost)}</td>
          <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(t.balance_valuation)}</td>
        </tr>
      `).join('');

      const body = `
        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 14px;">
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
            <div><strong>Barang:</strong> [${item.sku}] ${item.name} (${item.unit})</div>
            <div><strong>Stok Akhir:</strong> <span class="badge badge-success">${data.current_stock} ${item.unit}</span></div>
            <div><strong>Total Nilai Valuasi:</strong> <strong>${App.formatIDR(data.current_valuation)}</strong></div>
          </div>
        </div>

        <div style="max-height: 55vh; overflow-y: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 90px; vertical-align: middle;">Tanggal</th>
                <th rowspan="2" style="width: 70px; vertical-align: middle;">Tipe</th>
                <th rowspan="2" style="width: 100px; vertical-align: middle;">No. Ref</th>
                <th rowspan="2" style="vertical-align: middle;">Keterangan</th>
                <th colspan="2" class="text-center" style="background: #D1FAE5; color: #065F46;">Masuk (IN)</th>
                <th colspan="2" class="text-center" style="background: #FEE2E2; color: #991B1B;">Keluar (OUT)</th>
                <th colspan="3" class="text-center" style="background: #E0F2FE; color: #075985;">Saldo Akhir</th>
              </tr>
              <tr>
                <th class="text-right" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 100px;">Nilai (Rp)</th>
                <th class="text-right" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 100px;">Nilai (Rp)</th>
                <th class="text-center" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 90px;">Rata-rata</th>
                <th class="text-right" style="width: 110px;">Valuasi (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="11" class="text-center" style="padding: 14px; color: #94A3B8;">Belum ada mutasi tercatat untuk barang ini.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;

      const footer = `
        <button class="btn btn-outline" onclick="App.closeModal()">Tutup</button>
      `;

      App.showModal(`Kartu Stok: ${item.name}`, body, footer);
    } catch (err) {
      alert('Gagal memuat kartu stok: ' + err.message);
    }
  },

  showAddItemModal: function() {
    const accInv = this.accounts.filter(a => a.category === 'ASET_LANCAR').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const accCogs = this.accounts.filter(a => a.category === 'HPP').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const accSales = this.accounts.filter(a => a.category === 'PENDAPATAN').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-add-item">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode / SKU *</label>
            <input type="text" id="new-item-sku" class="form-control" placeholder="Contoh: SRV-001" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Barang *</label>
            <input type="text" id="new-item-name" class="form-control" placeholder="Nama produk / barang dagang" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <input type="text" id="new-item-cat" class="form-control" placeholder="Contoh: Hardware IT">
          </div>
          <div class="form-group">
            <label class="form-label">Satuan</label>
            <input type="text" id="new-item-unit" class="form-control" value="UNIT">
          </div>
          <div class="form-group">
            <label class="form-label">Minimum Stok (Alert)</label>
            <input type="number" id="new-item-min" class="form-control" value="2">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Harga Beli Terakhir (HPP) *</label>
            <input type="number" id="new-item-cost" class="form-control" value="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Jual Standar *</label>
            <input type="number" id="new-item-sell" class="form-control" value="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Stok Awal</label>
            <input type="number" id="new-item-stock" class="form-control" value="0">
          </div>
        </div>

        <div style="background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1; margin-top: 8px;">
          <div style="font-weight: 700; margin-bottom: 6px; color: #002B49;">Pemetaan Akun Akuntansi</div>
          <div class="form-group">
            <label class="form-label">Akun Persediaan (Neraca):</label>
            <select id="new-item-acc-inv" class="form-control">${accInv}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Akun Beban Pokok Penjualan (HPP):</label>
            <select id="new-item-acc-cogs" class="form-control">${accCogs}</select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Inventory.saveNewItem()">Simpan Barang</button>
    `;

    App.showModal('Tambah Master Barang Persediaan', body, footer);
  },

  saveNewItem: async function() {
    const sku = document.getElementById('new-item-sku')?.value.trim();
    const name = document.getElementById('new-item-name')?.value.trim();
    const cat = document.getElementById('new-item-cat')?.value.trim();
    const unit = document.getElementById('new-item-unit')?.value.trim();
    const min = parseFloat(document.getElementById('new-item-min')?.value) || 2;
    const cost = parseFloat(document.getElementById('new-item-cost')?.value) || 0;
    const sell = parseFloat(document.getElementById('new-item-sell')?.value) || 0;
    const stock = parseFloat(document.getElementById('new-item-stock')?.value) || 0;
    const invAcc = document.getElementById('new-item-acc-inv')?.value;
    const cogsAcc = document.getElementById('new-item-acc-cogs')?.value;

    if (!sku || !name) {
      alert('SKU dan Nama barang wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          sku, name, category: cat, unit, min_stock: min,
          cost_price: cost, selling_price: sell, current_stock: stock,
          inventory_account_id: invAcc, cogs_account_id: cogsAcc
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Barang berhasil ditambahkan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showTransactionModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const itemOpts = this.items.map(it => `<option value="${it.id}">[${it.sku}] ${it.name} (Stok: ${it.current_stock})</option>`).join('');

    const body = `
      <form id="form-stock-tx">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Mutasi *</label>
            <input type="date" id="stk-tx-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Mutasi *</label>
            <select id="stk-tx-type" class="form-control">
              <option value="IN">Barang Masuk (IN / Penerimaan Barang)</option>
              <option value="OUT">Barang Keluar (OUT / Pemakaian / Penjualan)</option>
              <option value="ADJUSTMENT">Penyesuaian Fisik (Stock Opname Adjustment)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Barang Persediaan *</label>
          <select id="stk-tx-item" class="form-control">${itemOpts}</select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kuantitas (Qty) *</label>
            <input type="number" id="stk-tx-qty" class="form-control" value="1" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Satuan (Opsional, kosongkan = harga default)</label>
            <input type="number" id="stk-tx-cost" class="form-control" placeholder="Biarkan kosong untuk auto">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nomor Surat Jalan / Ref</label>
          <input type="text" id="stk-tx-ref" class="form-control" placeholder="Contoh: SJ-2026/02/09">
        </div>

        <div class="form-group">
          <label class="form-label">Catatan / Uraian Mutasi</label>
          <input type="text" id="stk-tx-notes" class="form-control" placeholder="Contoh: Penerimaan barang pesanan PO-102">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
            <input type="checkbox" id="stk-tx-autojournal" checked>
            Otomatis Buat Jurnal Akuntansi (HPP & Persediaan)
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Inventory.saveStockTransaction()">Proses Mutasi Stok</button>
    `;

    App.showModal('Catat Mutasi Persediaan / Stock Opname', body, footer);
  },

  saveStockTransaction: async function() {
    const date = document.getElementById('stk-tx-date')?.value;
    const type = document.getElementById('stk-tx-type')?.value;
    const itemId = document.getElementById('stk-tx-item')?.value;
    const qty = parseFloat(document.getElementById('stk-tx-qty')?.value) || 0;
    const unitCost = parseFloat(document.getElementById('stk-tx-cost')?.value) || 0;
    const ref = document.getElementById('stk-tx-ref')?.value.trim();
    const notes = document.getElementById('stk-tx-notes')?.value.trim();
    const autoJournal = document.getElementById('stk-tx-autojournal')?.checked;

    if (qty <= 0) {
      alert('Kuantitas mutasi harus lebih besar dari 0!');
      return;
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          date, tx_type: type, item_id: itemId, qty, unit_cost: unitCost,
          reference_no: ref, notes, auto_journal: autoJournal
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Mutasi persediaan berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const headers = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Nama Barang' },
      { key: 'category', label: 'Kategori' },
      { key: 'unit', label: 'Satuan', align: 'center' },
      { key: 'cost_price', label: 'Harga Pokok (HPP)', type: 'number' },
      { key: 'selling_price', label: 'Harga Jual', type: 'number' },
      { key: 'current_stock', label: 'Stok Saat Ini', type: 'number' },
      { key: 'total_valuation', label: 'Total Nilai Valuasi (Rp)', type: 'number' }
    ];

    CoretaxExport.exportToExcel(
      `Valuasi_Persediaan_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Persediaan',
      'DAFTAR VALUASI PERSEDIAAN BARANG DAGANG',
      App.activeEntity,
      headers,
      this.items
    );
  }
};
