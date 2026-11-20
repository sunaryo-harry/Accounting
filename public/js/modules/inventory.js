/**
 * Inventory & Multi-Warehouse Journal Module (Persediaan & Jurnal Multi Gudang)
 * Sistem Akuntansi Terpadu Multi Gudang, Transfer Stok & Auto-Jurnal Persediaan
 * Credit by Harry Sunaryo
 */

Modules.Inventory = {
  items: [],
  warehouses: [],
  journals: [],
  accounts: [],
  activeTab: 'items', // 'items', 'warehouses', 'journals'
  filterWarehouse: 'ALL',
  filterTxType: 'ALL',

  // Safe helper getters to prevent "TypeError: ... is not a function"
  getWarehouses: function() {
    return Array.isArray(this.warehouses) ? this.warehouses : [];
  },
  getItems: function() {
    return Array.isArray(this.items) ? this.items : [];
  },
  getJournals: function() {
    return Array.isArray(this.journals) ? this.journals : [];
  },
  getAccounts: function() {
    return Array.isArray(this.accounts) ? this.accounts : [];
  },

  render: async function(container) {
    container.innerHTML = `<div style="padding: 24px; text-align: center;"><div class="loading-spinner"></div> Memuat Data Persediaan Multi Gudang...</div>`;

    try {
      const entityId = App.activeEntity?.id;
      if (!entityId) {
        throw new Error('Entitas perusahaan belum aktif atau belum dipilih. Silakan pilih entitas di bilah atas aplikasi.');
      }

      // Safe API fetcher with automatic JSON and status code validation
      const fetchApi = async (url) => {
        if (typeof App.fetchJson === 'function') {
          return await App.fetchJson(url);
        }
        const res = await fetch(url);
        if (!res.ok) {
          const errObj = await res.json().catch(() => ({}));
          throw new Error(errObj.error || `HTTP ${res.status}: Gagal memanggil endpoint ${url}`);
        }
        return await res.json();
      };

      const [invData, whData, jrnData, accData] = await Promise.all([
        fetchApi(`/api/inventory/items?entity_id=${entityId}`),
        fetchApi(`/api/inventory/warehouses?entity_id=${entityId}`),
        fetchApi(`/api/inventory/journals?entity_id=${entityId}`),
        fetchApi(`/api/accounts?entity_id=${entityId}`)
      ]);

      this.items = Array.isArray(invData?.items) ? invData.items : (Array.isArray(invData) ? invData : []);
      this.warehouses = Array.isArray(whData) ? whData : (Array.isArray(whData?.warehouses) ? whData.warehouses : []);
      this.journals = Array.isArray(jrnData) ? jrnData : [];
      this.accounts = Array.isArray(accData) ? accData : [];

      const whList = this.getWarehouses();
      const itList = this.getItems();
      const jrnList = this.getJournals();

      const totalStockVal = invData?.totalStockValue || itList.reduce((sum, it) => sum + (Number(it.total_valuation) || 0), 0);
      const totalSKUCount = invData?.totalSKU || itList.length;
      const lowStockCount = invData?.lowStockCount || itList.filter(it => it.is_low_stock).length;
      const totalUnits = itList.reduce((sum, it) => sum + Number(it.current_stock || 0), 0);

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>📦</span> Persediaan & Jurnal Multi Gudang
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Multi Gudang Terintegrasi | Transfer Antar Gudang | Auto-Jurnal Persediaan & HPP | Kartu Stok
            </div>
          </div>
          <div class="page-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-gold" onclick="Modules.Inventory.showTransferModal()">
              <span>🔄</span> Transfer Antar Gudang
            </button>
            <button class="btn btn-primary" onclick="Modules.Inventory.showInModal()">
              <span>📥</span> Penerimaan (IN)
            </button>
            <button class="btn btn-outline" style="border-color: #DC2626; color: #DC2626;" onclick="Modules.Inventory.showOutModal()">
              <span>📤</span> Pengeluaran (OUT)
            </button>
            <button class="btn btn-outline" onclick="Modules.Inventory.showOpnameModal()">
              <span>⚖️</span> Stock Opname
            </button>
            <button class="btn btn-outline" onclick="CoretaxImporter.showImportModal('inventory', () => Modules.Inventory.render(document.getElementById('main-content-view')))">
              <span>📥</span> Template & Impor
            </button>
            <button class="btn btn-outline" onclick="Modules.Inventory.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('DAFTAR PERSEDIAAN MULTI GUDANG', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- STAT CARDS -->
        <div class="grid-cards" style="margin-bottom: 20px;">
          <div class="stat-card accent-gold">
            <div class="stat-title">Total Valuasi Persediaan</div>
            <div class="stat-value" style="color: #B45309;">${App.formatIDR(totalStockVal)}</div>
            <div class="stat-sub">Konsolidasi Seluruh Gudang (${whList.length} Lokasi Gudang)</div>
          </div>
          <div class="stat-card accent-navy">
            <div class="stat-title">Jumlah Item / SKU Terdaftar</div>
            <div class="stat-value">${totalSKUCount} SKU</div>
            <div class="stat-sub">${totalUnits} Total Unit Fisik Tersimpan</div>
          </div>
          <div class="stat-card accent-blue">
            <div class="stat-title">Master Multi Gudang</div>
            <div class="stat-value" style="color: #0284C7;">${whList.length} Lokasi</div>
            <div class="stat-sub">Gudang Utama, Cabang Distribusi & Transit</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Peringatan Stok Minimum</div>
            <div class="stat-value" style="color: ${lowStockCount > 0 ? '#DC2626' : '#059669'};">
              ${lowStockCount} Item
            </div>
            <div class="stat-sub">${lowStockCount > 0 ? 'Perlu Restock Segera!' : 'Seluruh Stok Aman'}</div>
          </div>
        </div>

        <!-- TAB NAVIGATION -->
        <div style="display: flex; gap: 4px; border-bottom: 2px solid #CBD5E1; margin-bottom: 16px;">
          <button id="tab-btn-items" class="btn ${this.activeTab === 'items' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Inventory.switchTab('items')">
            📦 Master Barang & Stok Multi Gudang (${itList.length})
          </button>
          <button id="tab-btn-warehouses" class="btn ${this.activeTab === 'warehouses' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Inventory.switchTab('warehouses')">
            🏢 Master Multi Gudang (${whList.length})
          </button>
          <button id="tab-btn-journals" class="btn ${this.activeTab === 'journals' ? 'btn-primary' : 'btn-outline'}" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;" onclick="Modules.Inventory.switchTab('journals')">
            📝 Jurnal & Mutasi Persediaan Multi Gudang (${jrnList.length})
          </button>
        </div>

        <!-- TAB CONTENTS -->
        <div id="inventory-tab-content">
          ${this.renderTabContent()}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="stat-card accent-red" style="padding: 20px; text-align: left; margin: 16px 0;">
          <h3 style="color: #DC2626; margin-top: 0; font-size: 16px;">⚠️ Gagal Memuat Modul Persediaan Multi Gudang</h3>
          <p style="margin-bottom: 12px; font-size: 13px;"><strong>Detail Kendala:</strong> ${err.message}</p>
          <div style="background: #FFF5F5; border: 1px solid #FED7D7; padding: 12px; border-radius: 6px; font-size: 12px; color: #742A2A; line-height: 1.5;">
            <strong>💡 Panduan Singkat:</strong><br>
            Jika Anda baru saja memperbarui kode backend di komputer ini, server Node.js lokal di latar belakang perlu dimuat ulang agar rute API baru <code>/api/inventory/warehouses</code> aktif.
            <ul style="margin: 6px 0 0 16px; padding: 0;">
              <li>Jalankan kembali berkas <code>start-server.bat</code> di folder <code>F:\\ACCOUNTING</code>.</li>
              <li>Kemudian klik tombol di bawah ini untuk memuat ulang modul.</li>
            </ul>
          </div>
          <div style="margin-top: 14px;">
            <button class="btn btn-primary" onclick="Modules.Inventory.render(document.getElementById('main-content-view'))">
              🔄 Muat Ulang Persediaan
            </button>
          </div>
        </div>
      `;
    }
  },

  switchTab: function(tabName) {
    this.activeTab = tabName;
    ['items', 'warehouses', 'journals'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = 'btn btn-primary';
        } else {
          btn.className = 'btn btn-outline';
        }
      }
    });
    const content = document.getElementById('inventory-tab-content');
    if (content) content.innerHTML = this.renderTabContent();
  },

  renderTabContent: function() {
    if (this.activeTab === 'warehouses') {
      return this.renderWarehousesTab();
    } else if (this.activeTab === 'journals') {
      return this.renderJournalsTab();
    } else {
      return this.renderItemsTab();
    }
  },

  // =============================================================
  // TAB 1: MASTER BARANG & VALUASI MULTI GUDANG
  // =============================================================

  renderItemsTab: function() {
    const whList = this.getWarehouses();
    const whOptions = `<option value="ALL">Semua Gudang (Konsolidasi)</option>` + 
      whList.map(w => `<option value="${w.id}" ${this.filterWarehouse === w.id ? 'selected' : ''}>[${w.code}] ${w.name}</option>`).join('');

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📋</span> Daftar Master Barang & Stok per Gudang</div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <select id="inv-wh-filter" class="form-control" style="width: 240px;" onchange="Modules.Inventory.changeWarehouseFilter(this.value)">
              ${whOptions}
            </select>
            <input type="text" id="inv-search-input" class="form-control" placeholder="Cari SKU atau nama barang..." style="width: 240px;" oninput="Modules.Inventory.filterItems()">
            <button class="btn btn-sm btn-primary" onclick="Modules.Inventory.showAddItemModal()">
              <span>➕</span> Tambah Barang
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table" id="inv-table">
            <thead>
              <tr>
                <th style="width: 110px;">SKU</th>
                <th>Nama Barang</th>
                <th style="width: 120px;">Kategori</th>
                <th class="text-center" style="width: 70px;">Satuan</th>
                <th class="text-right" style="width: 120px;">Harga Beli (HPP)</th>
                <th class="text-right" style="width: 120px;">Harga Jual</th>
                <th style="width: 220px;">Rincian Stok per Gudang</th>
                <th class="text-center" style="width: 100px;">Total Stok</th>
                <th class="text-right" style="width: 140px;">Valuasi (Rp)</th>
                <th class="text-center" style="width: 110px;">Kartu Stok</th>
              </tr>
            </thead>
            <tbody id="inv-table-body">
              ${this.renderItemRows(this.getItems())}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderItemRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada data barang persediaan.</td></tr>`;
    }

    const whFilter = this.filterWarehouse;

    return list.map(it => {
      let displayedStock = it.current_stock;
      let displayedValuation = it.total_valuation;

      if (whFilter !== 'ALL') {
        const matched = it.warehouse_stocks?.find(ws => ws.warehouse_id === whFilter);
        displayedStock = matched ? matched.stock : 0;
        displayedValuation = displayedStock * it.cost_price;
      }

      const whBadges = (it.warehouse_stocks || []).map(ws => `
        <span class="badge ${ws.stock > 0 ? 'badge-neutral' : ''}" style="font-size: 11px; margin: 1px 2px; ${ws.stock === 0 ? 'opacity: 0.5; background: #E2E8F0;' : 'background: #E0F2FE; color: #0369A1;'}" title="${ws.warehouse_name}">
          <strong>${ws.warehouse_code}:</strong> ${ws.stock}
        </span>
      `).join('');

      return `
        <tr>
          <td><strong>${it.sku}</strong></td>
          <td>
            <strong>${it.name}</strong>
            ${it.is_low_stock ? '<span class="badge badge-danger" style="margin-left: 6px; font-size: 10px;">Low Stock</span>' : ''}
          </td>
          <td><span class="badge badge-neutral">${it.category}</span></td>
          <td class="text-center">${it.unit}</td>
          <td class="text-right">${App.formatIDR(it.cost_price)}</td>
          <td class="text-right font-weight-bold" style="color: #0284C7;">${App.formatIDR(it.selling_price)}</td>
          <td>
            <div style="display: flex; flex-wrap: wrap;">
              ${whBadges || '<span style="color:#94A3B8; font-size:11px;">-</span>'}
            </div>
          </td>
          <td class="text-center">
            <span class="badge ${displayedStock <= it.min_stock ? 'badge-danger' : 'badge-success'}" style="font-size: 12px; font-weight: 700;">
              ${displayedStock} ${it.unit}
            </span>
          </td>
          <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(displayedValuation)}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-gold" onclick="Modules.Inventory.showStockCard('${it.id}', '${whFilter}')">
              📊 Kartu Stok
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  changeWarehouseFilter: function(whId) {
    this.filterWarehouse = whId;
    this.filterItems();
  },

  filterItems: function() {
    const q = document.getElementById('inv-search-input')?.value.toLowerCase() || '';
    const filtered = this.getItems().filter(it => 
      it.sku.toLowerCase().includes(q) || 
      it.name.toLowerCase().includes(q) || 
      it.category.toLowerCase().includes(q)
    );
    const tbody = document.getElementById('inv-table-body');
    if (tbody) tbody.innerHTML = this.renderItemRows(filtered);
  },

  // =============================================================
  // TAB 2: MASTER MULTI GUDANG
  // =============================================================

  renderWarehousesTab: function() {
    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>🏢</span> Daftar Master Multi Gudang & Lokasi Logistik</div>
          <button class="btn btn-sm btn-primary" onclick="Modules.Inventory.showWarehouseModal()">
            <span>➕</span> Tambah Gudang Baru
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th style="width: 110px;">Kode Gudang</th>
                <th>Nama Gudang</th>
                <th>Lokasi / Alamat Fisik</th>
                <th style="width: 140px;">Penanggung Jawab (PIC)</th>
                <th style="width: 180px;">Akun Persediaan</th>
                <th class="text-center" style="width: 110px;">Item Tersimpan</th>
                <th class="text-center" style="width: 120px;">Total Unit Fisik</th>
                <th class="text-right" style="width: 160px;">Total Valuasi (Rp)</th>
                <th class="text-center" style="width: 90px;">Status</th>
                <th class="text-center" style="width: 110px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderWarehouseRows()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderWarehouseRows: function() {
    const whList = this.getWarehouses();
    if (!whList || whList.length === 0) {
      return `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada gudang yang terdaftar.</td></tr>`;
    }

    return whList.map(w => `
      <tr>
        <td><strong style="color: #002B49;">${w.code}</strong></td>
        <td><strong>${w.name}</strong></td>
        <td><span style="font-size: 12px; color: #475569;">${w.location || '-'}</span></td>
        <td><strong>${w.pic || '-'}</strong></td>
        <td>
          <span style="font-size: 11px;">
            ${w.account_code ? `[${w.account_code}] ${w.account_name}` : '<span style="color:#64748B;">Default Akun Persediaan [1108]</span>'}
          </span>
        </td>
        <td class="text-center">
          <span class="badge badge-neutral">${w.total_sku_stored || 0} SKU</span>
        </td>
        <td class="text-center">
          <span class="badge badge-success" style="font-weight: 700;">${w.total_stock_qty || 0} Unit</span>
        </td>
        <td class="text-right font-weight-bold" style="color: #B45309;">
          ${App.formatIDR(w.total_valuation || 0)}
        </td>
        <td class="text-center">
          <span class="badge ${w.is_active ? 'badge-success' : 'badge-danger'}">
            ${w.is_active ? 'Aktif' : 'Non-Aktif'}
          </span>
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline" onclick="Modules.Inventory.showWarehouseModal('${w.id}')" title="Edit Gudang">
            ✏️
          </button>
          <button class="btn btn-sm btn-outline" style="color: #DC2626;" onclick="Modules.Inventory.deleteWarehouse('${w.id}')" title="Hapus Gudang">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');
  },

  // =============================================================
  // TAB 3: JURNAL & MUTASI PERSEDIAAN MULTI GUDANG
  // =============================================================

  renderJournalsTab: function() {
    const whList = this.getWarehouses();
    const whOptions = `<option value="ALL">Semua Gudang</option>` + 
      whList.map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');

    return `
      <div class="card-table-wrapper">
        <div class="table-header-toolbar">
          <div class="table-title"><span>📝</span> Riwayat Jurnal Transaksi Persediaan Multi Gudang</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <select id="jrn-wh-select" class="form-control" style="width: 180px;" onchange="Modules.Inventory.filterJournals()">
              ${whOptions}
            </select>
            <select id="jrn-tx-select" class="form-control" style="width: 170px;" onchange="Modules.Inventory.filterJournals()">
              <option value="ALL">Semua Jenis Mutasi</option>
              <option value="IN">Penerimaan (IN)</option>
              <option value="OUT">Pengeluaran (OUT)</option>
              <option value="TRANSFER">Transfer Antar Gudang</option>
              <option value="ADJUSTMENT">Stock Opname (ADJ)</option>
            </select>
            <input type="text" id="jrn-inv-search" class="form-control" placeholder="Cari no jurnal, barang, surat jalan..." style="width: 230px;" oninput="Modules.Inventory.filterJournals()">
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="coretax-table" id="inv-journals-table">
            <thead>
              <tr>
                <th style="width: 95px;">Tanggal</th>
                <th style="width: 140px;">No. Jurnal</th>
                <th class="text-center" style="width: 90px;">Tipe</th>
                <th style="width: 220px;">Gudang / Rute Transfer</th>
                <th>Barang & SKU</th>
                <th class="text-center" style="width: 90px;">Qty</th>
                <th class="text-right" style="width: 110px;">Harga Satuan</th>
                <th class="text-right" style="width: 130px;">Total Nilai (Rp)</th>
                <th style="width: 120px;">No. Surat Jalan</th>
                <th class="text-center" style="width: 90px;">Bukti Fisik</th>
                <th class="text-center" style="width: 90px;">Voucher</th>
              </tr>
            </thead>
            <tbody id="inv-journals-tbody">
              ${this.renderJournalRows(this.getJournals())}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderJournalRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="11" class="text-center" style="padding: 24px; color: #94A3B8;">Belum ada transaksi jurnal persediaan yang tercatat.</td></tr>`;
    }

    return list.map(j => {
      let typeBadge = '';
      let routeHtml = '';

      if (j.tx_type === 'IN') {
        typeBadge = `<span class="badge badge-success">MASUK (IN)</span>`;
        routeHtml = `<span style="color:#059669; font-weight:600;">➔ [${j.warehouse_code || 'GDG'}] ${j.warehouse_name || '-'}</span>`;
      } else if (j.tx_type === 'OUT') {
        typeBadge = `<span class="badge badge-danger">KELUAR (OUT)</span>`;
        routeHtml = `<span style="color:#DC2626; font-weight:600;">[${j.warehouse_code || 'GDG'}] ${j.warehouse_name || '-'} ➔</span>`;
      } else if (j.tx_type === 'TRANSFER') {
        typeBadge = `<span class="badge badge-warning" style="background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B;">TRANSFER</span>`;
        routeHtml = `<strong>[${j.from_warehouse_code || 'ASAL'}]</strong> ➔ <strong style="color:#0284C7;">[${j.to_warehouse_code || 'TUJUAN'}]</strong>`;
      } else if (j.tx_type === 'ADJUSTMENT') {
        typeBadge = `<span class="badge badge-neutral" style="background: #E2E8F0; color: #334155;">OPNAME</span>`;
        routeHtml = `<span>⚖️ [${j.warehouse_code || 'GDG'}] ${j.warehouse_name || '-'}</span>`;
      }

      return `
        <tr>
          <td>${j.date}</td>
          <td>
            <strong>${j.journal_number || '-'}</strong>
          </td>
          <td class="text-center">${typeBadge}</td>
          <td>${routeHtml}</td>
          <td>
            <strong>${j.item_name}</strong>
            <div style="font-size: 11px; color: #64748B;">SKU: ${j.item_sku}</div>
          </td>
          <td class="text-center font-weight-bold">
            ${j.qty} ${j.item_unit}
          </td>
          <td class="text-right">${App.formatIDR(j.unit_cost)}</td>
          <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(j.total_cost)}</td>
          <td><span style="font-size: 12px;">${j.reference_no || '-'}</span></td>
          <td class="text-center">
            ${j.attachment_path ? `
              <a href="${j.attachment_path}" target="_blank" class="btn btn-sm btn-outline" style="color: #0284C7; font-size: 11px; padding: 2px 6px;" title="${j.attachment_name || 'Buka Bukti PDF'}">
                📄 PDF
              </a>
            ` : '<span style="color:#CBD5E1;">-</span>'}
          </td>
          <td class="text-center">
            ${j.journal_id ? `
              <button class="btn btn-sm btn-outline" onclick="Modules.Journals.viewDetail('${j.journal_id}')" title="Lihat Voucher Jurnal">
                👁️ Voucher
              </button>
            ` : '<span style="color:#CBD5E1;">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  filterJournals: function() {
    const whId = document.getElementById('jrn-wh-select')?.value || 'ALL';
    const txType = document.getElementById('jrn-tx-select')?.value || 'ALL';
    const q = document.getElementById('jrn-inv-search')?.value.toLowerCase() || '';

    const filtered = this.getJournals().filter(j => {
      const matchWh = (whId === 'ALL') || (j.warehouse_id === whId || j.from_warehouse_id === whId || j.to_warehouse_id === whId);
      const matchType = (txType === 'ALL') || (j.tx_type === txType);
      const matchQ = (
        (j.journal_number && j.journal_number.toLowerCase().includes(q)) ||
        (j.item_name && j.item_name.toLowerCase().includes(q)) ||
        (j.item_sku && j.item_sku.toLowerCase().includes(q)) ||
        (j.reference_no && j.reference_no.toLowerCase().includes(q)) ||
        (j.notes && j.notes.toLowerCase().includes(q))
      );
      return matchWh && matchType && matchQ;
    });

    const tbody = document.getElementById('inv-journals-tbody');
    if (tbody) tbody.innerHTML = this.renderJournalRows(filtered);
  },

  // =============================================================
  // MODALS TRANSAKSI (TRANSFER, IN, OUT, OPNAME, WAREHOUSE, ITEM)
  // =============================================================

  // 1. MODAL TRANSFER ANTAR GUDANG
  showTransferModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const whList = this.getWarehouses();
    const itemList = this.getItems();

    if (whList.length < 2) {
      alert('Dibutuhkan minimal 2 gudang untuk melakukan transfer antar gudang. Silakan tambahkan gudang terlebih dahulu pada Tab Master Multi Gudang.');
      this.switchTab('warehouses');
      return;
    }

    const whOptionsFrom = whList.map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');
    const whOptionsTo = whList.map((w, idx) => `<option value="${w.id}" ${idx === 1 ? 'selected' : ''}>[${w.code}] ${w.name}</option>`).join('');
    const itemOptions = itemList.map(it => `<option value="${it.id}">[${it.sku}] ${it.name}</option>`).join('');

    const body = `
      <form id="form-transfer-stock" enctype="multipart/form-data">
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <strong style="color: #92400E;">🔄 Mutasi / Transfer Persediaan Antar Gudang</strong>
          <div style="font-size: 12px; color: #78350F; margin-top: 2px;">
            Memindahkan stok fisik barang dari Gudang Asal ke Gudang Tujuan. Sistem akan otomatis memperbarui kartu stok kedua gudang dan membuat Voucher Jurnal Persediaan.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Transfer *</label>
            <input type="date" id="trf-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">No. Dokumen Transfer / Surat Jalan</label>
            <input type="text" id="trf-ref" class="form-control" value="SJ-TRF/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2,'0')}/${Math.floor(1000 + Math.random()*9000)}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: #991B1B;">📤 Gudang Asal (Pengirim) *</label>
            <select id="trf-from-wh" class="form-control" onchange="Modules.Inventory.updateTransferStockHint()">
              ${whOptionsFrom}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: #065F46;">📥 Gudang Tujuan (Penerima) *</label>
            <select id="trf-to-wh" class="form-control">
              ${whOptionsTo}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Barang Persediaan *</label>
          <select id="trf-item" class="form-control" onchange="Modules.Inventory.updateTransferStockHint()">
            ${itemOptions}
          </select>
          <div id="trf-stock-hint" style="font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 4px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Jumlah Transfer (Qty) *</label>
            <input type="number" id="trf-qty" class="form-control" value="1" min="1" step="any" required>
          </div>
          <div class="form-group">
            <label class="form-label">Biaya / HPP Satuan (Rp)</label>
            <input type="number" id="trf-cost" class="form-control" placeholder="Otomatis mengikuti HPP Barang" step="any">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Keterangan / Alasan Transfer</label>
          <input type="text" id="trf-notes" class="form-control" placeholder="Contoh: Pemenuhan pesanan cabang atau redistribusi stok logistik">
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah Berkas Bukti Surat Jalan / Tanda Terima (PDF/Gambar)</label>
          <input type="file" id="trf-attachment" class="form-control" accept="image/*,application/pdf">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="trf-autojournal" checked>
            <strong>Otomatis Buat Entri Voucher Jurnal Persediaan</strong>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Inventory.submitTransferStock()">Proses Transfer Stok</button>
    `;

    App.showModal('Transfer Persediaan Antar Gudang', body, footer);
    this.updateTransferStockHint();
  },

  updateTransferStockHint: function() {
    const fromWhId = document.getElementById('trf-from-wh')?.value;
    const itemId = document.getElementById('trf-item')?.value;
    const item = this.getItems().find(it => it.id === itemId);
    const hintEl = document.getElementById('trf-stock-hint');
    const costEl = document.getElementById('trf-cost');

    if (item) {
      if (costEl && !costEl.value) costEl.value = item.cost_price;
      const matchedWs = item.warehouse_stocks?.find(ws => ws.warehouse_id === fromWhId);
      const stock = matchedWs ? matchedWs.stock : 0;
      if (hintEl) {
        hintEl.innerHTML = `Stok tersedia di gudang asal: <span style="font-weight:700; color:${stock > 0 ? '#059669' : '#DC2626'};">${stock} ${item.unit}</span> (HPP: ${App.formatIDR(item.cost_price)})`;
      }
    }
  },

  submitTransferStock: async function() {
    const date = document.getElementById('trf-date')?.value;
    const fromWh = document.getElementById('trf-from-wh')?.value;
    const toWh = document.getElementById('trf-to-wh')?.value;
    const itemId = document.getElementById('trf-item')?.value;
    const qty = parseFloat(document.getElementById('trf-qty')?.value) || 0;
    const unitCost = parseFloat(document.getElementById('trf-cost')?.value) || 0;
    const ref = document.getElementById('trf-ref')?.value.trim();
    const notes = document.getElementById('trf-notes')?.value.trim();
    const autoJournal = document.getElementById('trf-autojournal')?.checked;
    const fileInput = document.getElementById('trf-attachment');

    if (fromWh === toWh) {
      alert('Gudang Asal dan Gudang Tujuan tidak boleh sama!');
      return;
    }
    if (qty <= 0) {
      alert('Kuantitas transfer harus lebih besar dari 0!');
      return;
    }

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('tx_type', 'TRANSFER');
    formData.append('date', date);
    formData.append('item_id', itemId);
    formData.append('from_warehouse_id', fromWh);
    formData.append('to_warehouse_id', toWh);
    formData.append('qty', qty);
    formData.append('unit_cost', unitCost);
    formData.append('reference_no', ref);
    formData.append('notes', notes);
    formData.append('auto_journal', autoJournal);
    if (fileInput && fileInput.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Transfer stok antar gudang berhasil dicatat!', 'success');
      App.closeModal();
      this.activeTab = 'journals';
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 2. MODAL PENERIMAAN BARANG (IN)
  showInModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const whList = this.getWarehouses();
    const itemList = this.getItems();
    const accList = this.getAccounts();

    const whOptions = whList.map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');
    const itemOptions = itemList.map(it => `<option value="${it.id}">[${it.sku}] ${it.name}</option>`).join('');
    
    const contraAccounts = accList.filter(a => 
      a.category === 'KEWAJIBAN_LANCAR' || a.category === 'ASET_LANCAR'
    ).map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-in-stock" enctype="multipart/form-data">
        <div style="background: #ECFDF5; border: 1px solid #10B981; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <strong style="color: #065F46;">📥 Penerimaan Barang Masuk (IN) ke Gudang</strong>
          <div style="font-size: 12px; color: #047857; margin-top: 2px;">
            Mencatat pembelian atau penerimaan fisik barang ke gudang tujuan. Menambah stok gudang dan menghasilkan voucher jurnal persediaan.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Penerimaan *</label>
            <input type="date" id="in-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Gudang Tujuan Masuk *</label>
            <select id="in-wh" class="form-control">${whOptions}</select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Barang Persediaan *</label>
          <select id="in-item" class="form-control" onchange="Modules.Inventory.updateInCost()">${itemOptions}</select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kuantitas Masuk (Qty) *</label>
            <input type="number" id="in-qty" class="form-control" value="1" min="1" step="any" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Beli Satuan (HPP) *</label>
            <input type="number" id="in-cost" class="form-control" step="any" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Lawan Akun Kredit (Kewajiban / Kas / Bank) *</label>
          <select id="in-contra" class="form-control">${contraAccounts}</select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">No. Surat Jalan / Faktur Supplier</label>
            <input type="text" id="in-ref" class="form-control" placeholder="Contoh: SJ-SUP/2026/02/89">
          </div>
          <div class="form-group">
            <label class="form-label">Catatan / Uraian</label>
            <input type="text" id="in-notes" class="form-control" placeholder="Contoh: Pengiriman pesanan PO-102">
          </div>
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah Berkas Bukti Surat Jalan / Invoice Vendor (PDF/Gambar)</label>
          <input type="file" id="in-attachment" class="form-control" accept="image/*,application/pdf">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="in-autojournal" checked>
            <strong>Otomatis Buat Entri Voucher Jurnal Persediaan</strong>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Inventory.submitInStock()">Simpan Penerimaan</button>
    `;

    App.showModal('Penerimaan Barang Masuk (IN) ke Gudang', body, footer);
    this.updateInCost();
  },

  updateInCost: function() {
    const itemId = document.getElementById('in-item')?.value;
    const item = this.getItems().find(it => it.id === itemId);
    const costEl = document.getElementById('in-cost');
    if (item && costEl) {
      costEl.value = item.cost_price;
    }
  },

  submitInStock: async function() {
    const date = document.getElementById('in-date')?.value;
    const whId = document.getElementById('in-wh')?.value;
    const itemId = document.getElementById('in-item')?.value;
    const qty = parseFloat(document.getElementById('in-qty')?.value) || 0;
    const cost = parseFloat(document.getElementById('in-cost')?.value) || 0;
    const contra = document.getElementById('in-contra')?.value;
    const ref = document.getElementById('in-ref')?.value.trim();
    const notes = document.getElementById('in-notes')?.value.trim();
    const autoJournal = document.getElementById('in-autojournal')?.checked;
    const fileInput = document.getElementById('in-attachment');

    if (qty <= 0) {
      alert('Kuantitas masuk harus lebih besar dari 0!');
      return;
    }

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('tx_type', 'IN');
    formData.append('date', date);
    formData.append('warehouse_id', whId);
    formData.append('item_id', itemId);
    formData.append('qty', qty);
    formData.append('unit_cost', cost);
    formData.append('contra_account_id', contra);
    formData.append('reference_no', ref);
    formData.append('notes', notes);
    formData.append('auto_journal', autoJournal);
    if (fileInput && fileInput.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Penerimaan barang berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 3. MODAL PENGELUARAN BARANG (OUT)
  showOutModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const whList = this.getWarehouses();
    const itemList = this.getItems();
    const accList = this.getAccounts();

    const whOptions = whList.map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');
    const itemOptions = itemList.map(it => `<option value="${it.id}">[${it.sku}] ${it.name}</option>`).join('');
    
    const contraAccounts = accList.filter(a => 
      a.category === 'HPP' || a.category === 'BEBAN_OPERASIONAL'
    ).map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-out-stock" enctype="multipart/form-data">
        <div style="background: #FEF2F2; border: 1px solid #EF4444; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <strong style="color: #991B1B;">📤 Pengeluaran Barang (OUT / Pemakaian / HPP)</strong>
          <div style="font-size: 12px; color: #7F1D1D; margin-top: 2px;">
            Mencatat pengeluaran barang dari gudang untuk pemakaian internal, penjualan, atau proyek. Mengurangi stok gudang dan mendebit akun HPP/Beban.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Pengeluaran *</label>
            <input type="date" id="out-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Gudang Asal Pengeluaran *</label>
            <select id="out-wh" class="form-control" onchange="Modules.Inventory.updateOutStockHint()">${whOptions}</select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Barang Persediaan *</label>
          <select id="out-item" class="form-control" onchange="Modules.Inventory.updateOutStockHint()">${itemOptions}</select>
          <div id="out-stock-hint" style="font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 4px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Jumlah Keluar (Qty) *</label>
            <input type="number" id="out-qty" class="form-control" value="1" min="1" step="any" required>
          </div>
          <div class="form-group">
            <label class="form-label">Lawan Akun Debit (HPP / Beban) *</label>
            <select id="out-contra" class="form-control">${contraAccounts}</select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">No. Surat Jalan / Bukti Pengeluaran</label>
            <input type="text" id="out-ref" class="form-control" placeholder="Contoh: SJ-OUT/2026/02/10">
          </div>
          <div class="form-group">
            <label class="form-label">Catatan / Keterangan</label>
            <input type="text" id="out-notes" class="form-control" placeholder="Contoh: Pemakaian instalasi server client">
          </div>
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah Berkas Bukti Surat Jalan / Tanda Terima Pengeluaran (PDF/Gambar)</label>
          <input type="file" id="out-attachment" class="form-control" accept="image/*,application/pdf">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="out-autojournal" checked>
            <strong>Otomatis Buat Entri Voucher Jurnal Persediaan</strong>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-outline" style="border-color: #DC2626; color: #DC2626;" onclick="Modules.Inventory.submitOutStock()">Proses Pengeluaran</button>
    `;

    App.showModal('Pengeluaran Barang Persediaan (OUT)', body, footer);
    this.updateOutStockHint();
  },

  updateOutStockHint: function() {
    const whId = document.getElementById('out-wh')?.value;
    const itemId = document.getElementById('out-item')?.value;
    const item = this.getItems().find(it => it.id === itemId);
    const hintEl = document.getElementById('out-stock-hint');

    if (item && hintEl) {
      const matched = item.warehouse_stocks?.find(ws => ws.warehouse_id === whId);
      const stock = matched ? matched.stock : 0;
      hintEl.innerHTML = `Stok tersedia di gudang ini: <span style="font-weight:700; color:${stock > 0 ? '#059669' : '#DC2626'};">${stock} ${item.unit}</span>`;
    }
  },

  submitOutStock: async function() {
    const date = document.getElementById('out-date')?.value;
    const whId = document.getElementById('out-wh')?.value;
    const itemId = document.getElementById('out-item')?.value;
    const qty = parseFloat(document.getElementById('out-qty')?.value) || 0;
    const contra = document.getElementById('out-contra')?.value;
    const ref = document.getElementById('out-ref')?.value.trim();
    const notes = document.getElementById('out-notes')?.value.trim();
    const autoJournal = document.getElementById('out-autojournal')?.checked;
    const fileInput = document.getElementById('out-attachment');

    if (qty <= 0) {
      alert('Kuantitas keluar harus lebih besar dari 0!');
      return;
    }

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('tx_type', 'OUT');
    formData.append('date', date);
    formData.append('warehouse_id', whId);
    formData.append('item_id', itemId);
    formData.append('qty', qty);
    formData.append('contra_account_id', contra);
    formData.append('reference_no', ref);
    formData.append('notes', notes);
    formData.append('auto_journal', autoJournal);
    if (fileInput && fileInput.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Pengeluaran barang berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 4. MODAL STOCK OPNAME / PENYESUAIAN
  showOpnameModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const whList = this.getWarehouses();
    const itemList = this.getItems();
    const accList = this.getAccounts();

    const whOptions = whList.map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');
    const itemOptions = itemList.map(it => `<option value="${it.id}">[${it.sku}] ${it.name}</option>`).join('');
    const adjAccounts = accList.map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');

    const body = `
      <form id="form-opname-stock" enctype="multipart/form-data">
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <strong style="color: #002B49;">⚖️ Penyesuaian Fisik / Stock Opname Multi Gudang</strong>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">
            Menyesuaikan stok sistem dengan hasil penghitungan fisik aktual di gudang tertentu. Selisih lebih atau kurang akan otomatis dijurnal ke akun penyesuaian.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Opname *</label>
            <input type="date" id="opn-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Gudang yang Di-Opname *</label>
            <select id="opn-wh" class="form-control" onchange="Modules.Inventory.updateOpnameCalc()">${whOptions}</select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Barang Persediaan *</label>
          <select id="opn-item" class="form-control" onchange="Modules.Inventory.updateOpnameCalc()">${itemOptions}</select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #F1F5F9; padding: 12px; border-radius: 6px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Stok Buku Sistem</label>
            <input type="text" id="opn-system-stock" class="form-control" readonly style="background: #E2E8F0; font-weight: 700;">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Stok Fisik Aktual *</label>
            <input type="number" id="opn-actual-qty" class="form-control" value="0" step="any" oninput="Modules.Inventory.updateOpnameCalc()" required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Selisih Kuantitas</label>
            <div id="opn-diff-display" style="padding: 8px; font-weight: 700; border-radius: 4px; text-align: center; margin-top: 4px;">0</div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">Lawan Akun Selisih (Beban Selisih Stok / Pendapatan Lain) *</label>
          <select id="opn-contra" class="form-control">${adjAccounts}</select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">No. Berita Acara Opname (BAP)</label>
            <input type="text" id="opn-ref" class="form-control" placeholder="Contoh: BAP-OPN/2026/02/01">
          </div>
          <div class="form-group">
            <label class="form-label">Catatan / Tim Opname</label>
            <input type="text" id="opn-notes" class="form-control" placeholder="Contoh: Opname akhir bulan auditor internal">
          </div>
        </div>

        <div class="form-group" style="background: #F1F5F9; padding: 10px; border-radius: 6px; border: 1px dashed #CBD5E1;">
          <label class="form-label">📁 Unggah Berkas Berita Acara Opname / BAP (PDF/Gambar)</label>
          <input type="file" id="opn-attachment" class="form-control" accept="image/*,application/pdf">
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="opn-autojournal" checked>
            <strong>Otomatis Buat Entri Voucher Jurnal Persediaan</strong>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.Inventory.submitOpnameStock()">Simpan Hasil Opname</button>
    `;

    App.showModal('Stock Opname & Penyesuaian Fisik', body, footer);
    this.updateOpnameCalc();
  },

  updateOpnameCalc: function() {
    const whId = document.getElementById('opn-wh')?.value;
    const itemId = document.getElementById('opn-item')?.value;
    const item = this.getItems().find(it => it.id === itemId);
    const matched = item?.warehouse_stocks?.find(ws => ws.warehouse_id === whId);
    const systemStock = matched ? matched.stock : 0;

    const sysEl = document.getElementById('opn-system-stock');
    if (sysEl) sysEl.value = `${systemStock} ${item?.unit || 'PCS'}`;

    const actualQty = parseFloat(document.getElementById('opn-actual-qty')?.value) || 0;
    const diff = actualQty - systemStock;

    const diffEl = document.getElementById('opn-diff-display');
    if (diffEl) {
      if (diff > 0) {
        diffEl.style.background = '#D1FAE5';
        diffEl.style.color = '#065F46';
        diffEl.innerText = `+${diff} (Surplus / Lebih)`;
      } else if (diff < 0) {
        diffEl.style.background = '#FEE2E2';
        diffEl.style.color = '#991B1B';
        diffEl.innerText = `${diff} (Defisit / Kurang)`;
      } else {
        diffEl.style.background = '#E2E8F0';
        diffEl.style.color = '#334155';
        diffEl.innerText = `0 (Sesuai / Pas)`;
      }
    }
  },

  submitOpnameStock: async function() {
    const date = document.getElementById('opn-date')?.value;
    const whId = document.getElementById('opn-wh')?.value;
    const itemId = document.getElementById('opn-item')?.value;
    const actualQty = parseFloat(document.getElementById('opn-actual-qty')?.value);
    const contra = document.getElementById('opn-contra')?.value;
    const ref = document.getElementById('opn-ref')?.value.trim();
    const notes = document.getElementById('opn-notes')?.value.trim();
    const autoJournal = document.getElementById('opn-autojournal')?.checked;
    const fileInput = document.getElementById('opn-attachment');

    if (isNaN(actualQty) || actualQty < 0) {
      alert('Kuantitas fisik aktual harus angka valid dan >= 0!');
      return;
    }

    const formData = new FormData();
    formData.append('entity_id', App.activeEntity.id);
    formData.append('tx_type', 'ADJUSTMENT');
    formData.append('date', date);
    formData.append('warehouse_id', whId);
    formData.append('item_id', itemId);
    formData.append('qty', actualQty);
    formData.append('contra_account_id', contra);
    formData.append('reference_no', ref);
    formData.append('notes', notes);
    formData.append('auto_journal', autoJournal);
    if (fileInput && fileInput.files[0]) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Penyesuaian fisik opname berhasil dicatat!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 5. MASTER MULTI GUDANG (TAMBAH / EDIT)
  showWarehouseModal: function(whId = null) {
    const wh = whId ? this.getWarehouses().find(w => w.id === whId) : null;
    const isEdit = !!wh;

    const accOptions = `<option value="">Default Akun Persediaan [1108]</option>` +
      this.getAccounts().filter(a => a.category === 'ASET_LANCAR').map(a => `
        <option value="${a.id}" ${wh && wh.inventory_account_id === a.id ? 'selected' : ''}>[${a.code}] ${a.name}</option>
      `).join('');

    const body = `
      <form id="form-warehouse">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Kode Gudang *</label>
            <input type="text" id="wh-code" class="form-control" placeholder="Contoh: GDG-JKT" value="${wh?.code || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Gudang / Cabang Logistik *</label>
            <input type="text" id="wh-name" class="form-control" placeholder="Contoh: Gudang Utama Pulogadung" value="${wh?.name || ''}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat / Lokasi Fisik</label>
          <input type="text" id="wh-location" class="form-control" placeholder="Alamat lengkap pergudangan" value="${wh?.location || ''}">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Penanggung Jawab (PIC Gudang)</label>
            <input type="text" id="wh-pic" class="form-control" placeholder="Nama Kepala Gudang / Supervisor" value="${wh?.pic || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Akun Pembukuan Persediaan Khusus</label>
            <select id="wh-acc" class="form-control">${accOptions}</select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.Inventory.saveWarehouse('${whId || ''}')">
        ${isEdit ? 'Perbarui Gudang' : 'Simpan Gudang'}
      </button>
    `;

    App.showModal(isEdit ? `Edit Gudang: ${wh.name}` : 'Tambah Master Gudang Baru', body, footer);
  },

  saveWarehouse: async function(whId) {
    const code = document.getElementById('wh-code')?.value.trim();
    const name = document.getElementById('wh-name')?.value.trim();
    const location = document.getElementById('wh-location')?.value.trim();
    const pic = document.getElementById('wh-pic')?.value.trim();
    const acc = document.getElementById('wh-acc')?.value || null;

    if (!code || !name) {
      alert('Kode dan Nama Gudang wajib diisi!');
      return;
    }

    try {
      const url = whId ? `/api/inventory/warehouses/${whId}` : '/api/inventory/warehouses';
      const method = whId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          code, name, location, pic, inventory_account_id: acc
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message || 'Data gudang berhasil disimpan!', 'success');
      App.closeModal();
      this.activeTab = 'warehouses';
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  deleteWarehouse: async function(whId) {
    const wh = this.getWarehouses().find(w => w.id === whId);
    if (!confirm(`Hapus gudang ${wh?.name || ''}? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`/api/inventory/warehouses/${whId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast(result.message || 'Gudang berhasil dihapus', 'success');
      this.activeTab = 'warehouses';
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 6. MODAL MASTER BARANG BARU DENGAN MULTI GUDANG
  showAddItemModal: function() {
    const accInv = this.getAccounts().filter(a => a.category === 'ASET_LANCAR').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const accCogs = this.getAccounts().filter(a => a.category === 'HPP').map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
    const whOptions = this.getWarehouses().map(w => `<option value="${w.id}">[${w.code}] ${w.name}</option>`).join('');

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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Harga Pokok (HPP Beli) *</label>
            <input type="number" id="new-item-cost" class="form-control" value="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Jual Standar *</label>
            <input type="number" id="new-item-sell" class="form-control" value="0" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Alokasi Gudang Awal</label>
            <select id="new-item-wh" class="form-control">${whOptions}</select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Stok Awal</label>
            <input type="number" id="new-item-stock" class="form-control" value="0">
          </div>
        </div>

        <div style="background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1; margin-top: 10px;">
          <div style="font-weight: 700; margin-bottom: 6px; color: #002B49;">Pemetaan Akun Akuntansi</div>
          <div class="form-group">
            <label class="form-label">Akun Persediaan (Neraca):</label>
            <select id="new-item-acc-inv" class="form-control">${accInv}</select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
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
    const whId = document.getElementById('new-item-wh')?.value;
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
          warehouse_id: whId,
          inventory_account_id: invAcc, cogs_account_id: cogsAcc
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Barang berhasil ditambahkan!', 'success');
      App.closeModal();
      this.activeTab = 'items';
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  // 7. KARTU STOK MULTI GUDANG (STOCK CARD)
  showStockCard: async function(itemId, selectedWh = 'ALL') {
    try {
      const whParam = selectedWh ? `&warehouse_id=${selectedWh}` : '';
      const res = await fetch(`/api/inventory/stock-card/${itemId}?entity_id=${App.activeEntity.id}${whParam}`);
      const data = await res.json();
      const item = data.item;

      const whList = this.getWarehouses();
      const whOptions = `<option value="ALL">Semua Gudang (Konsolidasi)</option>` + 
        whList.map(w => `<option value="${w.id}" ${data.warehouse_id === w.id ? 'selected' : ''}>[${w.code}] ${w.name}</option>`).join('');

      let rowsHtml = (data.transactions || []).map(t => {
        let typeBadge = '';
        if (t.tx_type === 'IN') typeBadge = `<span class="badge badge-success">IN</span>`;
        else if (t.tx_type === 'OUT') typeBadge = `<span class="badge badge-danger">OUT</span>`;
        else if (t.tx_type === 'TRANSFER') typeBadge = `<span class="badge badge-warning">TRANSFER</span>`;
        else typeBadge = `<span class="badge badge-neutral">ADJ</span>`;

        let whRoute = '';
        if (t.tx_type === 'TRANSFER') {
          whRoute = `${t.from_warehouse_code || 'ASAL'} ➔ ${t.to_warehouse_code || 'TUJUAN'}`;
        } else {
          whRoute = t.warehouse_code || '-';
        }

        return `
          <tr>
            <td>${t.date}</td>
            <td class="text-center">${typeBadge}</td>
            <td><strong>${whRoute}</strong></td>
            <td>${t.reference_no || '-'}</td>
            <td>${t.notes || '-'}</td>
            <td class="text-right">${t.in_qty > 0 ? t.in_qty : '-'}</td>
            <td class="text-right">${t.in_cost > 0 ? App.formatIDR(t.in_cost) : '-'}</td>
            <td class="text-right">${t.out_qty > 0 ? t.out_qty : '-'}</td>
            <td class="text-right">${t.out_cost > 0 ? App.formatIDR(t.out_cost) : '-'}</td>
            <td class="text-center font-weight-bold" style="color: #002B49;">${t.balance_qty}</td>
            <td class="text-right">${App.formatIDR(t.avg_cost)}</td>
            <td class="text-right font-weight-bold" style="color: #002B49;">${App.formatIDR(t.balance_valuation)}</td>
          </tr>
        `;
      }).join('');

      const body = `
        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <div style="font-size: 16px; font-weight: 700; color: #002B49;">[${item.sku}] ${item.name}</div>
              <div style="font-size: 12px; color: #64748B;">Satuan: ${item.unit} | Kategori: ${item.category}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 600;">Lokasi Gudang:</span>
              <select id="sc-wh-select" class="form-control" style="width: 230px;" onchange="Modules.Inventory.showStockCard('${item.id}', this.value)">
                ${whOptions}
              </select>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px dashed #CBD5E1; padding-top: 8px;">
            <div><strong>Saldo Akhir Kuantitas:</strong> <span class="badge badge-success" style="font-size: 13px;">${data.current_stock} ${item.unit}</span></div>
            <div class="text-right"><strong>Total Nilai Valuasi:</strong> <strong style="color: #B45309; font-size: 14px;">${App.formatIDR(data.current_valuation)}</strong></div>
          </div>
        </div>

        <div style="max-height: 55vh; overflow-y: auto;">
          <table class="coretax-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 90px; vertical-align: middle;">Tanggal</th>
                <th rowspan="2" class="text-center" style="width: 65px; vertical-align: middle;">Tipe</th>
                <th rowspan="2" style="width: 100px; vertical-align: middle;">Gudang</th>
                <th rowspan="2" style="width: 110px; vertical-align: middle;">No. Ref</th>
                <th rowspan="2" style="vertical-align: middle;">Keterangan</th>
                <th colspan="2" class="text-center" style="background: #D1FAE5; color: #065F46;">Masuk (IN)</th>
                <th colspan="2" class="text-center" style="background: #FEE2E2; color: #991B1B;">Keluar (OUT)</th>
                <th colspan="3" class="text-center" style="background: #E0F2FE; color: #075985;">Saldo Akhir</th>
              </tr>
              <tr>
                <th class="text-right" style="width: 55px;">Qty</th>
                <th class="text-right" style="width: 95px;">Nilai (Rp)</th>
                <th class="text-right" style="width: 55px;">Qty</th>
                <th class="text-right" style="width: 95px;">Nilai (Rp)</th>
                <th class="text-center" style="width: 55px;">Qty</th>
                <th class="text-right" style="width: 85px;">Rata-rata</th>
                <th class="text-right" style="width: 105px;">Valuasi (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="12" class="text-center" style="padding: 20px; color: #94A3B8;">Belum ada mutasi stok tercatat untuk barang ini.</td></tr>`}
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

  // 8. EXPORT DATA
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
      `Persediaan_Multi_Gudang_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      'Persediaan',
      'DAFTAR VALUASI PERSEDIAAN BARANG DAGANG MULTI GUDANG',
      App.activeEntity,
      headers,
      this.getItems()
    );
  }
};
