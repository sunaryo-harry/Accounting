# Coretax Enterprise Accounting Multi Entitas
### Sistem Akuntansi Keuangan, Persediaan, Aktiva Tetap & Perpajakan Terpadu Indonesia
**Credit by Harry Sunaryo**

Aplikasi akuntansi lengkap berstandar **PSAK (Standar Akuntansi Keuangan)** dan **DJP Coretax Indonesia** yang dirancang khusus untuk perusahaan multi entitas (holding, anak perusahaan, dan cabang). Dilengkapi dengan installer Windows, arsitektur server LAN multi-pengguna, autentikasi pengguna dengan hak akses fleksibel, pelaporan keuangan auditor-grade, analisis rasio, EBITDA, OPEX, kontrol hutang/piutang (AR/AP Aging), equalisasi pajak, PSAK 46 (Pajak Kini & Pajak Tangguhan), serta SPT Tahunan Badan Formulir 1771 (Lampiran I s.d. VI).

---

## 🔐 Kredensial Login Sistem (Default Administrator)
Sistem dilengkapi fitur keamanan autentikasi multi-pengguna dengan kontrol batasan hak akses (Role-Based Access Control):
- **Username:** `Administrator`
- **Password:** `Harry1175`
- **Peran:** `Administrator (Akses Penuh Seluruh Modul)`

Administrator dapat mendaftarkan pengguna baru (Akuntan, Petugas Pajak, Auditor, Operator Kasir/Gudang) dan menentukan batasan hak akses per modul sesuai wewenang masing-masing.

---

## 🏛️ Fitur Utama & Pembaruan Sistem Terkini

### 1. Template & Impor Data Cepat di Seluruh Modul
Tersedia tombol **Template & Impor Data** di setiap modul dengan dukungan format Excel (.XLS) dan CSV:
- **Multi Entitas Perusahaan**
- **Bagan Akun (Chart of Accounts) & Saldo Awal**
- **Jurnal Transaksi (Voucher)**
- **Persediaan Barang Dagang & Kartu Stok**
- **Kontak Pelanggan & Pemasok (Customer / Vendor)**
- **Faktur Tagihan Hutang & Piutang (AR / AP)**
- **Daftar Aktiva Tetap & Fiskal**
- **Bukti Potong & Faktur Pajak (PPh & PPN)**
- **Koreksi Fiskal & PSAK 46**
Setiap modul menyediakan unduhan template terformat rapi disertai data demonstrasi, kotak tempel data, dan pratinjau tabel validasi sebelum eksekusi impor.

### 2. Manajemen Multi Entitas (Edit & Hapus)
- Entitas terdaftar dapat diedit (Nama, NPWP 16 digit Coretax, KPP, Tahun Buku, Direktur, Alamat, Telepon, Email).
- Entitas dapat dihapus dengan konfirmasi keamanan (otomatis mengalihkan ke entitas aktif lain jika entitas yang dihapus sedang digunakan).

### 3. Bagan Akun Dapat Dikembangkan (Expandable Hierarchy & Sub-Accounts)
- Struktur bagan akun mendukung multi-level hirarki (Level 1 Header, Level 2 Sub-Akun Induk, Level 3 Kelompok Akun, Level 4 Akun Detail Transaksi).
- Fitur **+Sub** pada setiap baris akun untuk langsung mengembangkan sub-akun turunan di bawah akun induk yang dipilih dengan penomoran otomatis.

### 4. Unggah Bukti Transaksi Format PDF pada Buku Besar (General Ledger)
- Setiap transaksi pada Buku Besar dilengkapi tombol **Unggah Bukti PDF**.
- **Ketentuan Satu Bukti untuk Seluruh Mutasi**: Jika satu transaksi voucher memiliki beberapa baris mutasi akun (misalnya Debit Kas, Kredit Penjualan, Kredit PPN), cukup **satu berkas PDF yang diunggah**, dan bukti tersebut otomatis terhubung dan tampil pada seluruh buku besar akun terkait.
- Bukti PDF yang diunggah dapat langsung **Buka PDF (Preview di Tab Baru)** dan **Unduh File PDF**.

### 5. Pengaturan Akses Server LAN Dapat Diedit
- Port server (default: 4000) dan host binding (0.0.0.0 / 127.0.0.1) dapat diubah langsung melalui antarmuka aplikasi di menu **Server LAN & Backup**.
- Tersedia opsi penamaan alias / DNS jaringan lokal (misal: `http://server-akuntansi.local:4000`).

