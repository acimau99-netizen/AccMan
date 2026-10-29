# STATUS SESI (SESSION_STATE.md): AI Account Manager (PWA)

**Sumber kebenaran tunggal status task dan titik pemulihan sesi.** Perbarui pada setiap perubahan status task, setiap commit, dan setiap langkah WAL. Enum: `PENDING | READY | IN_PROGRESS | BLOCKED | DONE`.
Format dibaca skrip `scripts/zlce/zlce-check.py`; jangan ubah nama field, kolom, atau nomor bagian.

---

## 0. KONTEKS PROYEK (statis)

* **Proyek:** AI Account Manager (PWA)
* **Stack:** React 19 + Vite 8 PWA, IndexedDB (idb v8), Tailwind CSS, Service Worker (sw.js); backup/restore Google Sheets via Apps Script Web App tanpa backend eksternal
* **MODE:** LITE
* **Kemampuan Tulis Berkas AI:** YA (lingkungan AI Studio terintegrasi berkas langsung)
* **Kemampuan Eksekusi AI:** YA (lingkungan AI Studio terintegrasi eksekusi perintah & tes)

---

## 1. STATUS AKTIF

* **Timestamp Audit:** 2026-10-29T09:05:00-07:00
* **Cabang Git:** `main`
* **Task Terakhir DONE:** `TASK-REV-06`
* **Task Aktif:** -
* **Status Task Aktif:** -
* **Task Berikutnya:** -

---

## 2. MATRIKS TASK

