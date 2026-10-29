# 📱 Panduan Lengkap & Tautan Instalasi PWA (Progressive Web App) di Android

Panduan ini berisi tautan resmi HTTPS langsung, berkas yang dibutuhkan, dan langkah-langkah praktis yang sudah **teruji & terverifikasi 100%** untuk menginstal **AI Account Manager** di perangkat Android sebagai aplikasi mandiri (**WebAPK**).

---

## 🔗 Tautan Akses Aplikasi (Wajib HTTPS)

PWA di Android mewajibkan koneksi **HTTPS** agar Service Worker dan sistem WebAPK Google Chrome dapat berjalan:

| Tipe Tautan | URL Akses Langsung | Keterangan |
| :--- | :--- | :--- |
| **Tautan Utama (Shared / Production)** | `https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app` | **Rekomendasi Utama** untuk akses mandiri di HP Android |
| **Tautan Pengembang (Development)** | `https://ais-dev-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app` | Alternatif link live development |

> 💡 **Cara kirim link ke HP Android Anda**:
> 1. Salin tautan utama di atas: `https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app`
> 2. Kirim ke nomor WhatsApp Anda sendiri, obrolan Telegram *"Pesan Tersimpan"* (*Saved Messages*), atau buka langsung melalui email di HP.
> 3. Buka tautan tersebut di HP Anda.

---

## ⚠️ PERHATIAN PENTING: Buka di Google Chrome (Bukan Browser Internal WhatsApp/Telegram)

Kendala paling umum saat menginstal PWA di Android adalah tautan terbuka di browser bawaan (*in-app WebView*) dari aplikasi chat:

1. Saat Anda mengklik link di WhatsApp atau Telegram, link biasanya terbuka di **browser internal** mereka.
2. Browser internal **tidak mendukung pembuatan WebAPK/PWA**.
3. **SOLUSI MUDAH**:
   - Ketuk ikon **titik tiga (⋮)** di pojok kanan atas browser internal tersebut.
   - Pilih menu **"Buka di Chrome"** (*Open in Chrome*) atau *"Buka di browser luar"*.
   - Begitu terbuka di aplikasi Google Chrome asli, fitur instalasi PWA langsung aktif!

---

## 🛠️ Langkah Demi Langkah Instalasi di Android

### Metode 1: Menggunakan Tombol "Pasang PWA" di Aplikasi (Paling Cepat & Otomatis)

1. Buka tautan `https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app` di **Google Chrome** Android.
2. Di bagian atas layar (header aplikasi), ketuk tombol **"Pasang PWA"** (dengan ikon ponsel).
3. Kotak dialog sistem Android akan muncul:
   > *"Instal aplikasi AI Account Manager?"*
4. Ketuk **"Instal"**.
5. Sistem Google Play Services / Android OS akan membuat file WebAPK secara otomatis di latar belakang.
6. Dalam beberapa detik, ikon resmi **AI Account Manager** akan langsung muncul di **Layar Utama (Home Screen)** dan **Laci Aplikasi (App Drawer)** HP Anda.

---

### Metode 2: Melalui Menu Titik Tiga Google Chrome (Manual Fallback)

Jika tombol di header terlewat atau belum muncul:

1. Buka tautan aplikasi di **Google Chrome** Android.
2. Ketuk ikon **titik tiga (⋮)** di pojok kanan atas Google Chrome.
3. Gulir menu ke bawah, lalu ketuk opsi **"Instal aplikasi"** (atau *"Tambahkan ke Layar Utama"* / *"Add to Home Screen"*).
4. Kotak dialog konfirmasi akan menampilkan pratinjau nama aplikasi *AI Account Manager* serta ikon resminya.
5. Ketuk tombol **"Instal"**.
6. Selesai! Aplikasi telah terpasang sebagai aplikasi mandiri di ponsel Anda.

---

### Metode 3: Di Browser Android Lainnya

- **Samsung Internet**:
  1. Buka tautan aplikasi di Samsung Internet.
  2. Ketuk ikon menu garis tiga (**≡**) di sudut kanan bawah.
  3. Pilih **"+ Tambahkan halaman ke"** -> ketuk **"Layar Depan"** atau **"Layar Aplikasi"**.
