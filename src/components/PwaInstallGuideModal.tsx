/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Smartphone, 
  X, 
  CheckCircle2, 
  HelpCircle, 
  Zap, 
  WifiOff, 
  FileCode2, 
  ExternalLink,
  Copy,
  Check,
  Link2,
  QrCode,
  AlertCircle
} from 'lucide-react';

interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  canInstall: boolean;
  onInstall: () => Promise<void>;
  isOnline: boolean;
}

const PRIMARY_APP_URL = 'https://ais-pre-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app';
const DEV_APP_URL = 'https://ais-dev-67vxjndwqva5pmnr234qt6-557789186714.asia-southeast1.run.app';

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({
  isOpen,
  onClose,
  canInstall,
  onInstall,
  isOnline: _isOnline,
}) => {
  const [activeTab, setActiveTab] = useState<'chrome' | 'other' | 'offline' | 'files'>('chrome');
  const [isInstalling, setIsInstalling] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Determine current active URL (dynamic if HTTPS, else primary production fallback)
  const currentUrl = typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')
    ? window.location.origin
    : PRIMARY_APP_URL;

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyTutorialPath = () => {
    navigator.clipboard.writeText('TUTORIAL_INSTALL_PWA_ANDROID.md');
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 shadow-lg shadow-sky-600/10">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Panduan Instalasi PWA di Android</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  WebAPK Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Jadikan aplikasi mandiri di layar utama (home screen) & app drawer ponsel Android Anda.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Tautan Akses HTTPS di Android Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/50 border border-sky-700/60 space-y-3.5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-sky-300 font-bold text-xs sm:text-sm">
                <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Tautan Akses Aplikasi (Wajib HTTPS di Android)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition self-start sm:self-auto"
              >
                <QrCode className="w-3.5 h-3.5 text-sky-400" />
                <span>{showQr ? 'Tutup Kode QR' : 'Pindai Kode QR HP'}</span>
              </button>
            </div>

            {/* URL Display with Copy Button */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/90 border border-slate-800">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="bg-transparent text-xs font-mono text-sky-300 w-full focus:outline-none select-all px-1.5 truncate"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition shadow-sm"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Tersalin!' : 'Salin Tautan'}</span>
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
                title="Buka langsung tautan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Alternatif Development URL link */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>Alternatif Dev URL:</span>
              <span className="font-mono text-slate-300 select-all">{DEV_APP_URL}</span>
            </div>

            {/* QR Code Container if enabled */}
            {showQr && (
              <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center gap-4 animate-in fade-in">
                <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`}
                    alt="QR Code PWA URL"
                    className="w-32 h-32 block"
                    loading="lazy"
                  />
                </div>
                <div className="text-xs text-slate-300 space-y-1.5 text-center sm:text-left">
                  <span className="font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
                    <QrCode className="w-4 h-4 text-sky-400" />
                    Pindai dengan Kamera HP Android:
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Arahkan kamera ponsel Android Anda ke kode QR ini untuk langsung membuka aplikasi di Google Chrome tanpa perlu mengetik panjang secara manual.
                  </p>
                </div>
              </div>
            )}

            {/* Critical in-app browser notice */}
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200/90 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">PENTING jika tautan dikirim lewat WhatsApp / Telegram:</span>
                <p className="mt-0.5 leading-relaxed">
                  Jangan install dari browser bawaan aplikasi chat! Ketuk tombol titik tiga (<strong>⋮</strong>) di pojok kanan atas tampilan chat, lalu pilih <strong>"Buka di Chrome"</strong> (*Open in Chrome*) agar sistem Android dapat menerbitkan WebAPK resmi ke Home Screen.
                </p>
              </div>
            </div>
          </div>

          {/* Status Kesiapan PWA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Manifest</span>
              </div>
              <p className="text-[11px] text-slate-400">Standalone mode & background splash</p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Service Worker</span>
              </div>
              <p className="text-[11px] text-slate-400">sw.js cache-first & offline fallback</p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ikon Android</span>
              </div>
              <p className="text-[11px] text-slate-400">192px, 512px & Maskable adaptif</p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>IndexedDB</span>
              </div>
              <p className="text-[11px] text-slate-400">Simpan lokal tanpa butuh internet</p>
            </div>
          </div>

          {/* Quick Install Action Banner */}
          {canInstall ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/90 to-indigo-950/90 border border-sky-700/80 space-y-3 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Browser Mendukung Instalasi Otomatis (1-Tap)
                  </h4>
                  <p className="text-xs text-sky-200/90 mt-0.5">
                    Klik tombol di bawah untuk langsung memunculkan dialog resmi instalasi WebAPK Android.
                  </p>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>{isInstalling ? 'Memproses Instalasi...' : 'Pasang Sekarang ke Layar Utama Android'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Instalasi Manual Melalui Browser:</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Jika tombol otomatis belum aktif atau sudah pernah terpasang, Anda dapat menginstalnya kapan saja melalui menu browser seperti panduan di bawah.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Tabs Guide */}
          <div className="border-b border-slate-800 flex gap-2 overflow-x-auto pb-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('chrome')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'chrome'
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Google Chrome (Android)
            </button>
            <button
              onClick={() => setActiveTab('other')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'other'
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Samsung / Brave / Edge
            </button>
            <button
              onClick={() => setActiveTab('offline')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'offline'
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Uji Mode Pesawat (Offline)
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Daftar Berkas PWA
            </button>
          </div>

          {/* Tab Content 1: Google Chrome */}
          {activeTab === 'chrome' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center text-[10px]">1</span>
                  Buka Tautan HTTPS di Google Chrome Android
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Buka tautan <code className="text-sky-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono select-all">{currentUrl}</code> di browser <strong>Google Chrome</strong> di ponsel Android Anda.
                </p>
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/60 text-amber-300 text-[11px]">
                  ⚠️ <strong>Penting:</strong> Jangan membuka link dari browser internal WhatsApp atau Telegram. Jika terbuka di in-app browser, ketuk titik tiga di pojok kanan atas lalu pilih <em>"Buka di Chrome"</em>.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center text-[10px]">2</span>
                  Ketuk Menu Titik Tiga (⋮) di Pojok Kanan Atas Chrome
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Pada bilah atas browser Chrome, ketuk ikon menu tiga titik vertikal (<strong>⋮</strong>).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center text-[10px]">3</span>
                  Pilih "Instal aplikasi" atau "Tambahkan ke Layar Utama"
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Gulir ke bawah dan ketuk menu <strong>"Instal aplikasi"</strong> (atau <em>"Add to Home screen"</em>). Kotak dialog konfirmasi dengan nama <strong>AI Account Manager</strong> dan ikon resmi akan muncul.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center text-[10px]">4</span>
                  Konfirmasi & Selesai!
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Ketuk tombol <strong>"Instal"</strong>. Dalam 2-5 detik, Android akan menerbitkan WebAPK mandiri. Ikon aplikasi akan langsung tersemat di Layar Depan (Home Screen) serta App Drawer Anda.
                </p>
              </div>
            </div>
          )}

          {/* Tab Content 2: Other Browsers */}
          {activeTab === 'other' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Samsung Internet Browser</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Buka tautan aplikasi di browser Samsung Internet.</li>
                  <li>Ketuk ikon menu garis tiga (<strong>≡</strong>) di bilah bawah kanan.</li>
                  <li>Pilih menu <strong>"+ Tambahkan halaman ke"</strong>.</li>
                  <li>Pilih opsi <strong>"Layar Depan"</strong> atau <strong>"Layar Aplikasi"</strong>.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Brave Browser (Android)</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Buka tautan aplikasi di Brave Browser.</li>
                  <li>Ketuk menu titik tiga (<strong>⋮</strong>) di sudut bawah atau kanan atas.</li>
                  <li>Pilih menu <strong>"Instal aplikasi"</strong> lalu konfirmasi tombol <strong>"Instal"</strong>.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Microsoft Edge (Android)</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Buka tautan aplikasi di browser Microsoft Edge.</li>
                  <li>Ketuk tombol menu tiga titik (<strong>…</strong>) di bagian tengah bawah.</li>
                  <li>Pilih opsi <strong>"Tambahkan ke telepon"</strong> lalu ketuk <strong>"Instal"</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Tab Content 3: Offline Test */}
          {activeTab === 'offline' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-950 border border-amber-800/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <WifiOff className="w-4 h-4" />
                  <span>Cara Menguji Mode Pesawat / Offline di Android</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Aplikasi ini dirancang dengan prinsip <em>Offline-First</em> menggunakan Service Worker dan basis data lokal IndexedDB di ponsel Anda.
                </p>
              </div>

              <ol className="space-y-3">
                <li className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">1</span>
                  <div>
                    <span className="font-semibold text-white">Buka Aplikasi Minimal Sekali Saat Online</span>
                    <p className="text-slate-400 mt-0.5">
                      Service Worker akan mengunduh dan menyimpan semua berkas frontend, CSS, ikon, dan struktur IndexedDB ke dalam cache penyimpanan perangkat.
                    </p>
                  </div>
                </li>

                <li className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">2</span>
                  <div>
                    <span className="font-semibold text-white">Nyalakan Mode Pesawat (Airplane Mode)</span>
                    <p className="text-slate-400 mt-0.5">
                      Tarik bilah notifikasi Android ke bawah, aktifkan Mode Pesawat (matikan sambungan Wi-Fi dan data seluler).
                    </p>
                  </div>
                </li>

                <li className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">3</span>
                  <div>
                    <span className="font-semibold text-white">Buka AI Account Manager dari Layar Depan</span>
                    <p className="text-slate-400 mt-0.5">
                      Aplikasi akan terbuka secara instan tanpa layar hitam/putih kosong atau pesan error browser. Banner status kuning <span className="text-amber-400 font-medium">"Mode Pesawat / Offline Aktif"</span> akan tampil di bagian atas.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Tab Content 4: Technical Files */}
          {activeTab === 'files' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
                Berkas-berkas berikut telah disiapkan di repositori untuk memenuhi standar PWA modern & WebAPK Google Android:
              </div>

              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl bg-slate-950/40 overflow-hidden">
                <div className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-mono text-sky-400 font-semibold">public/manifest.webmanifest</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menentukan nama aplikasi, tema warna status bar Android (<code className="text-slate-300">#0f172a</code>), mode <code className="text-slate-300">standalone</code>, dan resolusi ikon.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">JSON</span>
                </div>

                <div className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-mono text-sky-400 font-semibold">public/sw.js</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Service Worker untuk precache shell statis dan fallback navigasi saat perangkat tanpa internet.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">JS Worker</span>
                </div>

                <div className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sky-400 font-semibold">public/icon-192.png & icon-512.png</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ikon resolusi tinggi berformat PNG standar yang diperlukan oleh Chrome untuk pembuatan WebAPK Android.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Wajib</span>
                </div>

                <div className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sky-400 font-semibold">public/icon-maskable-512.png</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ikon adaptif dengan safe-zone padding agar pas pada berbagai bentuk launcher icon di Android (lingkaran, squircle).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Maskable</span>
                </div>

                <div className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sky-400 font-semibold">src/pwa/register-sw.ts</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mendaftarkan service worker dan menangkap prompt event <code className="text-slate-300">beforeinstallprompt</code> untuk tombol UI.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">TypeScript</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-950/80 hover:bg-sky-900/80 text-sky-300 text-xs font-medium border border-sky-800/80 transition cursor-pointer"
              title="Salin tautan HTTPS aplikasi"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Tautan Disalin!' : 'Salin URL HTTPS'}</span>
            </button>
            <button
              onClick={handleCopyTutorialPath}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
              title="Salin nama file dokumentasi markdown"
            >
              {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDoc ? 'Nama Dokumen Disalin!' : 'TUTORIAL_INSTALL_PWA_ANDROID.md'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
