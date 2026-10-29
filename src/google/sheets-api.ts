/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { exportLocalJsonData, importLocalJsonData, validateImportPayload } from '../backup/json-backup';
import { countEntities, PRE_RESTORE_STORAGE_KEY } from '../backup/sheet-backup';

export interface SheetFileSummary {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface DirectSheetSyncResult {
  success: boolean;
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetTitle?: string;
  counts?: any;
}

const TAB_HEADERS: Record<string, string[]> = {
  metadata: ['key', 'value'],
  services: ['id', 'name', 'urlTemplate', 'usesAuthuser', 'resetRuleMode', 'resetRuleHours', 'createdAt', 'updatedAt'],
  persons: ['id', 'ownerName', 'googleEmail', 'label', 'note', 'createdAt', 'updatedAt'],
  access: ['id', 'personId', 'serviceId', 'loginMethod', 'loginName', 'status', 'limitedAt', 'resetAt', 'activeSessionStart', 'createdAt', 'updatedAt'],
  logs: ['id', 'accessId', 'type', 'detail', 'at', 'durationSec'],
  handoff: ['id', 'serviceId', 'authorName', 'text', 'createdAt'],
};

/**
 * Buat Spreadsheet baru di Google Drive pengguna menggunakan Google Sheets API v4
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  title = 'AI Account Manager - Data Backup'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const sheets = Object.keys(TAB_HEADERS).map((name) => ({
    properties: { title: name },
  }));

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal membuat spreadsheet: status ${res.status}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Format header awal pada setiap tab
  const headerData = Object.entries(TAB_HEADERS).map(([tabName, headers]) => ({
    range: `${tabName}!A1:${String.fromCharCode(64 + headers.length)}1`,
    values: [headers],
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: headerData,
    }),
  });

  return { spreadsheetId, spreadsheetUrl, title: data.properties?.title || title };
}

/**
 * Cari berkas Spreadsheet yang sudah ada di Google Drive pengguna
 */
export async function findUserSpreadsheets(accessToken: string): Promise<SheetFileSummary[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=15&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Gagal mengambil daftar file: status ${res.status}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Pencadangan langsung ke Google Sheets API v4
 */
export async function backupDirectToGoogleSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<DirectSheetSyncResult> {
  const jsonStr = await exportLocalJsonData();
  const payload = JSON.parse(jsonStr);

  const metadataRows = [
    ['version', String(payload.version)],
    ['exportedAt', String(payload.exportedAt)],
    ['resetTimezone', String(payload.settings?.resetTimezone || 'America/Los_Angeles')],
    ['maxPersons', String(payload.settings?.maxPersons || 10)],
  ];

  const serviceRows = (payload.services || []).map((s: any) => [
    s.id,
    s.name,
    s.urlTemplate,
    String(s.usesAuthuser ?? false),
    s.resetRule?.mode || 'pacific_midnight',
    s.resetRule?.hours !== undefined ? String(s.resetRule.hours) : '',
    s.createdAt || '',
    s.updatedAt || '',
  ]);

  const personRows = (payload.persons || []).map((p: any) => [
    p.id,
    p.ownerName,
    p.googleEmail,
    p.label,
    p.note || '',
    p.createdAt || '',
    p.updatedAt || '',
  ]);

  const accessRows = (payload.access || []).map((a: any) => [
    a.id,
    a.personId,
    a.serviceId,
    a.loginMethod,
    a.loginName || '',
    a.status,
    a.limitedAt || '',
    a.resetAt || '',
    a.activeSessionStart || '',
    a.createdAt || '',
    a.updatedAt || '',
  ]);

  const logRows = (payload.logs || []).map((l: any) => [
    l.id,
    l.accessId,
    l.type,
    l.detail,
    l.at,
    l.durationSec !== undefined ? String(l.durationSec) : '',
  ]);

  const handoffRows = (payload.handoffNotes || []).map((h: any) => [
    h.id,
    h.serviceId,
    h.authorName,
    h.text,
    h.createdAt,
  ]);

  // Siapkan data per tab (header + baris data)
  const tabData = [
    { name: 'metadata', rows: [TAB_HEADERS.metadata, ...metadataRows] },
    { name: 'services', rows: [TAB_HEADERS.services, ...serviceRows] },
    { name: 'persons', rows: [TAB_HEADERS.persons, ...personRows] },
    { name: 'access', rows: [TAB_HEADERS.access, ...accessRows] },
    { name: 'logs', rows: [TAB_HEADERS.logs, ...logRows] },
    { name: 'handoff', rows: [TAB_HEADERS.handoff, ...handoffRows] },
  ];

  // Kosongkan range lama dan timpa
  const clearPromises = tabData.map((t) =>
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${t.name}!A:Z:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );
  await Promise.all(clearPromises);

  const valueUpdates = tabData.map((t) => ({
    range: `${t.name}!A1`,
    values: t.rows,
  }));

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: valueUpdates,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal mengunggah data ke sheet: status ${updateRes.status}`);
  }

  const counts = countEntities(payload);
  return {
    success: true,
    message: `Pencadangan berhasil! ${counts.total} entitas tersimpan ke Google Sheets.`,
    spreadsheetId,
    counts,
  };
}

/**
 * Pemulihan langsung dari Google Sheets API v4
 */
export async function restoreDirectFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  onConfirmOverwrite?: (counts: { remote: any; local: any }) => boolean | Promise<boolean>
): Promise<DirectSheetSyncResult> {
  // Ambil seluruh 6 tab secara batch
  const ranges = Object.keys(TAB_HEADERS).map((t) => `ranges=${t}!A:Z`).join('&');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gagal membaca spreadsheet: status ${res.status}`);
  }