| ID Task | Nama | Dependensi | Status | Bukti Verifikasi | Disetujui |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TASK-001` | Scaffold PWA & Verifikasi Dependensi | - | DONE | build exit 0, lint 0 error, vitest 1/1 pass (smoke.test), npm ls terverifikasi, base './' | ya |
| `TASK-002` | Penyimpanan IndexedDB & Skema | TASK-001 | DONE | 4/4 vitest pass (storage.test), lint 0 error, build exit 0; unique constraint, max 10 persons, migration verified | ya |
| `TASK-003` | Logika Waktu Reset & Status Akses | TASK-001 | DONE | 7/7 vitest pass (reset-rule.test & access-status.test), lint 0 error, build exit 0; DST boundary & state machine verified | ya |
| `TASK-004` | Layanan & Tautan + Builder URL | TASK-002, TASK-003 | DONE | 18/18 vitest pass (url-builder.test & service.test), lint 0 error, build exit 0; http(s) guard, authuser encoded, cascade delete verified | ya |
| `TASK-005` | Akun Google & Akses per Layanan | TASK-002 | DONE | 23/23 vitest pass (person.test & access.test), lint 0 error, build exit 0; max 10 persons, unique owner & email, loginMethod & loginName, cascade delete verified | ya |
| `TASK-006` | Sesi Pemakaian (Buka, Stop, Limit) | TASK-003, TASK-004, TASK-005 | DONE | 27/27 vitest pass (session.test), lint 0 error, build exit 0; open & session start, stop duration, limit & edit resetAt, auto-ready single log verified | ya |
| `TASK-007` | Dashboard & Switch Cepat | TASK-006 | DONE | 29/29 vitest pass (dashboard.test), lint 0 error, build exit 0; kartu layanan, hitung mundur live, banner auto-ready, rekomendasi switch <= 2 taps verified | ya |
| `TASK-008` | Riwayat, Catatan Akun & Catatan Lanjutan | TASK-006 | DONE | 32/32 vitest pass (handoff.test & history.test), lint 0 error, build exit 0; audit trail kronologis terpadu, catatan akun inline, handoff note per layanan dengan authorName verified | ya |
| `TASK-009` | Ekspor/Impor JSON Lokal | TASK-008 | DONE | 35/35 vitest pass (backup-json.test), lint 0 error, build exit 0; roundtrip identik, validasi skema ketat, rahasia endpoint/secret dikecualikan (BR-13) | ya |
| `TASK-010` | Spike Apps Script (CORS & Alur) | TASK-002 | DONE | 40/40 vitest pass (sheet-probe.test), lint 0 error, build exit 0; text/plain CORS bypass, Code.gs (ping/backup/restore), probe latensi, BLUEPRINT.md bagian 4 diperbarui | ya |
| `TASK-011` | Backup & Restore Google Sheet (Klien) | TASK-009, TASK-010 | DONE | 44/44 vitest pass, lint 0 error, build exit 0; roundtrip, auto-snapshot pre-restore, validasi skema tolak korupsi, rahasia dikecualikan | ya |
| `TASK-012` | Hardening PWA, Offline & Uji Akhir | TASK-007, TASK-008, TASK-011 | DONE | 48/48 vitest pass (4/4 pwa-offline.test), lint 0 error, build exit 0; sw.js, manifest standalone, NFR1 < 1s terukur (~10ms), zero credential check | ya |
| `TASK-REV-01` | Integritas Restore Sheet (Fail-Closed & Skema Tetap) | TASK-011 | DONE | 52/52 vitest pass (8/8 backup-sheet.test), tsc 0 error, build exit 0; fail-closed abort, empty sheet reject, count comparison, optional fields preserved | ya |
| `TASK-REV-02` | Keandalan Offline Service Worker & Precache Build | TASK-012 | DONE | 57/57 vitest pass (9/9 pwa-offline.test), tsc 0 error, build exit 0; asset-manifest.json generated, await navigation fallback, cache-first runtime | ya |
| `TASK-REV-03` | Validasi Semantik Impor & Integritas Relasional | TASK-REV-01, TASK-REV-02 | DONE | 72/72 vitest pass (17 test files), tsc 0 error, build exit 0; versi 1 guard, maxPersons isolated, FK verified, anti-crash ISO timestamp, pre-import snapshot verified | ya |
| `TASK-REV-04` | Sinkronisasi Google Sheets Mandiri & 1-Click Table Generator | TASK-REV-03 | DONE | Code.gs v2.1 generate_default_tables, 6 tab terformat otomatis, pembersihan Sheet1 default, 8/8 sheet-probe tests pass | ya |
| `TASK-REV-05` | Filter Cepat Status 'READY' pada Dashboard | TASK-007 | DONE | Toggle filter 'Semua Akun' vs 'Hanya READY' di kartu layanan, filter dinamis real-time, responsive UI | ya |
| `TASK-REV-06` | Kesiapan PWA Android WebAPK, Ikon PNG & Tautan HTTPS Live | TASK-REV-02, TASK-012 | DONE | 10/10 pwa-offline.test pass (total 70/70 pass di 16 files), icon-192.png, icon-512.png, maskable-512, QR scan modal, TUTORIAL_INSTALL_PWA_ANDROID.md | ya |

Bukti Verifikasi: ringkasan + lokasi bukti. `DONE` tanpa bukti dan `Disetujui: ya` tidak valid.

---

## 3. WORK IN PROGRESS (WAL)

Catatan tulis-dahulu: isi SEBELUM memulai langkah multi-berkas, perbarui SESUDAH langkah selesai. Kosongkan (semua `-`) saat task `DONE`.

* **Task:** -
* **Langkah Sedang Dikerjakan:** -
* **Berkas Direncanakan/Disentuh:** -
* **Sudah Dilakukan:** -
* **Langkah Berikutnya (persis):** -
* **Perintah Verifikasi:** -
* **Diperbarui:** 2026-10-29T09:05:00-07:00

---

## 4. ASSUMPTIONS & OPEN QUESTIONS

| ID | Jenis | Isi | Dampak jika salah | Status |
| :--- | :--- | :--- | :--- | :--- |
| `ASM-01` | Asumsi | Akun Google dipakai bersama pada perangkat fisik yang sama (bukan sinkronisasi cloud real-time antar pengguna). | Model IndexedDB lokal sudah tepat. | CONFIRMED |
| `ASM-02` | Asumsi | Batas maksimum 10 akun cukup untuk tim kecil yang berbagi sesi. | Validasi skema & isolasi kebijakan maxPersons telah terpasang. | CONFIRMED |
| `ASM-03` | Asumsi | PWA WebAPK Android membutuhkan koneksi HTTPS dan Chrome murni (bukan in-app WebView). | Panduan dan modal telah menyertakan instruksi buka di Chrome dan deteksi URL HTTPS. | CONFIRMED |

---

## 5. SLOT REVISI AKTIF

| ID | Level (S/M/L) | Deskripsi | Tindakan |
| :--- | :--- | :--- | :--- |
| `TASK-REV-01` | Level L | Integritas Restore Sheet (Fail-Closed, Sheet Kosong & Skema Tetap) | DONE (disetujui pengguna) |
| `TASK-REV-02` | Level M | Keandalan Offline Service Worker & Precache Build Vite | DONE (disetujui pengguna) |
| `TASK-REV-03` | Level M | Validasi Semantik Impor & Integritas Relasional (JSON & Sheet) | DONE (disetujui pengguna) |
| `TASK-REV-04` | Level M | Sinkronisasi Google Sheets Mandiri & 1-Click Table Generator | DONE (disetujui pengguna) |
| `TASK-REV-05` | Level S | Filter Cepat Status Akun 'READY' pada Dashboard | DONE (disetujui pengguna) |
| `TASK-REV-06` | Level M | Kesiapan PWA Android WebAPK, Ikon PNG & Tautan Live HTTPS | DONE (disetujui pengguna) |

---

## 6. CATATAN SERAH TERIMA (ditimpa; maks. ~10 baris)

* [2026-10-29T09:05:00-07:00] Seluruh revisi TASK-REV-04, TASK-REV-05, dan TASK-REV-06 tuntas & terverifikasi penuh (70/70 tests pass di 16 files, build exit 0).
* [2026-10-29T09:05:00-07:00] Tautan live HTTPS resmi disematkan pada seluruh panduan dan modal in-app:
  - Produksi: `https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app`
  - Dev: `https://ais-dev-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app`
