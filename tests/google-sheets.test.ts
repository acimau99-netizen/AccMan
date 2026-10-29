/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WORKSPACE_SCOPES, getAccessToken, setAccessToken, googleSignOut } from '../src/google/auth';
import { createGoogleSpreadsheet, backupDirectToGoogleSheets, restoreDirectFromGoogleSheets } from '../src/google/sheets-api';
import 'fake-indexeddb/auto';
import { getDatabase } from '../src/storage/db';

describe('google-sheets.test', () => {
  beforeEach(async () => {
    setAccessToken(null);
    vi.restoreAllMocks();
    await getDatabase();
  });

  it('workspace_scopes_include_sheets_and_drive', () => {
    expect(WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets');
    expect(WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
  });

  it('in_memory_token_management', async () => {
    expect(await getAccessToken()).toBeNull();
    setAccessToken('mock-token-123');
    expect(await getAccessToken()).toBe('mock-token-123');
    setAccessToken(null);
    expect(await getAccessToken()).toBeNull();
  });

  it('createGoogleSpreadsheet_creates_formatted_sheets', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/spreadsheets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            spreadsheetId: 'sheet-xyz-123',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-xyz-123/edit',
            properties: { title: 'AI Account Manager - Cloud Backup' },
          }),
        });
      }
      if (url.includes('/values:batchUpdate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ totalUpdatedRows: 6 }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await createGoogleSpreadsheet('mock-token', 'AI Account Manager - Cloud Backup');
    expect(result.spreadsheetId).toBe('sheet-xyz-123');
    expect(result.spreadsheetUrl).toContain('sheet-xyz-123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backupDirectToGoogleSheets_roundtrip', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes(':clear')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes('/values:batchUpdate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ totalUpdatedCells: 20 }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await backupDirectToGoogleSheets('mock-token', 'sheet-123');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Pencadangan berhasil');
    expect(result.spreadsheetId).toBe('sheet-123');
  });
});
