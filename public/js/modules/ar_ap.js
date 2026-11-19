/**
 * Receivables & Payables Control Module (Kontrol Hutang dan Piutang)
 */

Modules.AR_AP = {
  currentTab: 'AR', // 'AR' (Piutang) or 'AP' (Hutang)
  invoices: [],
  contacts: [],
  aging: null,

  render: async function(container) {
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Memuat Kontrol Hutang & Piutang...</div>`;

    try {
      await this.loadData();

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h1 class="page-title">
              <span>👥</span> Kontrol Hutang & Piutang Usaha (AR & AP Control)
            </h1>
            <div class="page-subtitle">
              Entitas: <strong>${App.activeEntity?.name}</strong> | Buku Pembantu, Jadwal Umur Piutang (Aging), Pelunasan & Faktur Pajak
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-outline" onclick="CoretaxImporter.showImportModal('invoices', () => Modules.AR_AP.render(document.getElementById('main-content-view')))">
              <span>📥</span> Template & Impor Tagihan
            </button>
            <button class="btn btn-outline" onclick="CoretaxImporter.showImportModal('contacts', () => Modules.AR_AP.render(document.getElementById('main-content-view')))">
              <span>📥</span> Template & Impor Kontak
            </button>
            <button class="btn btn-gold" onclick="Modules.AR_AP.showAddInvoiceModal()">
              <span>➕</span> Buat Faktur Tagihan (${this.currentTab})
            </button>
            <button class="btn btn-primary" onclick="Modules.AR_AP.showAddContactModal()">
              <span>👤</span> Tambah Kontak / Mitra
            </button>
            <button class="btn btn-outline" onclick="Modules.AR_AP.exportExcel()">
              <span>📊</span> Export Excel
            </button>
            <button class="btn btn-outline" onclick="CoretaxExport.printReport('KONTROL HUTANG PIUTANG & AGING', App.activeEntity)">
              <span>🖨️</span> Cetak / PDF
            </button>
          </div>
        </div>

        <div id="print-header-area"></div>

        <!-- TABS: PIUTANG (AR) VS HUTANG (AP) -->
        <div class="coretax-tabs">
          <button class="tab-btn ${this.currentTab === 'AR' ? 'active' : ''}" onclick="Modules.AR_AP.switchTab('AR')">
            💵 Piutang Usaha (Accounts Receivable - AR)
          </button>
          <button class="tab-btn ${this.currentTab === 'AP' ? 'active' : ''}" onclick="Modules.AR_AP.switchTab('AP')">
            💳 Hutang Usaha (Accounts Payable - AP)
          </button>
        </div>

        <!-- AGING SCHEDULE CARDS -->
        <div class="grid-cards">
          <div class="stat-card accent-navy">
            <div class="stat-title">Total Saldo Terutang (${this.currentTab})</div>
            <div class="stat-value">${App.formatIDR(this.aging?.summary?.totalOutstanding || 0)}</div>
            <div class="stat-sub">Posisi per tanggal hari ini</div>
          </div>
          <div class="stat-card accent-green">
            <div class="stat-title">Belum Jatuh Tempo (Current)</div>
            <div class="stat-value" style="color: #059669;">${App.formatIDR(this.aging?.summary?.bucketCurrent || 0)}</div>
            <div class="stat-sub">Status: Sangat Lancar</div>
          </div>
          <div class="stat-card accent-gold">
            <div class="stat-title">Lewat Jatuh Tempo (1 - 30 Hari)</div>
            <div class="stat-value" style="color: #D97706;">${App.formatIDR(this.aging?.summary?.bucket1_30 || 0)}</div>
            <div class="stat-sub">Perlu Follow-up Tagihan</div>
          </div>
          <div class="stat-card accent-red">
            <div class="stat-title">Kritis (> 60 Hari)</div>
            <div class="stat-value" style="color: #DC2626;">${App.formatIDR((this.aging?.summary?.bucket61_90 || 0) + (this.aging?.summary?.bucketOver90 || 0))}</div>
            <div class="stat-sub">Potensi CKPN / Kerugian</div>
          </div>
        </div>

        <!-- INVOICES TABLE -->
        <div class="card-table-wrapper">
          <div class="table-header-toolbar">
            <div class="table-title"><span>📋</span> Daftar Faktur & Kartu ${this.currentTab === 'AR' ? 'Piutang Pelanggan' : 'Hutang Pemasok'}</div>
            <div style="display: flex; gap: 8px;">
              <select id="inv-status-filter" class="form-control" style="width: 150px;" onchange="Modules.AR_AP.filterTable()">
                <option value="ALL">Semua Status</option>
                <option value="UNPAID">Belum Lunas (Unpaid)</option>
                <option value="PARTIAL">Cicilan (Partial)</option>
                <option value="PAID">Lunas (Paid)</option>
              </select>
              <input type="text" id="inv-search-input" class="form-control" placeholder="Cari no faktur, mitra..." style="width: 250px;" oninput="Modules.AR_AP.filterTable()">
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="coretax-table" id="invoices-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Tanggal</th>
                  <th style="width: 100px;">Jatuh Tempo</th>
                  <th style="width: 130px;">No. Faktur</th>
                  <th>${this.currentTab === 'AR' ? 'Nama Pelanggan (Customer)' : 'Nama Pemasok (Vendor)'}</th>
                  <th style="width: 140px;">No. Faktur Pajak</th>
                  <th class="text-right" style="width: 130px;">Total Tagihan</th>
                  <th class="text-right" style="width: 130px;">Sisa Tagihan</th>
                  <th class="text-center" style="width: 90px;">Status</th>
                  <th class="text-center" style="width: 110px;">Pelunasan</th>
                </tr>
              </thead>
              <tbody id="invoices-table-body">
                ${this.renderRows(this.invoices)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="stat-card accent-red">Gagal memuat: ${err.message}</div>`;
    }
  },

  loadData: async function() {
    const [invRes, agingRes, contRes] = await Promise.all([
      fetch(`/api/rp/invoices?entity_id=${App.activeEntity.id}&type=${this.currentTab}`),
      fetch(`/api/rp/aging?entity_id=${App.activeEntity.id}&type=${this.currentTab}`),
      fetch(`/api/rp/contacts?entity_id=${App.activeEntity.id}`)
    ]);

    const invData = await invRes.json();
    this.invoices = invData.invoices || [];
    this.aging = await agingRes.json();
    this.contacts = await contRes.json();
  },

  switchTab: async function(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('main-content-view'));
  },

  renderRows: function(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="9" class="text-center" style="padding: 20px;">Belum ada tagihan terdaftar untuk kategori ini.</td></tr>`;
    }

    return list.map(inv => {
      let badgeClass = 'badge-danger';
      if (inv.status === 'PAID') badgeClass = 'badge-success';
      else if (inv.status === 'PARTIAL') badgeClass = 'badge-warning';

      return `
        <tr>
          <td>${inv.date}</td>
          <td><strong>${inv.due_date}</strong></td>
          <td><strong>${inv.invoice_no}</strong></td>
          <td>
            <strong>${inv.contact_name}</strong>
            ${inv.contact_npwp ? `<div style="font-size: 11px; color: #64748B;">NPWP: ${inv.contact_npwp}</div>` : ''}
          </td>
          <td>${inv.faktur_pajak_no ? `<span class="badge badge-info">${inv.faktur_pajak_no}</span>` : '<span style="color:#94A3B8;">-</span>'}</td>
          <td class="text-right">${App.formatIDR(inv.total_amount)}</td>
          <td class="text-right font-weight-bold" style="color: ${inv.balance_due > 0 ? '#DC2626' : '#059669'};">
            ${App.formatIDR(inv.balance_due)}
          </td>
          <td class="text-center"><span class="badge ${badgeClass}">${inv.status}</span></td>
          <td class="text-center">
            ${inv.balance_due > 0 ? `
              <button class="btn btn-sm btn-gold" onclick="Modules.AR_AP.showPaymentModal('${inv.id}')">
                💰 Bayar
              </button>
            ` : '<span class="badge badge-success">✓ Lunas</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  filterTable: function() {
    const status = document.getElementById('inv-status-filter')?.value || 'ALL';
    const q = document.getElementById('inv-search-input')?.value.toLowerCase() || '';

    const filtered = this.invoices.filter(i => {
      const matchStatus = status === 'ALL' || i.status === status;
      const matchQ = i.invoice_no.toLowerCase().includes(q) || i.contact_name.toLowerCase().includes(q) || (i.faktur_pajak_no && i.faktur_pajak_no.toLowerCase().includes(q));
      return matchStatus && matchQ;
    });

    document.getElementById('invoices-table-body').innerHTML = this.renderRows(filtered);
  },

  showPaymentModal: function(invId) {
    const inv = this.invoices.find(i => i.id === invId);
    if (!inv) return;

    const today = new Date().toISOString().slice(0, 10);

    const body = `
      <form id="form-pay">
        <div style="background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 14px;">
          <div><strong>Faktur:</strong> ${inv.invoice_no} (${inv.contact_name})</div>
          <div>Total Tagihan: ${App.formatIDR(inv.total_amount)} | Sudah Dibayar: ${App.formatIDR(inv.paid_amount)}</div>
          <div style="font-size: 14px; font-weight: 700; color: #DC2626; margin-top: 4px;">
            Sisa Tagihan yang Harus Dilunasi: ${App.formatIDR(inv.balance_due)}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Pelunasan *</label>
            <input type="date" id="pay-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nominal Pembayaran (Rp) *</label>
            <input type="number" id="pay-amount" class="form-control" value="${inv.balance_due}" max="${inv.balance_due}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Metode Pembayaran *</label>
            <select id="pay-method" class="form-control">
              <option value="BANK_TRANSFER">Transfer Bank</option>
              <option value="KAS">Kas Tunai</option>
              <option value="GIRO">Cek / Bilyet Giro</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Referensi Transaksi Bank</label>
            <input type="text" id="pay-ref" class="form-control" placeholder="Contoh: TRF-BCA-887123">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan Tambahan</label>
          <input type="text" id="pay-notes" class="form-control" placeholder="Keterangan pelunasan...">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.AR_AP.savePayment('${inv.id}')">Konfirmasi Pelunasan</button>
    `;

    App.showModal(`Pelunasan Faktur ${inv.invoice_no}`, body, footer);
  },

  savePayment: async function(invId) {
    const date = document.getElementById('pay-date')?.value;
    const amount = parseFloat(document.getElementById('pay-amount')?.value) || 0;
    const method = document.getElementById('pay-method')?.value;
    const ref = document.getElementById('pay-ref')?.value.trim();
    const notes = document.getElementById('pay-notes')?.value.trim();

    if (amount <= 0) {
      alert('Jumlah pembayaran harus lebih dari 0!');
      return;
    }

    try {
      const res = await fetch('/api/rp/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          invoice_id: invId,
          date,
          amount,
          payment_method: method,
          account_id: 'ACC-E1-1102', // Bank account
          reference_no: ref,
          notes
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Pembayaran berhasil dibukukan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showAddInvoiceModal: function() {
    const today = new Date().toISOString().slice(0, 10);
    const targetType = this.currentTab === 'AR' ? 'CUSTOMER' : 'VENDOR';
    const contactList = this.contacts.filter(c => c.type === targetType);
    const contactOpts = contactList.map(c => `<option value="${c.id}">[${c.name}] ${c.npwp ? `(NPWP: ${c.npwp})` : ''}</option>`).join('');

    const body = `
      <form id="form-add-inv">
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">${this.currentTab === 'AR' ? 'Pilih Pelanggan (Customer) *' : 'Pilih Pemasok (Vendor) *'}</label>
            <select id="new-inv-contact" class="form-control" required>${contactOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Faktur Komersial *</label>
            <input type="text" id="new-inv-no" class="form-control" placeholder="Contoh: INV/2026/02/099" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tanggal Faktur *</label>
            <input type="date" id="new-inv-date" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Jatuh Tempo *</label>
            <input type="date" id="new-inv-due" class="form-control" value="${today}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nomor Faktur Pajak DJP (e-Faktur Coretax)</label>
            <input type="text" id="new-inv-fp" class="form-control" placeholder="Contoh: 010.001-26.12345678">
          </div>
          <div class="form-group">
            <label class="form-label">Tarif PPN (%)</label>
            <input type="number" id="new-inv-taxrate" class="form-control" value="11" oninput="Modules.AR_AP.calcInvTotal()">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subtotal Nilai DPP (Sebelum Pajak) (Rp) *</label>
          <input type="number" id="new-inv-subtotal" class="form-control" value="0" oninput="Modules.AR_AP.calcInvTotal()" required>
        </div>

        <div id="new-inv-calc-box" style="background: #F8FAFC; padding: 10px; border-radius: 6px; border: 1px solid #CBD5E1;">
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <div>PPN Terutang: <strong id="new-inv-vat" style="color: #D97706;">Rp 0</strong></div>
            <div>Total Tagihan: <strong id="new-inv-total" style="color: #002B49; font-size: 15px;">Rp 0</strong></div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 10px;">
          <label class="form-label">Catatan / Uraian</label>
          <input type="text" id="new-inv-notes" class="form-control" placeholder="Deskripsi transaksi faktur...">
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-gold" onclick="Modules.AR_AP.saveNewInvoice()">Simpan Faktur</button>
    `;

    App.showModal(`Buat Faktur ${this.currentTab === 'AR' ? 'Penjualan (Piutang)' : 'Pembelian (Hutang)'}`, body, footer);
  },

  calcInvTotal: function() {
    const sub = parseFloat(document.getElementById('new-inv-subtotal')?.value) || 0;
    const rate = parseFloat(document.getElementById('new-inv-taxrate')?.value) || 0;
    const vat = (sub * rate) / 100;
    const tot = sub + vat;

    document.getElementById('new-inv-vat').textContent = App.formatIDR(vat);
    document.getElementById('new-inv-total').textContent = App.formatIDR(tot);
  },

  saveNewInvoice: async function() {
    const contactId = document.getElementById('new-inv-contact')?.value;
    const invNo = document.getElementById('new-inv-no')?.value.trim();
    const date = document.getElementById('new-inv-date')?.value;
    const dueDate = document.getElementById('new-inv-due')?.value;
    const fp = document.getElementById('new-inv-fp')?.value.trim();
    const subtotal = parseFloat(document.getElementById('new-inv-subtotal')?.value) || 0;
    const taxRate = parseFloat(document.getElementById('new-inv-taxrate')?.value) || 11;
    const notes = document.getElementById('new-inv-notes')?.value.trim();

    if (!invNo || subtotal <= 0) {
      alert('Nomor Faktur dan Subtotal harus diisi!');
      return;
    }

    try {
      const res = await fetch('/api/rp/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          contact_id: contactId,
          invoice_type: this.currentTab,
          invoice_no: invNo,
          date,
          due_date: dueDate,
          subtotal,
          tax_rate: taxRate,
          faktur_pajak_no: fp,
          notes
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Faktur berhasil disimpan dan tercatat di modul perpajakan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  showAddContactModal: function() {
    const body = `
      <form id="form-add-contact">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Tipe Mitra *</label>
            <select id="new-cont-type" class="form-control">
              <option value="CUSTOMER">Pelanggan (Customer)</option>
              <option value="VENDOR">Pemasok / Vendor</option>
              <option value="EMPLOYEE">Karyawan</option>
              <option value="SHAREHOLDER">Pemegang Saham</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Perusahaan / Personal *</label>
            <input type="text" id="new-cont-name" class="form-control" placeholder="Contoh: PT Cemerlang Abadi" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">NPWP (16 Digit Coretax)</label>
            <input type="text" id="new-cont-npwp" class="form-control" placeholder="01.234.567.8-012.000">
          </div>
          <div class="form-group">
            <label class="form-label">Syarat Pembayaran (TOP Hari)</label>
            <input type="number" id="new-cont-terms" class="form-control" value="30">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Nomor Telepon</label>
            <input type="text" id="new-cont-phone" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="new-cont-email" class="form-control">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat Lengkap</label>
          <textarea id="new-cont-address" class="form-control" rows="2"></textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="Modules.AR_AP.saveNewContact()">Simpan Kontak</button>
    `;

    App.showModal('Tambah Mitra Bisnis / Kontak', body, footer);
  },

  saveNewContact: async function() {
    const type = document.getElementById('new-cont-type')?.value;
    const name = document.getElementById('new-cont-name')?.value.trim();
    const npwp = document.getElementById('new-cont-npwp')?.value.trim();
    const terms = parseInt(document.getElementById('new-cont-terms')?.value) || 30;
    const phone = document.getElementById('new-cont-phone')?.value.trim();
    const email = document.getElementById('new-cont-email')?.value.trim();
    const address = document.getElementById('new-cont-address')?.value.trim();

    if (!name) {
      alert('Nama kontak wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/rp/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: App.activeEntity.id,
          type, name, npwp, payment_terms_days: terms, phone, email, address
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      App.toast('Mitra berhasil ditambahkan!', 'success');
      App.closeModal();
      this.render(document.getElementById('main-content-view'));
    } catch (err) {
      alert('Gagal: ' + err.message);
    }
  },

  exportExcel: function() {
    const headers = [
      { key: 'date', label: 'Tanggal Faktur' },
      { key: 'due_date', label: 'Jatuh Tempo' },
      { key: 'invoice_no', label: 'Nomor Faktur' },
      { key: 'contact_name', label: 'Nama Mitra' },
      { key: 'faktur_pajak_no', label: 'No. Faktur Pajak' },
      { key: 'total_amount', label: 'Total Tagihan', type: 'number' },
      { key: 'balance_due', label: 'Sisa Tagihan', type: 'number' },
      { key: 'status', label: 'Status Pelunasan' }
    ];

    CoretaxExport.exportToExcel(
      `Kontrol_${this.currentTab}_${App.activeEntity.name.replace(/\s+/g, '_')}`,
      `Faktur ${this.currentTab}`,
      `KONTROL ${this.currentTab === 'AR' ? 'PIUTANG' : 'HUTANG'} USAHA`,
      App.activeEntity,
      headers,
      this.invoices
    );
  }
};