### 6. Otomasi Pembuatan Installer Windows di GitHub (GitHub Actions)
- Repositori telah dilengkapi alur kerja otomatis `.github/workflows/build-windows-installer.yml`.
- Setiap pembaruan yang didorong ke GitHub Actions akan secara otomatis mengompilasi Inno Setup Compiler dan menghasilkan berkas installer mandiri:
  `Setup-Coretax-Accounting-Enterprise-x64.exe`
- Berkas installer dapat diunduh langsung dari tab **Actions Artifacts** atau rilis GitHub.

---

## 🏛️ Fitur Utama & Keunggulan Sistem

### 1. Gaya Visual & Pengalaman Pengguna DJP Coretax Indonesia
- Antarmuka modern dan profesional mengadopsi tema resmi **Coretax Indonesia DJP** (*Deep Navy Blue* `#002B49` dengan aksen *Warm Gold* `#D48800` dan kartu data *Clean Slate*).
- Pemilih Entitas Aktif (*Multi-Entity Switcher*) langsung di header atas dengan penanda NPWP 16 digit.
- Indikator status Server LAN *real-time* dengan deteksi alamat IP jaringan lokal otomatis.

### 2. Multi Entitas & Cabang (Multi-Company Support)
- Mendukung pendaftaran banyak entitas bisnis (PT, CV, Holding, Koperasi) dalam satu sistem terpusat.
- Pemisahan data pembukuan atau konsolidasi antar-entitas.
- **Fungsi Input Saldo Awal Entitas**: Validasi keseimbangan *real-time* antara Total Debit dan Total Kredit dengan deteksi selisih otomatis.

### 3. Bagan Akun (Chart of Accounts) Standar PSAK Indonesia
- Struktur akun 5 level yang rapi: Aset Lancar, Aset Tetap, Kewajiban Lancar, Kewajiban Jangka Panjang, Ekuitas, Pendapatan, HPP, Beban Operasional (OPEX), Pendapatan/Beban Lain-lain, dan Beban Pajak.
- Dilengkapi atribut fiskal per akun: penanda objek pemotongan pajak (PPN, PPh 21, PPh 23, PPh 4 ayat 2) dan penanda *tax deductible / non-deductible* untuk rekonsiliasi fiskal otomatis.

### 4. Jurnal Lengkap & Unggah Berkas Bukti Transaksi
- Jurnal Umum (*General Journal*), Jurnal Khusus (Penjualan, Pembelian, Penerimaan Kas, Pengeluaran Kas), dan Jurnal Penyesuaian (*Adjusting Entries*).
- **Unggah File Bukti Transaksi**: Setiap transaksi dapat dilampiri berkas bukti sah (scan kwitansi, invoice supplier, bukti transfer bank, faktur pajak PDF/gambar).
- Validasi auto-balance debit/kredit sebelum pemostingan (*posting*) ke buku besar.

### 5. Buku Besar (General Ledger) Interaktif
- Perhitungan Saldo Berjalan (*Running Balance*) otomatis per akun rekening.
- Tombol **Lihat Bukti** langsung pada setiap baris mutasi untuk memeriksa dokumen sumber transaksi asli.
- Filter berdasarkan akun, rentang tanggal, dan entitas.

### 6. Persediaan (Inventory) & Kartu Stok
- Master barang dagang lengkap dengan SKU, kategori, satuan, harga pokok (HPP), harga jual, dan batas peringatan stok minimum (*low stock alert*).
- Mutasi barang: Penerimaan Barang (IN), Pengeluaran/Penjualan (OUT), dan Penyesuaian Fisik (*Stock Opname Adjustment*).
- **Kartu Stok (Stock Card)** dengan metode penilaian rata-rata tertimbang (*Weighted Average*) dan FIFO, menampilkan kuantitas masuk, keluar, sisa stok, biaya rata-rata, dan total valuasi.
- Otomatisasi jurnal persediaan dan beban pokok penjualan (HPP).

### 7. Kontrol Hutang (AP) & Piutang (AR) Lengkap
- Master Pelanggan (*Customer*) dan Pemasok (*Vendor*) lengkap dengan NPWP/NIK, alamat, dan syarat pembayaran (*Terms of Payment*).
- Pencatatan faktur komersial terintegrasi dengan Nomor Faktur Pajak DJP (e-Faktur).
- **Jadwal Umur Piutang & Hutang (Aging Schedule)**: Pengelompokan umur *Current*, 1-30 hari, 31-60 hari, 61-90 hari, dan >90 hari untuk mitigasi risiko *bad debt*.
- Modul pelunasan tagihan bertahap (*partial payment*) maupun pelunasan penuh (*full payment*).

