# AI Account Manager (PWA)

PWA untuk mengelola akun Google yang digunakan bersama, tautan layanan AI, status limit/reset per layanan, riwayat penggunaan, dan catatan serah-terima pekerjaan. Data utama disimpan secara lokal di browser menggunakan IndexedDB. Cadangan opsional dapat dikirim ke Google Sheets melalui Google Apps Script Web App.

> **Penting:** Aplikasi ini bukan password manager dan tidak melakukan login ke layanan AI. Jangan masukkan password, access token, API key layanan AI, recovery code, atau kredensial sensitif ke catatan akun maupun catatan handoff.

## Daftar Isi

- [Fitur](#fitur)
- [Stack Teknologi](#stack-teknologi)
- [Prasyarat](#prasyarat)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Perintah Proyek](#perintah-proyek)
- [Cara Kerja Aplikasi](#cara-kerja-aplikasi)
- [Penyimpanan dan Privasi](#penyimpanan-dan-privasi)
- [Backup dan Restore Google Sheets](#backup-dan-restore-google-sheets)
- [PWA dan Mode Offline](#pwa-dan-mode-offline)
- [Pengujian](#pengujian)
- [Struktur Proyek](#struktur-proyek)
- [Deployment](#deployment)
- [Batasan dan Catatan Keamanan](#batasan-dan-catatan-keamanan)
- [Dokumentasi Terkait](#dokumentasi-terkait)

## Fitur

- Mengelola maksimal **10 akun Google**.
- Menambahkan dan mengelola tautan layanan AI.
- Menghubungkan akun dengan layanan melalui entitas akses (`Access`).
- Mencatat status akses `ready` atau `limited`.
- Mendukung aturan reset:
  - tengah malam zona waktu Pasifik;
  - durasi tetap dalam jam;
  - waktu reset manual.
- Mencatat sesi penggunaan melalui aksi buka, Stop, dan Limit.
- Menghitung perubahan status ke Ready ketika aplikasi terbuka atau sedang aktif.
- Menyimpan catatan per akun, riwayat per akses, dan catatan handoff bersama per layanan.
- Mengekspor dan mengimpor data lokal dalam format JSON.
- Melakukan backup dan restore dua arah ke Google Sheets melalui Apps Script.
- Mendukung instalasi sebagai PWA dan strategi caching Service Worker.

## Stack Teknologi

| Area | Teknologi |
|---|---|
| UI | React 19, TypeScript |
| Build dan dev server | Vite 8 |
| Styling | Tailwind CSS 4 |
| Penyimpanan lokal | IndexedDB melalui `idb` v8 |
| PWA | Web App Manifest dan Service Worker |
| Backup cloud opsional | Google Sheets + Google Apps Script Web App |
| Pengujian | Vitest, `fake-indexeddb` |
| Ikon dan animasi | `lucide-react`, `motion` |

Aplikasi tidak menggunakan Firebase sebagai backend utama. Operasi inti aplikasi dirancang berjalan pada browser; integrasi Google Sheets hanya digunakan ketika pengguna menjalankan backup atau restore.

## Prasyarat

- Node.js yang kompatibel dengan versi Vite di `package.json`.
- npm.
- Browser modern dengan dukungan IndexedDB dan Service Worker.
- HTTPS untuk deployment PWA. Untuk pengembangan lokal, Vite menyediakan localhost.

Periksa versi:

```bash
node --version
npm --version
```

## Menjalankan Secara Lokal

1. Clone atau ekstrak repositori.
2. Dari direktori proyek, pasang dependency sesuai lockfile yang digunakan proyek:

```bash
npm install
```

Jika workflow proyek menetapkan lockfile npm, gunakan `npm ci` setelah `package-lock.json` tersedia. Repositori ini menyertakan `bun.lock`; gunakan package manager dan lockfile yang disepakati tim agar instalasi dapat direproduksi.

3. Jalankan development server:

```bash
npm run dev
```

4. Buka alamat yang ditampilkan Vite. Script dev proyek dikonfigurasi pada port `3000` dan host `0.0.0.0`.

Untuk menguji hasil build produksi secara lokal:

```bash
npm run build
npm run preview
```

## Perintah Proyek

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Vite development server pada port 3000 |
| `npm test` | Menjalankan test suite Vitest sekali |
| `npm run lint` | Menjalankan TypeScript compiler check (`tsc --noEmit`) |
| `npm run build` | Membuat build produksi ke `dist/` |
| `npm run preview` | Menyajikan build produksi untuk pemeriksaan lokal |
| `npm run clean` | Menghapus `dist/` dan `server.js` jika tersedia |

Contoh alur verifikasi sebelum rilis:

```bash
npm test
npm run lint
npm run build
```

Ketiga perintah harus selesai dengan exit code `0`. Untuk mengklaim kesiapan offline, tambahkan pengujian browser nyata setelah build: buka aplikasi saat online, pastikan aset ter-cache, matikan jaringan, lalu lakukan cold-start, refresh, navigasi, dan operasi data lokal.

## Cara Kerja Aplikasi

### Model data utama

- **Service** — definisi layanan, URL, konfigurasi `authuser`, dan aturan reset.
- **Person** — identitas pemilik akun Google, email, label, dan catatan. Password tidak disimpan.
- **Access** — hubungan antara akun dan layanan, termasuk metode login, status, serta waktu reset.
- **UsageLog** — riwayat aktivitas per akses.
- **HandoffNote** — catatan bersama per layanan yang ditulis atas nama pemilik akun aktif.
- **Settings** — zona waktu reset, batas jumlah akun, dan konfigurasi backup Sheet.

### Status dan sesi

- **Stop** mengakhiri sesi dan mencatat durasi; status akses tetap Ready.
- **Limit** mengubah akses menjadi Limited dan menyimpan waktu reset.
- Akses Limited dapat kembali Ready ketika waktu reset tercapai dan pemeriksaan status berjalan.
- Tidak ada notifikasi push atau proses reset latar belakang ketika browser/aplikasi tidak aktif.
- Login ke layanan dilakukan di browser, bukan di dalam aplikasi atau iframe.

### Batas akun

Secara default aplikasi membatasi jumlah akun menjadi 10. Jangan menganggap batas ini sebagai mekanisme otorisasi atau isolasi keamanan antar pengguna perangkat.

## Penyimpanan dan Privasi

- Data utama disimpan pada IndexedDB di profil browser yang digunakan.
- Data lokal dapat tetap ada setelah tab ditutup, tetapi dapat hilang jika data situs dihapus, profil browser dihapus, perangkat rusak, atau browser membersihkan storage.
- Perangkat/browser yang sama dapat digunakan beberapa orang. Aplikasi tidak menyediakan PIN, autentikasi aplikasi, atau isolasi data antar pengguna.
- Jangan menyimpan password, token, API key, recovery code, atau secret layanan AI pada `note`, `HandoffNote.text`, atau kolom teks lainnya.
- Konfigurasi endpoint dan secret backup Sheet merupakan kredensial integrasi yang berbeda dari kredensial layanan AI. Perlakukan secret ini sebagai data sensitif.
- Ekspor JSON tidak dimaksudkan untuk menyertakan `sheetEndpoint` dan `sheetSecret`. Periksa file hasil ekspor sebelum membagikannya.
- Backup ke Google Sheets mengirim data aplikasi yang dipilih untuk backup ke endpoint Apps Script yang dikonfigurasi. Pastikan spreadsheet, akses editor, deployment, dan endpoint berada di bawah kendali pihak tepercaya.
- HTTPS melindungi transportasi, tetapi tidak otomatis mengenkripsi data di IndexedDB atau membuat perangkat bersama aman.

## Backup dan Restore Google Sheets

Integrasi menggunakan Google Apps Script Web App; tidak memerlukan Firebase.

### Konsep alur

1. Deploy Apps Script sebagai Web App dan salin URL endpoint `/exec`.
2. Konfigurasikan endpoint dan secret backup pada pengaturan aplikasi.
3. Jalankan probe koneksi untuk memeriksa endpoint.
4. Gunakan fungsi backup untuk mengirim data lokal ke Sheet.
5. Sebelum restore, periksa data sumber dan pastikan backup lokal pra-restore tersedia.

### Keamanan konfigurasi

- Jangan commit secret produksi ke repositori.
- Jangan menaruh secret nyata di `.env.example`, dokumentasi, screenshot, issue, atau log.
- Gunakan Script Properties di Apps Script untuk menyimpan secret server-side; validasi bahwa nilainya bukan placeholder sebelum deployment.
- Batasi akses editor script dan spreadsheet, gunakan secret acak yang kuat, dan rotasi jika terpapar.
- Validasi endpoint yang dikonfigurasi. Jangan mengirim secret ke URL yang tidak dipercaya.
- Restore dapat mengganti data lokal. Pastikan konfirmasi, validasi payload, dan snapshot pra-restore berfungsi sebelum mengandalkan fitur ini untuk data penting.

> **Catatan rilis:** Sebelum menggunakan restore untuk data penting, pastikan kegagalan pembuatan snapshot membatalkan restore dan validasi runtime menolak record yang malformed. Jangan mengandalkan restore sebagai satu-satunya salinan data.

Instruksi deployment Apps Script dan struktur payload terperinci dapat dilengkapi dari `apps-script/Code.gs` serta `BLUEPRINT.md`.

## PWA dan Mode Offline

Service Worker dan manifest menyediakan fondasi instalasi PWA serta caching aset. Dukungan offline tetap bergantung pada semua aset yang dibutuhkan telah tersimpan di cache.

Checklist verifikasi offline:

- [ ] Build produksi berhasil.
- [ ] Aplikasi berhasil dibuka setidaknya sekali saat online.
- [ ] Semua file JS/CSS dan aset penting tersedia di cache.
- [ ] Aplikasi dapat cold-start setelah jaringan dimatikan.
- [ ] Refresh dan navigasi tetap bekerja saat offline.
- [ ] CRUD akun/layanan serta pembacaan data lokal bekerja saat offline.
- [ ] Fitur backup/restore Sheet menampilkan kegagalan jaringan secara jelas tanpa mengubah data lokal.
- [ ] Pembaruan versi Service Worker tidak menghilangkan akses ke data IndexedDB.

Backup dan restore Google Sheets memerlukan jaringan. Operasi lokal tidak boleh bergantung pada ketersediaan endpoint Sheet.

## Pengujian

Test berada di direktori `tests/`. Untuk menjalankan seluruh test:

```bash
npm test
```

Pemeriksaan tipe:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Area pengujian yang penting:

- Aturan reset dan transisi status akses.
- Pembuatan URL layanan dan parameter `authuser`.
- Constraint maksimal akun dan keunikan identitas.
- CRUD dan cascade delete.
- Sesi, log, dan handoff.
- Ekspor/impor JSON.
- Backup/restore Sheet dan kegagalan endpoint.
- Service Worker, manifest, dan perilaku offline.

### Edge case wajib sebelum rilis

- JSON valid secara sintaks tetapi berisi record atau relasi yang tidak valid.
- Restore Sheet ketika snapshot pra-restore gagal disimpan.
- Endpoint salah, timeout, respons HTTP error, dan respons JSON rusak.
- Dua pembuatan akun bersamaan ketika jumlah akun hampir mencapai batas.
- Akses handoff yang merujuk ke service berbeda.
- Cold-start offline, refresh offline, dan upgrade Service Worker.
- Secret sentinel tidak muncul pada JSON ekspor atau payload data backup.
- Benchmark 10 akun pada browser nyata dengan IndexedDB native.

## Struktur Proyek

```text
.
├── apps-script/       # Kode Google Apps Script untuk integrasi Sheet
├── public/            # Aset publik, manifest, dan Service Worker
├── src/
│   ├── domain/        # Aturan domain, reset, status, dan URL
│   ├── session/       # Siklus sesi penggunaan
│   ├── storage/       # IndexedDB, schema, dan operasi data
│   ├── backup/        # Ekspor/impor JSON dan integrasi Sheet
│   └── ...            # UI dan modul domain lainnya
├── tests/             # Unit test dan test PWA/backup
├── BLUEPRINT.md       # Spesifikasi teknis dan aturan bisnis
├── AI_WORKFLOW.md     # Konvensi dan guardrail workflow
├── SESSION_STATE.md   # Status task dan checkpoint kerja
├── TASKS.md           # Daftar task proyek
├── CHANGELOG.md       # Catatan perubahan
├── package.json       # Script dan dependency
└── vite.config.ts     # Konfigurasi Vite
```

Struktur aktual dapat berkembang; periksa direktori sumber untuk daftar modul terbaru.

## Deployment

1. Jalankan test, type-check, dan build; simpan log hasilnya.
2. Deploy isi direktori `dist/` ke hosting statis yang mendukung HTTPS.
3. Pastikan konfigurasi base path Vite sesuai lokasi aplikasi, terutama jika dipasang di subpath.
4. Pastikan `manifest` dan Service Worker dapat diakses pada URL yang benar.
5. Uji installability, update Service Worker, dan offline cold-start di browser target.
6. Konfigurasikan Apps Script dan spreadsheet secara terpisah; jangan menyertakan secret produksi dalam build frontend.
7. Verifikasi backup dan restore menggunakan data uji sebelum memproses data penting.

Jangan menganggap deployment selesai hanya karena halaman utama berhasil dimuat. PWA memerlukan pengujian instalasi, cache aset, pembaruan versi, dan offline.

## Batasan dan Catatan Keamanan

- Tidak ada login OAuth yang dikelola aplikasi; tautan layanan dibuka di browser.
- Tidak menyimpan password/token layanan AI secara sengaja, tetapi teks bebas yang diinput pengguna tetap dapat berisi rahasia jika pengguna memasukkannya.
- Tidak ada isolasi keamanan per pengguna atau PIN aplikasi.
- IndexedDB bukan vault terenkripsi.
- Backup Sheet bergantung pada konfigurasi endpoint dan kontrol akses Apps Script/Google Sheets.
- Service Worker tidak dapat membuat endpoint jaringan tersedia saat offline.
- Status produksi harus didasarkan pada hasil pengujian yang benar-benar dijalankan di environment rilis, bukan hanya pada keberadaan file test.

## Dokumentasi Terkait

- [`BLUEPRINT.md`](BLUEPRINT.md) — spesifikasi domain, aturan bisnis, arsitektur, dan NFR.
- [`AI_WORKFLOW.md`](AI_WORKFLOW.md) — konvensi teknis, guardrail, dan alur kerja.
- [`SESSION_STATE.md`](SESSION_STATE.md) — status task dan catatan checkpoint.
- [`TASKS.md`](TASKS.md) — daftar task.
- [`CHANGELOG.md`](CHANGELOG.md) — riwayat perubahan.
- [`TEST_AND_REVIEW_SUMMARY.md`](TEST_AND_REVIEW_SUMMARY.md) — laporan audit teknis dan rekomendasi remediasi, jika file laporan tersebut disimpan di root repositori.

---

**Status dokumentasi:** README ini menjelaskan penggunaan dan arsitektur yang dimaksudkan. Klaim kesiapan produksi harus dikonfirmasi dengan test suite, lint, build, secret scan, serta E2E offline yang berhasil pada environment rilis.