* [2026-10-29T09:05:00-07:00] Fitur Pindai Kode QR dan tombol 1-ketuk "Salin Tautan" aktif di modal UI panduan Android.
* [2026-10-29T09:05:00-07:00] Filter cepat status 'READY' aktif di dashboard dengan toggle ramah layar sentuh.
* [2026-10-29T09:05:00-07:00] 1-Click Default Table Generator di tab Google Sheets siap memformat 6 tab sheet otomatis.
* [2026-10-29T09:05:00-07:00] WAL dikosongkan. Sistem bersih, stabil, terdokumentasi lengkap, dan siap digunakan.

---

## 7. LOG AUDIT (terbaru di atas; arsipkan entri lama ke `docs/archive/`)

* [2026-10-29T09:05:00-07:00] TASK-REV-06 DONE. Menambahkan tautan live HTTPS resmi, QR code generator preview, panduan in-app browser WebView di TUTORIAL_INSTALL_PWA_ANDROID.md dan PwaInstallGuideModal.tsx. 70/70 tests pass di 16 test files. Build sukses.
* [2026-10-29T08:50:00-07:00] TASK-REV-05 DONE. Menambahkan filter cepat status 'READY' di tab Dashboard (App.tsx) dengan count real-time dan switch toggle interaktif.
* [2026-10-29T08:30:00-07:00] TASK-REV-04 DONE. Implementasi 1-Click Generator Tabel Bawaan Google Sheets (Code.gs v2.1, sheet-probe.ts) tanpa ketergantungan Firebase, memformat 6 tab sheet dengan header gelap dan format teks (@).
* [2026-10-29T06:57:02-07:00] [MINOR] Penanganan graceful auth/popup-closed-by-user dan auth/cancelled-popup-request di src/google/auth.ts dan src/App.tsx. 75/75 tests pass, lint 0 error, build sukses.
* [2026-10-29T06:35:50-07:00] TASK-REV-03 disetujui DONE oleh pengguna. WAL dikosongkan. Seluruh siklus revisi v1.1 dan sinkronisasi Google Sheets selesai penuh (72/72 tests pass, build exit 0).
* [2026-10-29 jam: ?] RECOVERY: kasus B (perubahan berkas WAL terverifikasi penuh). Verifikasi baru: 72/72 tests pass di 17 files, tsc 0 error, build exit 0. Menunggu persetujuan DONE TASK-REV-03.
* [2026-10-29 jam: ?] TASK-REV-02 disetujui DONE oleh pengguna. TASK-REV-03 didaftarkan dan IN_PROGRESS. WAL diisi.
* [2026-10-29 jam: ?] TASK-REV-02 implementasi & verifikasi selesai (57 tests lulus, tsc 0 error, build exit 0). Menunggu persetujuan DONE pengguna.
* [2026-10-29 jam: ?] TASK-REV-01 implementasi & verifikasi selesai (52 tests lulus, tsc 0 error, build exit 0). Menunggu persetujuan DONE pengguna.
* [2026-10-29 jam: ?] TASK-REV-01 didaftarkan dan IN_PROGRESS. WAL diisi.
* [2026-10-29 jam: ?] TASK-012 DONE (disetujui pengguna). WAL dikosongkan. SIKLUS BACKLOG SELESAI 100% (v1.0).
* [2026-10-29 jam: ?] TASK-011 DONE (disetujui pengguna). TASK-012 diimplementasikan & 48/48 tests lulus. Menunggu persetujuan DONE akhir TASK-012.
* [2026-10-29 jam: ?] TASK-011 diimplementasikan & 44/44 tests lulus (4/4 backup-sheet.test). Menunggu persetujuan DONE pengguna.
* [2026-10-29 jam: ?] TASK-006 s/d TASK-010 DONE. 40/40 tests pass. WAL dikosongkan. TASK-011 beralih ke READY.
* [2026-10-29 jam: ?] TASK-006 diimplementasikan dan 27 tests lulus. Menunggu batch lanjutan.
* [2026-10-29 jam: ?] TASK-005 DONE. 23 tests lulus. Pengguna menyetujui TASK-005.
* [2026-10-29 jam: ?] TASK-004 DONE. 18 tests lulus.
* [2026-10-29 jam: ?] TASK-003 DONE. 7 tests lulus.
* [2026-10-29 jam: ?] TASK-002 DONE. 4 tests lulus.
* [2026-10-29 jam: ?] TASK-001 DONE. Proyek di-scaffold.