### 8. Daftar Perincian Aktiva Tetap & Penyusutan Fiskal
- Pencatatan aset tetap lengkap: tanggal perolehan, harga perolehan, nilai residu, dan masa manfaat komersial.
- **Pengelompokan Kelompok Masa Manfaat Fiskal UU PPh**:
  - Bukan Bangunan: Golongan 1 (4 tahun / 25%), Golongan 2 (8 tahun / 12.5%), Golongan 3 (16 tahun / 6.25%), Golongan 4 (20 tahun / 5%).
  - Bangunan: Bangunan Permanen (20 tahun / 5%), Bangunan Tidak Permanen (10 tahun / 10%).
  - Tanah / Tidak Disusutkan.
- Tabel perbandingan Penyusutan Komersial vs Penyusutan Fiskal yang otomatis menghitung **Selisih Penyusutan (Koreksi Fiskal Positif/Negatif)** untuk kebutuhan SPT 1771 dan PSAK 46.

### 9. Perpajakan Terkini & Equalisasi Pajak (Tax Equalization Matrix)
- Modul PPN: Faktur Pajak Keluaran (FPK), Faktur Pajak Masukan (FPM), dan rekapitulasi SPT Masa PPN 1111 (Kurang/Lebih Bayar).
- Modul Bukti Potong Withholding Tax: PPh Pasal 21 (Gaji/Imbalan), PPh 22, PPh 23 (Jasa/Sewa), PPh Final Pasal 4(2), dan PPh 25/29.
- **Kertas Kerja Equalisasi Pajak**:
  1. *Equalisasi Omzet Penjualan di Laba Rugi vs DPP PPN Keluaran pada SPT Masa*.
  2. *Equalisasi Beban Gaji/Upah di GL vs DPP PPh Pasal 21 pada SPT Masa*.
  3. *Equalisasi Beban Jasa Profesional di GL vs DPP PPh Pasal 23*.
  4. *Equalisasi Beban Sewa Gedung di GL vs DPP PPh Final Pasal 4 ayat 2*.
  5. Menampilkan kolom Nilai Akuntansi (GL), Nilai SPT, Selisih, Status Kepatuhan, dan Penjelasan Rekonsiliasi Auditor/Fiskus.

### 10. Perhitungan Pajak Kini & Aset Pajak Tangguhan (PSAK 46)
- Rekonsiliasi fiskal komersial ke fiskal:
  - Koreksi Fiskal Positif: Beban natura non-deductible, sumbangan non-fiskal, sanksi administrasi pajak, jamuan representasi tanpa nominatif, dan selisih penyusutan komersial > fiskal.
  - Koreksi Fiskal Negatif: Pendapatan bunga bank (PPh Final), dividen non-objek, dan selisih penyusutan komersial < fiskal.
- Perhitungan Penghasilan Kena Pajak (PKP) dan **Beban Pajak Kini (Current Tax)** dengan fasilitas Pasal 31E UU PPh (pengurangan tarif 50%).
- **Perhitungan Pajak Tangguhan (PSAK 46 / IAS 12)**:
  - Klasifikasi Beda Tetap (*Permanent Differences*) vs Beda Temporer (*Temporary Differences*).
  - Perhitungan **Aset Pajak Tangguhan (Deferred Tax Asset - DTA)** dan Liabilitas Pajak Tangguhan (DTL).
  - Jurnal penyesuaian PSAK 46 dan Rekonsiliasi Tarif Pajak Efektif (*Effective Tax Rate Reconciliation*) untuk kebutuhan auditor independen.

### 11. SPT Tahunan PPh Badan Formulir 1771 (Lampiran I s.d. VI)
- **Formulir 1771 Induk**: Identitas Wajib Pajak, Bagian A (Penghasilan Neto Fiskal), Bagian B (PKP), Bagian C (PPh Terutang), Bagian D (Kredit Pajak PPh 22, 23, 25), dan Bagian E (PPh Kurang/Lebih Bayar PPh 29/28A).
- **Lampiran I**: Perhitungan Penghasilan Neto Fiskal.
- **Lampiran II**: Perincian Harga Pokok Penjualan, Biaya Usaha Lainnya, dan Biaya Luar Usaha.
- **Lampiran III**: Kredit Pajak Dalam Negeri (Bukti Potong PPh 22 & PPh 23).
- **Lampiran IV**: Penghasilan yang Dikenakan PPh Final dan Bukan Objek Pajak.
- **Lampiran V**: Daftar Pemegang Saham / Pemilik Modal dan Susunan Pengurus / Komisaris.
- **Lampiran VI**: Daftar Penyertaan Modal pada Perusahaan Afiliasi & Pinjaman Pemegang Saham.

