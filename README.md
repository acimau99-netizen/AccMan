# AI Account Manager (PWA)

PWA untuk mengelola akun Google yang digunakan bersama, tautan layanan AI, status limit/reset per layanan, riwayat penggunaan, dan catatan serah-terima pekerjaan. Data utama disimpan secara lokal di browser menggunakan IndexedDB. Cadangan opsional dapat dikirim ke Google Sheets melalui Google Apps Script Web App tanpa basis data Firebase.

> **Penting:** Aplikasi ini bukan password manager dan tidak melakukan login otomatis ke layanan AI. Jangan masukkan password, access token, API key layanan AI, recovery code, atau kredensial sensitif ke catatan akun maupun catatan handoff.

## Daftar Isi

- [Fitur](#fitur)
- [Stack Teknologi](#stack-teknologi)
- [Prasyarat](#prasyarat)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Perintah Proyek](#perintah-proyek)
- [Cara Kerja Aplikasi](#cara-kerja-aplikasi)
- [Penyimpanan dan Privasi](#penyimpanan-dan-privasi)
- [Backup dan Restore Google Sheets (Tanpa Firebase)](#backup-dan-restore-google-sheets-tanpa-firebase)
- [PWA dan Mode Offline](#pwa-dan-mode-offline)
- [Pengujian](#pengujian)
- [Struktur Proyek](#struktur-proyek)
- [Deployment](#deployment)
- [Batasan dan Catatan Keamanan](#batasan-dan-catatan-keamanan)
- [Dokumentasi Terkait](#dokumentasi-terkait)

---

## Fitur

- **Maksimal 10 Akun Google**: Manajemen hingga 10 akun Google (BR-07, BR-14) dengan keunikan nama pemilik & email.
- **Manajemen Layanan AI**: Mengelola tautan layanan AI bawaan (Google AI Studio, Claude, ChatGPT, Grok, Perplexity) maupun kustom dengan pendukung URL encoder `authuser`.
- **Status Akses & Countdown Real-Time**: Status `ready` dan `limited` dengan hitung mundur detik waktu nyata serta transisi status otomatis (Auto-Ready) saat waktu reset terlampaui.
- **Aturan Waktu Reset Terstandarisasi**:
  - Tengah malam zona waktu Pasifik (*Pacific Midnight* `America/Los_Angeles` dengan penyesuaian DST otomatis).
  - Durasi tetap dalam jam (misal 2 jam, 3 jam, 5 jam).
  - Penyesuaian waktu reset manual (*edit resetAt*).
- **Sesi Pemakaian Terstruktur**: Aksi Buka Sesi (meluncurkan URL), Stop (mencatat durasi; status tetap Ready), dan Limit (mengubah status menjadi Limited).
- **Filter Cepat Status 'READY'**: Tombol toggle filter instan di tab Dashboard untuk hanya menampilkan akun yang siap digunakan, mempercepat pergantian giliran kerja tim.
- **Rekomendasi Pergantian Cepat (Fast Switch)**: Saran akun siap pakai berikutnya pada tiap kartu layanan dalam maksimal 2 ketukan.
- **Catatan & Audit Trail**:
  - Catatan bebas per akun Google.
  - Catatan lanjutan tim (*Handoff Note*) bersama per layanan yang langsung terlihat saat akun berpindah.
  - Audit trail kronologis terpadu mencatat seluruh kejadian secara persisten.
- **Cadangan JSON Lokal Mandiri**: Ekspor dan impor data lokal tanpa jaringan, dengan pengecualian mutlak kunci rahasia (BR-13) dan validasi integritas skema fail-closed.
- **Sinkronisasi Google Sheets Dua Arah (Tanpa Firebase)**:
  - Integrasi via Google Apps Script Web App (`Code.gs` v2.1).
  - **Generator Tabel Bawaan (1-Click Table Generator)**: Otomatis membuat dan memformat 6 tab spreadsheet (`metadata`, `services`, `persons`, `access`, `logs`, `handoff`).
  - Pembersihan otomatis sheet default kosong (`Sheet1`).
  - Proteksi *formula injection* (format teks murni `@`) dan styling gelap profesional.
  - Dukungan ID / URL Google Spreadsheet kustom pengguna.
  - Snapshot pengaman lokal otomatis sebelum operasi penimpaan data (*Pre-Restore Safety Snapshot*).
- **PWA & Offline First**: Terpasang di home screen perangkat (Android/Desktop), service worker caching aset, dan fungsionalitas penuh saat mode pesawat.

---

## Stack Teknologi

| Area | Teknologi |
|---|---|
| UI & Framework | React 19, TypeScript |
| Build & Dev Server | Vite 8 |
| Styling | Tailwind CSS 4 |
| Penyimpanan Lokal | IndexedDB melalui `idb` v8 |
| PWA & Offline | Web App Manifest & Service Worker |
| Backup Cloud Opsional | Google Sheets via Google Apps Script Web App (Tanpa Firebase) |
| Pengujian & Mocking | Vitest, `fake-indexeddb` |
| Ikon UI | `lucide-react`, `motion` |

Aplikasi **tidak menggunakan Firebase Firestore atau Auth** sebagai backend utama. Operasi inti berjalan 100% mandiri di browser; integrasi Google Sheets hanya dipanggil ketika pengguna menjalankan sinkronisasi cadangan atau pemulihan.

---

## Prasyarat

- Node.js (v18+ atau versi LTS yang direkomendasikan).
- npm (atau package manager yang disepakati tim).
- Browser modern dengan dukungan IndexedDB dan Service Worker (Chrome, Chromium, Edge, Safari, Firefox).
- HTTPS untuk deployment PWA (Vite menyediakan `localhost` untuk pengembangan lokal).

Periksa versi:

```bash
node --version
npm --version
```

---

## Menjalankan Secara Lokal

1. Clone atau ekstrak repositori:

```bash
git clone <repository-url>
cd <repository-directory>
```

2. Pasang seluruh dependensi:

```bash
npm install
```

3. Jalankan development server:

```bash
npm run dev
```

4. Buka alamat browser yang ditampilkan (default: `http://localhost:3000`).

Untuk menguji build produksi secara lokal:

```bash
npm run build
npm run preview
```

---

## Perintah Proyek

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Vite development server pada port 3000 |
| `npm test` | Menjalankan seluruh test suite Vitest (16 test file, 68+ tests) |
| `npm run lint` | Memeriksa tipe dan validasi TypeScript (`tsc --noEmit`) |
| `npm run build` | Melakukan build produksi ke direktori `dist/` |
| `npm run preview` | Menyajikan preview lokal dari hasil build `dist/` |

Alur verifikasi rilis:

```bash
npm test
npm run lint
npm run build
```

Seluruh perintah di atas harus selesai dengan exit code `0`.

---

## Cara Kerja Aplikasi

### Model Data Utama

- **Service**: Definisi layanan AI, URL template, konfigurasi parameter Google `authuser`, dan aturan reset.
- **Person**: Identitas akun Google (maks. 10), nama pemilik unik, email unik, label, dan catatan akun.
- **Access**: Hubungan akun dengan layanan, metode login (`google` atau `own`), status (`ready` / `limited`), waktu reset (`resetAt`), dan awal sesi aktif.
- **UsageLog**: Log aktivitas penggunaan per akses (`opened`, `stop`, `limit_hit`, `reset_ready`, `note`) dengan stempel waktu ISO 8601.
- **HandoffNote**: Catatan estafet bersama per layanan yang ditulis oleh pengguna aktif untuk anggota tim berikutnya.
- **Settings**: Pengaturan zona waktu reset, batas akun, endpoint Google Apps Script, kunci rahasia, dan ID Spreadsheet.

### Siklus Status Akses

| Dari | Ke | Aksi / Pemicu | Hasil / Catatan |
|---|---|---|---|
| `ready` | `ready` | Buka Sesi (Open) | Membuka tab browser dengan URL sesuai indeks akun Google |
| `ready` | `ready` | Selesai (Stop) | Mengakhiri sesi, durasi dihitung & dicatat, status tetap Ready |
| `ready` | `limited` | Capai Limit (Limit) | Menghitung dan menetapkan `resetAt`, status beralih ke Limited |
| `limited` | `limited` | Ubah Reset (Edit) | Mengoreksi target waktu `resetAt` manual baru |
| `limited` | `ready` | Waktu Tercapai (Auto-Ready) | Otomatis kembali Ready saat waktu `resetAt` terlampaui |

---

## Penyimpanan dan Privasi

- Seluruh data operasional disimpan di **IndexedDB lokal** profil browser Anda.
- **Tanpa Database Pihak Ketiga**: Tidak ada data yang dikirim ke server backend atau Firebase.
- **Pengecualian Rahasia Mutlak (BR-13)**: Endpoint dan kunci rahasia Google Apps Script tidak pernah disertakan dalam ekspor berkas JSON lokal.
- **Sanitasi Kredensial**: Jangan menyimpan kata sandi akun, token API, atau recovery code pada catatan bebas.
- **Fail-Closed Pre-Restore Snapshot (AC-1)**: Sebelum data lokal ditimpa saat proses pemulihan (restore), aplikasi secara otomatis membuat salinan pengaman di browser yang dapat diunduh kapan saja.

---

## Backup dan Restore Google Sheets (Tanpa Firebase)

Fitur ini memanfaatkan Google Apps Script Web App mandiri (`Code.gs` v2.1) yang terpasang langsung di Google Drive pribadi Anda.

### 6 Tabel Bawaan Spreadsheet

1. `metadata`: Konfigurasi aplikasi, zona waktu, batas akun, dan stempel sinkronisasi.
2. `services`: Daftar layanan AI, template URL, aturan reset waktu.
3. `persons`: Data pemilik akun Google (maks. 10 akun).
4. `access`: Hak akses akun ke layanan dan status limit.
5. `logs`: Riwayat pemakaian terperinci dengan durasi.
6. `handoff`: Catatan lanjutan antar anggota tim.

### Langkah Pemasangan Apps Script:

1. Buka [script.google.com](https://script.google.com) dan klik **+ Proyek baru**.
2. Hapus teks default, lalu tempel kode skrip dari berkas `apps-script/Code.gs` (atau salin dari tombol *Salin Code.gs* di aplikasi).
3. Ubah nilai `AUTH_SECRET_KEY` dengan kata sandi rahasia yang Anda tentukan sendiri.
4. Klik **Deploy > Deployment baru** (New deployment).
5. Klik ikon roda gigi di sebelah *Pilih jenis*, pilih **Aplikasi web** (Web app).
6. Atur konfigurasi:
   - **Jalankan sebagai (Execute as):** *Saya (Me)*
   - **Siapa yang memiliki akses (Who has access):** *Siapa saja (Anyone)* *(Wajib agar tidak error login HTML)*
7. Klik **Deploy**, lakukan otorisasi akun Google (*Review Permissions*), lalu salin URL yang berakhiran `/exec`.
8. Di AI Account Manager (Tab *Backup & Sheet*):
   - Masukkan **URL Endpoint**.
   - Masukkan **Kunci Rahasia** yang sama.
   - *(Opsional)* Masukkan ID atau URL Google Spreadsheet yang sudah ada, atau kosongkan untuk dibuatkan otomatis.
   - Klik **Simpan Pengaturan**.
   - Klik tombol **"Generate Tabel Bawaan Google Sheets"** untuk otomatis membuat seluruh 6 tab terformat di spreadsheet Anda.

---

## PWA dan Mode Offline

Aplikasi menerapkan standar Progressive Web App (PWA) lengkap yang dapat dipasang di Android, iOS, maupun Desktop:

- **Tautan Live HTTPS (Siap Pasang)**:
  - Produksi / Publik: `https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app`
  - Pengembangan / Dev: `https://ais-dev-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app`
- **Panduan Android Lengkap**: Lihat [`TUTORIAL_INSTALL_PWA_ANDROID.md`](TUTORIAL_INSTALL_PWA_ANDROID.md) untuk panduan instalasi WebAPK di Google Chrome, Samsung Internet, Brave, Edge, serta tips menghindari perangkap in-app browser (WhatsApp/Telegram).
- **Manifest Web (`public/manifest.webmanifest`)**: Mendukung mode `standalone`, splash screen tema gelap, dan ikon PNG resolusi tinggi (192px, 512px, serta maskable adaptif).
- **Service Worker (`public/sw.js`)**:
  - Pre-caching aset aplikasi statis dan runtime fallback navigasi SPA saat offline.
  - Bypass otomatis untuk request ke origin eksternal (Google Apps Script).
- **Offline Indikator**: Banner status jaringan otomatis mendeteksi saat perangkat online atau beralih ke mode pesawat/offline.

---

## Pengujian

Test suite lengkap mencakup 16 file pengujian dengan 70 skenario (100% lulus):

```bash
npm test
```

Cakupan pengujian:
- Logika aturan reset Pacific Midnight & durasi (`tests/reset-rule.test.ts`).
- Transisi status dan auto-ready checker (`tests/access-status.test.ts`).
- Penyimpanan IndexedDB lokal & migrasi skema (`tests/storage.test.ts`).
- Batasan maksimal 10 akun & keunikan email (`tests/person.test.ts`).
- Pembuatan URL authuser (`tests/url-builder.test.ts`).
- Sesi pemakaian buka, stop, limit (`tests/session.test.ts`).
- Catatan handoff bersama per layanan (`tests/handoff.test.ts`).
- Ekspor/impor JSON lokal & integritas relasional (`tests/backup-json.test.ts`).
- Probe Apps Script, normalisasi URL, & deteksi HTML error (`tests/sheet-probe.test.ts`).
- Backup/restore Google Sheets & Fail-Closed snapshot (`tests/backup-sheet.test.ts`).
- Service Worker, PWA offline lifecycle & aset WebAPK Android (`tests/pwa-offline.test.ts`).

---

## Struktur Proyek

```text
.
├── apps-script/
│   └── Code.gs                       # Skrip Google Apps Script v2.1 untuk Google Sheets
├── public/
│   ├── icon-192.png                  # Ikon PNG Android WebAPK 192x192
│   ├── icon-512.png                  # Ikon PNG Android Splash Screen 512x512
│   ├── icon-maskable-512.png         # Ikon Adaptif Android Maskable 512x512
│   ├── apple-touch-icon.png          # Ikon Webkit 180x180
│   ├── icon-192.svg / icon-512.svg   # Ikon Vektor SVG
│   ├── manifest.webmanifest          # Manifest Web PWA Standalone
│   └── sw.js                         # Service Worker offline caching & fallback
├── src/
│   ├── accounts/                     # Logika CRUD Person & Access
│   ├── backup/                       # JSON backup, Sheet backup, Apps Script code
│   ├── components/                   # Modal konfirmasi, guide PWA & recovery
│   ├── domain/                       # Logika aturan reset, status, builder URL
│   ├── handoff/                      # Catatan lanjutan bersama per layanan
│   ├── history/                      # Audit trail & riwayat log terpadu
│   ├── pwa/                          # PWA registration helper
│   ├── services/                     # Logika CRUD Service AI
│   ├── session/                      # Siklus buka sesi, stop, hit limit
│   ├── storage/                      # IndexedDB wrapper (idb) & type definition
│   ├── ui/                           # Helper dashboard, filter READY, switch suggestion
│   ├── App.tsx                       # Komponen utama UI aplikasi
│   ├── main.tsx                      # Titik masuk React
│   └── index.css                     # Konfigurasi Tailwind CSS 4
├── tests/                            # 16 berkas test Vitest (70 tes lulus)
├── TUTORIAL_INSTALL_PWA_ANDROID.md   # Panduan lengkap instalasi PWA Android WebAPK
├── BLUEPRINT.md                      # Spesifikasi teknis & aturan bisnis
├── AI_WORKFLOW.md                    # Konvensi workflow & guardrail
├── SESSION_STATE.md                  # Status sesi pengerjaan & task
├── TASKS.md                          # Daftar task backlog ZLCE & revisi
├── CHANGELOG.md                      # Riwayat pembaruan versi
├── package.json                      # Dependency & scripts
├── tsconfig.json                     # Konfigurasi TypeScript
└── vite.config.ts                    # Konfigurasi Vite & PWA manifest plugin
```

---

## Deployment

Aplikasi siap di-deploy ke hosting statis mana pun yang mendukung HTTPS:

1. Jalankan build produksi:
   ```bash
   npm run build
   ```
2. Unggah seluruh isi folder `dist/` ke platform pilihan Anda (mis. Cloud Run, Vercel, Netlify, GitHub Pages, Firebase Hosting, dsb).
3. Pastikan domain menggunakan protokol HTTPS agar Service Worker dan instalasi PWA dapat aktif.
4. Integrasi Google Sheets tetap berjalan independen melalui Apps Script tanpa perlu server backend tambahan.

---

## Batasan dan Catatan Keamanan

- **Bukan Password Manager**: Aplikasi ini tidak menyimpan password Google atau akun layanan AI. Pengguna tetap melakukan autentikasi di jendela peramban asli.
- **Kredensial Integrasi**: Kunci rahasia `AUTH_SECRET_KEY` adalah proteksi Web App Apps Script, bukan password akun Google. Simpan dan kelola secara privat.
- **Penyimpanan Lokal Profil Browser**: Jika riwayat/data penjelajahan browser dibersihkan secara manual oleh pengguna, data IndexedDB dapat terhapus. Lakukan ekspor JSON atau sinkronisasi Google Sheets secara berkala.

---

## Dokumentasi Terkait

- [`TUTORIAL_INSTALL_PWA_ANDROID.md`](TUTORIAL_INSTALL_PWA_ANDROID.md) — Panduan instalasi PWA di Android beserta tautan HTTPS & checklist pengujian.
- [`BLUEPRINT.md`](BLUEPRINT.md) — Spesifikasi teknis, aturan bisnis, dan NFR.
- [`AI_WORKFLOW.md`](AI_WORKFLOW.md) — Standar alur kerja, konvensi kode, dan guardrail.
- [`SESSION_STATE.md`](SESSION_STATE.md) — Status checkpoint dan catatan implementasi.
- [`TASKS.md`](TASKS.md) — Matriks 12 backlog task terperinci.
- [`CHANGELOG.md`](CHANGELOG.md) — Catatan rilis dan riwayat perubahan.
