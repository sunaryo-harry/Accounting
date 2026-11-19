# Panduan Instalasi & Konfigurasi Server LAN Windows
## Coretax Enterprise Accounting Multi Entitas
**Credit by Harry Sunaryo**

Aplikasi akuntansi ini dirancang untuk berjalan pada sistem operasi Windows dan dapat diakses oleh banyak pengguna secara bersamaan di jaringan lokal kantor (**LAN Server**).

---

### Kredensial Login Administrator Default
- **Username:** `Administrator`
- **Password:** `Harry1175`
- **Hak Akses:** Administrator Penuh (Dapat menambah staf dan menentukan batasan modul)

---

### Cara 1: Instalasi Otomatis Satu Klik (Direkomendasikan)
1. Buka folder `installer/`
2. Klik kanan pada berkas `Setup-Accounting-Enterprise.bat` dan pilih **Run as Administrator**.
3. Ikuti petunjuk di layar:
   - Installer akan memverifikasi ketersediaan Node.js.
   - Mengatur Windows Firewall untuk mengizinkan port `4000`.
   - Membuat Shortcut Desktop **Coretax Enterprise Accounting**.
   - Membuat Shortcut di Start Menu Windows.
4. Selesai! Aplikasi akan otomatis terbuka di browser Anda (`http://localhost:4000`).

---

### Cara 2: Menjalankan Langsung Tanpa Instalasi
1. Buka folder utama `F:\ACCOUNTING\`
2. Klik dua kali pada `start-server.bat`
3. Buka peramban (Google Chrome, Microsoft Edge, Mozilla Firefox) dan ketik alamat:
   ```
   http://localhost:4000
   ```

---

### Cara Mengakses dari Komputer Lain di Jaringan Kantor (LAN)
1. Pada komputer server (tempat aplikasi berjalan), lihat alamat IP lokal yang tampil di konsol atau di pojok kanan atas aplikasi (misalnya: `http://192.168.2.40:4000`).
2. Di komputer rekan kerja / staf lain yang terhubung ke Wi-Fi / kabel LAN yang sama, buka browser dan ketik alamat tersebut:
   ```
   http://192.168.2.40:4000
   ```
3. Staf dapat langsung menginput jurnal, melihat buku besar, mengontrol hutang/piutang, kartu stok, dan equalisasi pajak secara *real-time*.

---

### Fitur Cadangan Data (Backup & Restore)
- File database disimpan dalam format SQLite mandiri di: `database/accounting.sqlite`.
- Untuk mencadangkan data secara cepat, buka menu **Server LAN & Backup** di dalam aplikasi, lalu klik tombol **Download File Backup Database (.sqlite)**.