### 12. Seluruh Laporan Keuangan Standar PSAK & Auditor Pack
1. **Laporan Posisi Keuangan (Neraca / Balance Sheet)**: Aset Lancar, Aset Tidak Lancar, Kewajiban Jangka Pendek, Kewajiban Jangka Panjang, dan Ekuitas.
2. **Laporan Laba Rugi dan Penghasilan Komprehensif Lain**: Pendapatan, HPP, Laba Kotor, OPEX, EBIT, Pendapatan/Beban Lain, EBT, Beban Pajak, dan Laba Bersih.
3. **Laporan Arus Kas (Statement of Cash Flows)**: Metode Langsung dan Tidak Langsung (Aktivitas Operasi, Investasi, dan Pendanaan) dengan rekonsiliasi saldo kas akhir neraca.
4. **Laporan Perubahan Ekuitas (Statement of Changes in Equity)**: Modal Disetor, Agio Saham, Saldo Laba Ditahan, dan Laba Tahun Berjalan.
5. **Neraca Saldo (Trial Balance)**: Format 4 dan 6 kolom dengan cek keseimbangan Saldo Awal, Mutasi Periode, dan Saldo Akhir.
6. **Analisis Rasio Keuangan**:
   - Likuiditas: *Current Ratio*, *Quick Ratio*, *Cash Ratio*, *Net Working Capital*.
   - Solvabilitas: *Debt to Asset Ratio (DAR)*, *Debt to Equity Ratio (DER)*, *Interest Coverage Ratio*.
   - Profitabilitas: *Gross Profit Margin (GPM)*, *Operating Profit Margin (OPM)*, *Net Profit Margin (NPM)*, *Return on Assets (ROA)*, *Return on Equity (ROE)*.
   - Aktivitas: *Total Asset Turnover (TATO)*, *Days Sales Outstanding (DSO)*.
7. **Analisis EBITDA & Breakdown OPEX**: Perhitungan EBITDA operasional inti dan perincian persentase setiap beban operasional terhadap total OPEX dan pendapatan.
8. **Catatan Atas Laporan Keuangan (CALK) & Dokumen Auditor**: Ikhtisar profil entitas, kebijakan akuntansi akrual, jadwal kas & setara kas, umur piutang, aset tetap, dan lembar tanda tangan pengesahan (Dibuat, Diperiksa, Disetujui).

### 13. Ekspor Excel & Cetak PDF Profesional
- **Ekspor Excel (.xls / .xlsx)**: Menggunakan mesin *XML Spreadsheet SpreadsheetML* berstruktur lengkap dengan pewarnaan tajuk, format angka akuntansi ribuan (`#,##0`), garis tepi ganda total, dan tanpa dependensi eksternal.
- **Cetak PDF**: Desain cetak siap audit berbasis CSS `@media print` A4 rapi, menyembunyikan bilah navigasi dan memunculkan kop surat resmi perusahaan, nomor NPWP, tanggal cetak, dan blok tanda tangan direksi.

---

## 💻 Panduan Instalasi Windows & Menjalankan di Server LAN

### Pilihan 1: Windows Installer Otomatis Satu Klik (Direkomendasikan)
1. Buka folder `installer/`
2. Klik kanan pada berkas `Setup-Accounting-Enterprise.bat` dan pilih **Run as Administrator**.
3. Installer akan:
   - Memeriksa runtime Node.js.
   - Membuka port inbound Windows Firewall (Port 4000) untuk akses LAN.
   - Menginisialisasi basis data SQLite.
   - Membuat Shortcut Desktop "Coretax Enterprise Accounting".
   - Membuat Shortcut Start Menu Windows.
4. Buka aplikasi melalui ikon desktop atau browser di `http://localhost:4000`.

### Pilihan 2: Menjalankan Langsung via Command Line / Double Click
Cukup klik dua kali pada berkas `start-server.bat` di folder utama aplikasi:
```powershell
.\start-server.bat
```