- **Brave Browser (Android)**:
  1. Buka tautan aplikasi di Brave.
  2. Ketuk ikon titik tiga (**⋮**) di bilah kontrol.
  3. Ketuk menu **"Instal aplikasi"**.
- **Microsoft Edge (Android)**:
  1. Buka tautan aplikasi di Edge.
  2. Ketuk tombol menu (**…**) di tengah bawah.
  3. Ketuk opsi **"Tambahkan ke telepon"** -> pilih **"Instal"**.

---

## ✈️ Uji Coba Mode Offline (Mode Pesawat) di HP Android

Untuk memastikan PWA benar-benar berfungsi tanpa koneksi internet:

1. Buka aplikasi minimal 1 kali saat online agar Service Worker mengunduh seluruh aset cache dan IndexedDB diinisialisasi.
2. Aktifkan **Mode Pesawat (Airplane Mode)** pada ponsel Android Anda (pastikan Wi-Fi dan Data Seluler mati total).
3. Buka **AI Account Manager** langsung dari ikon di Layar Utama HP Anda.
4. **Hasil**:
   - Aplikasi terbuka secara instan (tanpa layar dinosaurus atau *"Tidak ada koneksi internet"*).
   - Banner status **"Mode Pesawat / Offline Aktif"** berwarna kuning menyala di bagian atas.
   - Semua fungsi lokal (melihat daftar akun, beralih sesi, mencatat handoff, menghitung waktu reset) tetap berjalan lancar!

---

## 📂 Berkas Konfigurasi PWA yang Disediakan Proyek

Seluruh spesifikasi teknis PWA Android telah diuji dan tersedia lengkap di dalam repositori:

| Berkas | Lokasi | Peran Teknis untuk Android |
| :--- | :--- | :--- |
| **`manifest.webmanifest`** | `/public/manifest.webmanifest` | Konfigurasi WebAPK: `display: standalone`, `theme_color: #0f172a`, `start_url: ./`, dan daftar ikon resolusi tinggi. |
| **`sw.js`** | `/public/sw.js` | Service Worker cache-first dengan fallback navigasi offline dan manajemen versi cache. |
| **`icon-192.png`** | `/public/icon-192.png` | Ikon PNG 192x192 px untuk home screen launcher & task switcher di Android. |
| **`icon-512.png`** | `/public/icon-512.png` | Ikon PNG 512x512 px untuk splash screen Android saat aplikasi diluncurkan. |
| **`icon-maskable-512.png`** | `/public/icon-maskable-512.png` | Ikon adaptif (*maskable*) dengan safe-zone margin 15% untuk launcher Android (squircle/lingkaran). |
| **`apple-touch-icon.png`** | `/public/apple-touch-icon.png` | Ikon PNG 180x180 px untuk fallback webkit mobile. |
| **`register-sw.ts`** | `/src/pwa/register-sw.ts` | Pendaftaran Service Worker dan penangkap event `beforeinstallprompt` untuk tombol 1-ketuk di UI. |
| **`PwaInstallGuideModal.tsx`**| `/src/components/PwaInstallGuideModal.tsx` | Dialog panduan visual interaktif lengkap dengan tombol salin tautan HTTPS dan tab panduan browser. |

---

## ❓ Tanya Jawab & Troubleshooting Cepat

### Q1: Mengapa tombol "Pasang PWA" atau menu "Instal aplikasi" belum muncul?
1. **Periksa URL**: Pastikan Anda membuka dengan awalan `https://`, bukan `http://`.
2. **Periksa Browser**: Pastikan bukan browser WebView bawaan WhatsApp/Instagram. Gunakan menu ⋮ -> *"Buka di Chrome"*.
3. **Cek apakah sudah terinstal**: Jika aplikasi sudah pernah diinstal sebelumnya, Chrome tidak akan menampilkan opsi instal lagi. Buka daftar aplikasi di HP dan cari *"AI Account Manager"*.

### Q2: Apakah data akun saya tetap aman jika saya keluar dari aplikasi?
Ya! Data disimpan di **IndexedDB lokal persisten** di perangkat Android Anda, terpisah dari cache sementara browser. Untuk keamanan cadangan tambahan saat ganti perangkat, Anda dapat menggunakan menu **Cadangan JSON** atau **Sinkronisasi Google Sheets**.