  const data = await res.json();
  const valueRanges: Array<{ range: string; values?: any[][] }> = data.valueRanges || [];

  const getRowsForTab = (tabName: string): any[][] => {
    const vr = valueRanges.find((r) => r.range.startsWith(`'${tabName}'!`) || r.range.startsWith(`${tabName}!`));
    const raw = vr?.values || [];
    return raw.length > 1 ? raw.slice(1) : []; // Lewati baris header
  };

  const serviceRows = getRowsForTab('services');
  const personRows = getRowsForTab('persons');
  const accessRows = getRowsForTab('access');
  const logRows = getRowsForTab('logs');
  const handoffRows = getRowsForTab('handoff');

  const payload: any = {
    version: 1,
    exportedAt: new Date().toISOString(),
    services: serviceRows.map((r) => ({
      id: r[0],
      name: r[1],
      urlTemplate: r[2],
      usesAuthuser: r[3] === 'true' || r[3] === true,
      resetRule: {
        mode: r[4] || 'pacific_midnight',
        hours: r[5] ? Number(r[5]) : undefined,
      },
      createdAt: r[6] || new Date().toISOString(),
      updatedAt: r[7] || new Date().toISOString(),
    })),
    persons: personRows.map((r) => ({
      id: r[0],
      ownerName: r[1],
      googleEmail: r[2],
      label: r[3] || '',
      note: r[4] || '',
      createdAt: r[5] || new Date().toISOString(),
      updatedAt: r[6] || new Date().toISOString(),
    })),
    access: accessRows.map((r) => ({
      id: r[0],
      personId: r[1],
      serviceId: r[2],
      loginMethod: r[3] || 'google',
      loginName: r[4] || undefined,
      status: r[5] || 'ready',
      limitedAt: r[6] || undefined,
      resetAt: r[7] || undefined,
      activeSessionStart: r[8] || undefined,
      createdAt: r[9] || new Date().toISOString(),
      updatedAt: r[10] || new Date().toISOString(),
    })),
    logs: logRows.map((r) => ({
      id: r[0],
      accessId: r[1],
      type: r[2],
      detail: r[3] || '',
      at: r[4] || new Date().toISOString(),
      durationSec: r[5] !== undefined && r[5] !== '' ? Number(r[5]) : undefined,
    })),
    handoffNotes: handoffRows.map((r) => ({
      id: r[0],
      serviceId: r[1],
      authorName: r[2],
      text: r[3],
      createdAt: r[4] || new Date().toISOString(),
    })),
  };

  // Bungkus dalam LocalExportPayload v1 untuk validasi dan impor
  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: payload,
  };

  // Validasi integritas skema semantik
  try {
    validateImportPayload(exportPayload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Data di Google Sheet tidak valid: ${msg}`);
  }

  const remoteCounts = countEntities(payload);

  // Ambil data lokal saat ini untuk perbandingan & snapshot
  const localJsonStr = await exportLocalJsonData();
  const localData = JSON.parse(localJsonStr);
  const localCounts = countEntities(localData?.data || localData);

  // Proteksi sheet kosong terhadap lokal yang terisi
  if (remoteCounts.total === 0 && localCounts.total > 0) {
    throw new Error('Google Sheet yang dipilih kosong. Pemulihan dibatalkan demi keamanan data lokal.');
  }

  // Dialog konfirmasi pengguna
  if (onConfirmOverwrite) {
    const confirmed = await onConfirmOverwrite({ remote: remoteCounts, local: localCounts });
    if (!confirmed) {
      return { success: false, message: 'Pemulihan dibatalkan oleh pengguna.' };
    }
  }

  // Buat snapshot pengaman lokal
  try {
    localStorage.setItem(PRE_RESTORE_STORAGE_KEY, localJsonStr);
  } catch (e) {
    console.warn('Gagal menyimpan pre-restore snapshot ke localStorage:', e);
  }

  // Terapkan data ke IndexedDB
  await importLocalJsonData(JSON.stringify(exportPayload));

  return {
    success: true,
    message: `Pemulihan berhasil! ${remoteCounts.total} entitas dipulihkan dari Google Sheets ke IndexedDB.`,
    counts: remoteCounts,
  };
}