### Mengakses dari Komputer Lain di Jaringan Kantor (LAN)
Setiap komputer staf, akuntan, atau pimpinan yang berada dalam satu jaringan Wi-Fi atau LAN kantor dapat membuka alamat server lokal (misalnya):
```
http://192.168.2.40:4000
```

---

## 🗄️ Struktur Proyek

```
F:\ACCOUNTING\
├── server\
│   ├── index.js               # Web server Express & LAN binding (0.0.0.0:4000)
│   ├── db.js                  # Engine database native node:sqlite dengan mode WAL
│   ├── seed.js                # Data awal PSAK, entitas contoh, akun standar, & jurnal
│   └── routes\
│       ├── entities.js        # Multi-entity CRUD & active switcher
│       ├── accounts.js        # Bagan akun & setup saldo awal balanced
│       ├── journals.js        # Jurnal umum & khusus dengan upload file bukti
│       ├── generalLedger.js   # Buku besar dengan saldo berjalan & preview lampiran
│       ├── inventory.js       # Persediaan, mutasi & kartu stok FIFO/Average
│       ├── receivablesPayables.js # Kontrol AR/AP, invoice, pelunasan, aging schedule
│       ├── fixedAssets.js     # Perincian aktiva tetap & penyusutan fiskal Gol 1-4
│       ├── taxes.js           # PPN, Withholding tax & kertas kerja equalisasi pajak
│       ├── fiscalPsak46.js    # Rekonsiliasi fiskal, pajak kini & PSAK 46 (DTA/DTL)
│       ├── spt1771.js         # SPT Tahunan PPh Badan 1771 Induk & Lampiran I-VI
│       ├── reports.js         # Neraca, Laba Rugi, Arus Kas, Ekuitas, TB, Rasio, CALK
│       └── backup.js          # Info LAN server & download backup database SQLite
├── public\                    # Antarmuka SPA bertema resmi DJP Coretax Indonesia
│   ├── index.html             # Shell aplikasi Coretax dengan top header & sidebar
│   ├── css\
│   │   └── coretax.css        # Tata letak resmi Coretax & styling cetak A4 auditor
│   └── js\
│       ├── app.js             # State manager, router, dan format mata uang IDR
│       ├── lib\
│       │   └── xlsx-export.js # Generator Excel SpreadsheetML & cetak laporan
│       └── modules\
│           ├── dashboard.js   # Dashboard eksekutif, EBITDA, OPEX, rasio utama
│           ├── coa.js         # Bagan akun & modal input saldo awal seimbang
│           ├── journals.js    # Entri jurnal multi-baris & unggah berkas bukti
│           ├── ledger.js      # Buku besar per akun & tautan dokumen fisik
│           ├── inventory.js   # Master stok & kartu stok mutasi
│           ├── ar_ap.js       # Kontrol hutang/piutang, pelunasan & umur piutang
│           ├── assets.js      # Aktiva tetap & selisih penyusutan fiskal
│           ├── taxes.js       # Pajak masa & tabel equalisasi omzet/biaya
│           ├── psak46.js      # Rekonsiliasi laba fiskal & pajak tangguhan
│           ├── spt1771.js     # SPT 1771 Induk & Lampiran I s.d. VI
│           ├── reports.js     # 7 Laporan keuangan & paket auditor independen
│           └── entity.js      # Multi entitas & informasi koneksi server LAN
├── uploads\                   # Repositori berkas fisik bukti transaksi (PDF/Gambar)
├── database\                  # Berkas penyimpanan mandiri accounting.sqlite
├── installer\
│   ├── Setup-Accounting-Enterprise.bat # Installer otomatis Windows satu klik
│   ├── Install-Windows-App.ps1         # Installer PowerShell
│   ├── InnoSetup-Script.iss            # Skrip kompilasi Inno Setup .exe
│   └── README-INSTALL.md               # Panduan teknis instalasi & firewall LAN
├── start-server.bat           # Peluncur cepat server lokal & LAN
├── AccountingEnterprise.vbs   # Peluncur tanpa jendela konsol hitam (silent)
└── package.json
```

---

## 📜 Lisensi & Pengesahan
Sistem ini dibuat untuk memenuhi seluruh kebutuhan akuntansi komersial dan kepatuhan perpajakan di Indonesia sesuai regulasi **Undang-Undang Harmonisasi Peraturan Perpajakan (UU HPP)**, regulasi **DJP Coretax**, dan **Standar Akuntansi Keuangan (PSAK)**.
