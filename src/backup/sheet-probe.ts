/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LocalExportPayload } from './json-backup';

export interface ProbeResult {
  success: boolean;
  latencyMs: number;
  message: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  tabs?: Array<{ name: string; rowCount: number }>;
  rawError?: string;
}

export interface SheetBackupResult {
  success: boolean;
  message: string;
  backupTimestamp?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  counts?: {
    services: number;
    persons: number;
    access: number;
    logs: number;
    handoffNotes: number;
    total: number;
  };
}

export interface SheetRestoreResult {
  success: boolean;
  message: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  data?: LocalExportPayload['data'];
}

/**
 * Normalisasi dan validasi cerdas URL endpoint Google Apps Script
 */
export function normalizeEndpointUrl(endpoint: string): { valid: boolean; url: string; error?: string } {
  let clean = (endpoint || '').trim();
  if (!clean) {
    return { valid: false, url: '', error: 'URL Endpoint Apps Script belum diisi.' };
  }

  // Deteksi tautan script editor (kesalahan umum pengguna)
  if (clean.includes('script.google.com/home/projects/') || clean.endsWith('/edit')) {
    return {
      valid: false,
      url: clean,
      error: 'URL yang Anda masukkan adalah tautan editor skrip. Klik tombol "Deploy" > "Deployment baru" > pilih jenis "Aplikasi web" (Web app) > set "Siapa saja" (Anyone), lalu gunakan URL yang berakhiran /exec.',
    };
  }

  if (!clean.startsWith('https://script.google.com/macros/s/')) {
    return {
      valid: false,
      url: clean,
      error: 'Format URL salah. Harus diawali dengan https://script.google.com/macros/s/ dan berakhiran /exec.',
    };
  }

  // Hapus trailing slash jika ada
  clean = clean.replace(/\/+$/, '');

  // Jika belum berakhiran /exec atau /dev, otomatis tambahkan /exec
  if (!clean.endsWith('/exec') && !clean.endsWith('/dev')) {
    clean += '/exec';
  }

  return { valid: true, url: clean };
}

/**
 * Helper untuk membaca dan membedah respon server Apps Script secara aman
 */
async function parseAppsScriptResponse(response: Response): Promise<{
  success: boolean;
  json?: any;
  error?: string;
  rawText?: string;
}> {
  let text = '';
  if (typeof response.text === 'function') {
    try {
      text = await response.text();
    } catch (readErr) {
      // jika gagal baca text, coba json jika ada
    }
  }

  if (!text && typeof response.json === 'function') {
    try {
      const parsed = await response.json();
      return {
        success: Boolean(parsed.success),
        json: parsed,
        error: parsed.error,
        rawText: JSON.stringify(parsed),
      };
    } catch (jsonErr) {
      return {
        success: false,
        error: `Gagal membaca respon JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
      };
    }
  }

  const trimmed = text.trim();

  // Deteksi jika respon adalah HTML (login redirect / Google error page)
  if (
    trimmed.startsWith('<') ||
    trimmed.toLowerCase().includes('<!doctype') ||
    trimmed.toLowerCase().includes('<html')
  ) {
    return {
      success: false,
      rawText: trimmed,
      error:
        'Respon yang diterima dari Google adalah halaman web HTML (bukan JSON). Penyebab utama:\n1. Opsi "Siapa yang memiliki akses" (Who has access) belum diatur ke "Siapa saja" (Anyone) pada deployment Web App.\n2. Otorisasi izin akses akun Google belum disetujui (Review Permissions) saat deployment di script.google.com.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        rawText: trimmed,
        error: 'Format respon dari Apps Script bukan objek JSON yang valid.',
      };
    }
    return {
      success: Boolean(parsed.success),
      json: parsed,
      error: parsed.error,
      rawText: trimmed,
    };
  } catch (parseErr) {
    if (typeof response.json === 'function') {
      try {
        const parsed = await response.json();
        return {
          success: Boolean(parsed.success),
          json: parsed,
          error: parsed.error,
          rawText: JSON.stringify(parsed),
        };
      } catch {}
    }
    return {
      success: false,
      rawText: trimmed,
      error: `Respon bukan format JSON yang valid: ${trimmed.slice(0, 160)}...`,
    };
  }
}

/**
 * Membentuk payload ping untuk pengujian Apps Script
 */
export function buildPingPayload(secret: string, spreadsheetId?: string): string {
  const payload: Record<string, any> = {
    action: 'ping',
    secret: secret.trim(),
    clientTimestamp: new Date().toISOString(),
  };
  if (spreadsheetId && spreadsheetId.trim()) {
    payload.spreadsheetId = spreadsheetId.trim();
  }
  return JSON.stringify(payload);
}

/**
 * Membentuk payload inisialisasi tabel bawaan Google Sheets
 */
export function buildInitTablesPayload(secret: string, spreadsheetId?: string): string {
  const payload: Record<string, any> = {
    action: 'init_tables',
    secret: secret.trim(),
    clientTimestamp: new Date().toISOString(),
  };
  if (spreadsheetId && spreadsheetId.trim()) {
    payload.spreadsheetId = spreadsheetId.trim();
  }
  return JSON.stringify(payload);
}

/**
 * Membentuk payload backup untuk Apps Script
 */
export function buildBackupPayload(
  secret: string,
  data: LocalExportPayload['data'],
  spreadsheetId?: string
): string {
  const payload: Record<string, any> = {
    action: 'backup',
    secret: secret.trim(),
    data,
  };
  if (spreadsheetId && spreadsheetId.trim()) {
    payload.spreadsheetId = spreadsheetId.trim();
  }
  return JSON.stringify(payload);
}

/**
 * Membentuk payload restore untuk Apps Script
 */
export function buildRestorePayload(secret: string, spreadsheetId?: string): string {
  const payload: Record<string, any> = {
    action: 'restore',
    secret: secret.trim(),
  };
  if (spreadsheetId && spreadsheetId.trim()) {
    payload.spreadsheetId = spreadsheetId.trim();
  }
  return JSON.stringify(payload);
}

/**
 * Uji koneksi (probe) ke Google Apps Script Web App Endpoint.
 */
export async function probeAppsScript(
  endpoint: string,
  secret: string,
  spreadsheetId?: string
): Promise<ProbeResult> {
  const norm = normalizeEndpointUrl(endpoint);
  if (!norm.valid) {
    return {
      success: false,
      latencyMs: 0,
      message: norm.error || 'URL Endpoint salah.',
    };
  }

  const cleanSecret = (secret || '').trim();
  if (!cleanSecret) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Kunci rahasia (Secret Key) belum diisi.',
    };
  }

  const startTime = Date.now();
  try {
    const payload = buildPingPayload(cleanSecret, spreadsheetId);
    const response = await fetch(norm.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    const latencyMs = Date.now() - startTime;
    const result = await parseAppsScriptResponse(response);

    if (result.success && result.json) {
      return {
        success: true,
        latencyMs,
        message: result.json.message || 'Koneksi ke Apps Script & Spreadsheet berhasil!',
        spreadsheetName: result.json.spreadsheetName,
        spreadsheetUrl: result.json.spreadsheetUrl,
        spreadsheetId: result.json.spreadsheetId,
        tabs: result.json.tabs,
      };
    } else {
      return {
        success: false,
        latencyMs,
        message: result.error || 'Server menolak permintaan probe.',
        rawError: result.rawText,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latencyMs,
      message: `Gagal menghubungi endpoint: ${errorMsg}. Pastikan Web App di-deploy dengan akses "Anyone".`,
      rawError: errorMsg,
    };
  }
}

/**
 * Inisialisasi dan Generate Tabel Bawaan di Google Sheets
 */
export async function initSheetTables(
  endpoint: string,
  secret: string,
  spreadsheetId?: string
): Promise<ProbeResult> {
  const norm = normalizeEndpointUrl(endpoint);
  if (!norm.valid) {
    return {
      success: false,
      latencyMs: 0,
      message: norm.error || 'URL Endpoint salah.',
    };
  }

  const cleanSecret = (secret || '').trim();
  if (!cleanSecret) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Kunci rahasia (Secret Key) belum diisi.',
    };
  }

  const startTime = Date.now();
  try {
    const payload = buildInitTablesPayload(cleanSecret, spreadsheetId);
    const response = await fetch(norm.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    const latencyMs = Date.now() - startTime;
    const result = await parseAppsScriptResponse(response);

    if (result.success && result.json) {
      return {
        success: true,
        latencyMs,
        message: result.json.message || 'Tabel bawaan Google Sheets berhasil dibuat dan diinisialisasi!',
        spreadsheetName: result.json.spreadsheetName,
        spreadsheetUrl: result.json.spreadsheetUrl,
        spreadsheetId: result.json.spreadsheetId,
        tabs: result.json.tabs,
      };
    } else {
      return {
        success: false,
        latencyMs,
        message: result.error || 'Gagal menginisialisasi tabel bawaan Google Sheets.',
        rawError: result.rawText,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latencyMs,
      message: `Gagal menginisialisasi tabel: ${errorMsg}`,
      rawError: errorMsg,
    };
  }
}

/**
 * Mengirim data cadangan ke Google Sheets via Apps Script Web App
 */
export async function backupToSheet(
  endpoint: string,
  secret: string,
  data: LocalExportPayload['data'],
  spreadsheetId?: string
): Promise<SheetBackupResult> {
  const norm = normalizeEndpointUrl(endpoint);
  if (!norm.valid) {
    return {
      success: false,
      message: norm.error || 'URL Endpoint tidak valid.',
    };
  }

  const cleanSecret = (secret || '').trim();
  if (!cleanSecret) {
    return {
      success: false,
      message: 'Kunci rahasia (Secret Key) belum diisi.',
    };
  }

  try {
    const payload = buildBackupPayload(cleanSecret, data, spreadsheetId);
    const response = await fetch(norm.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    const result = await parseAppsScriptResponse(response);
    if (result.success && result.json) {
      return {
        success: true,
        message: result.json.message || 'Pencadangan ke Google Sheets berhasil!',
        backupTimestamp: result.json.backupTimestamp,
        spreadsheetName: result.json.spreadsheetName,
        spreadsheetUrl: result.json.spreadsheetUrl,
        spreadsheetId: result.json.spreadsheetId,
        counts: result.json.counts,
      };
    } else {
      return {
        success: false,
        message: result.error || 'Gagal mencadangkan data ke Google Sheets.',
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Mengambil data dari Google Sheets via Apps Script Web App
 */
export async function restoreFromSheet(
  endpoint: string,
  secret: string,
  spreadsheetId?: string
): Promise<SheetRestoreResult> {
  const norm = normalizeEndpointUrl(endpoint);
  if (!norm.valid) {
    return {
      success: false,
      message: norm.error || 'URL Endpoint tidak valid.',
    };
  }

  const cleanSecret = (secret || '').trim();
  if (!cleanSecret) {
    return {
      success: false,
      message: 'Kunci rahasia (Secret Key) belum diisi.',
    };
  }

  try {
    const payload = buildRestorePayload(cleanSecret, spreadsheetId);
    const response = await fetch(norm.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    const result = await parseAppsScriptResponse(response);
    if (result.success && result.json && result.json.data) {
      return {
        success: true,
        message: result.json.message || 'Data berhasil dipulihkan dari Google Sheets.',
        spreadsheetName: result.json.spreadsheetName,
        spreadsheetUrl: result.json.spreadsheetUrl,
        spreadsheetId: result.json.spreadsheetId,
        data: result.json.data,
      };
    }

    return {
      success: false,
      message: result.error || 'Format data pemulihan dari Google Sheets tidak valid.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
