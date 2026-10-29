/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPingPayload,
  buildBackupPayload,
  buildRestorePayload,
  probeAppsScript,
  initSheetTables,
  normalizeEndpointUrl,
  backupToSheet,
  restoreFromSheet,
} from '../src/backup/sheet-probe';

describe('TASK-010: Apps Script Probe & Sheet Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('buildPingPayload memuat action: ping dan secret yang rapi', () => {
    const payloadStr = buildPingPayload('  mySecretKey123  ');
    const parsed = JSON.parse(payloadStr);
    expect(parsed.action).toBe('ping');
    expect(parsed.secret).toBe('mySecretKey123');
    expect(parsed.clientTimestamp).toBeDefined();
  });

  it('buildBackupPayload memuat action: backup dan payload data', () => {
    const dummyData = {
      services: [],
      persons: [],
      access: [],
      logs: [],
      handoffNotes: [],
      settings: { id: 'default', resetTimezone: 'pacific_midnight', maxPersons: 10, updatedAt: '' },
    };
    const payloadStr = buildBackupPayload('key456', dummyData as any);
    const parsed = JSON.parse(payloadStr);
    expect(parsed.action).toBe('backup');
    expect(parsed.secret).toBe('key456');
    expect(parsed.data.settings.id).toBe('default');
  });

  it('probeAppsScript menolak endpoint kosong atau format tidak sesuai', async () => {
    const resEmpty = await probeAppsScript('', 'secret');
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.message).toContain('belum diisi');

    const resInvalid = await probeAppsScript('https://example.com/api', 'secret');
    expect(resInvalid.success).toBe(false);
    expect(resInvalid.message).toContain('https://script.google.com/macros/s/');

    const resNoSecret = await probeAppsScript(
      'https://script.google.com/macros/s/AKfycb.../exec',
      '   '
    );
    expect(resNoSecret.success).toBe(false);
    expect(resNoSecret.message).toContain('Kunci rahasia (Secret Key) belum diisi');
  });

  it('probeAppsScript sukses dengan respons pong dari Apps Script', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Pong! Koneksi Apps Script Web App berhasil terverifikasi.',
        spreadsheetName: 'AI_Account_Manager_Backup',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test123/edit',
      }),
    } as any);

    const res = await probeAppsScript(
      'https://script.google.com/macros/s/TEST_EXEC_ID/exec',
      'correct-secret'
    );

    expect(res.success).toBe(true);
    expect(res.spreadsheetName).toBe('AI_Account_Manager_Backup');
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/TEST_EXEC_ID/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      })
    );
  });

  it('probeAppsScript menangani error 403 (secret salah)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        error: 'Akses ditolak: Kunci rahasia salah atau tidak disediakan.',
      }),
    } as any);

    const res = await probeAppsScript(
      'https://script.google.com/macros/s/TEST_EXEC_ID/exec',
      'wrong-secret'
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('Akses ditolak');
  });

  it('normalizeEndpointUrl menangani URL tanpa /exec dan menolak editor script', () => {
    const resNoExec = normalizeEndpointUrl('https://script.google.com/macros/s/AKfycb123');
    expect(resNoExec.valid).toBe(true);
    expect(resNoExec.url).toBe('https://script.google.com/macros/s/AKfycb123/exec');

    const resEditor = normalizeEndpointUrl('https://script.google.com/home/projects/123/edit');
    expect(resEditor.valid).toBe(false);
    expect(resEditor.error).toContain('tautan editor');
  });

  it('initSheetTables memanggil action init_tables dan mengembalikan daftar tab', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Tabel bawaan Google Sheets berhasil dibuat!',
        spreadsheetName: 'AI_Account_Manager_Backup',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test123/edit',
        tabs: [
          { name: 'metadata', rowCount: 5 },
          { name: 'services', rowCount: 5 },
          { name: 'persons', rowCount: 0 },
          { name: 'access', rowCount: 0 },
          { name: 'logs', rowCount: 0 },
          { name: 'handoff', rowCount: 0 },
        ],
      }),
    } as any);

    const res = await initSheetTables(
      'https://script.google.com/macros/s/TEST_EXEC_ID/exec',
      'correct-secret'
    );

    expect(res.success).toBe(true);
    expect(res.tabs?.length).toBe(6);
    expect(res.spreadsheetUrl).toBe('https://docs.google.com/spreadsheets/d/test123/edit');
  });

  it('probeAppsScript mendeteksi halaman respon HTML login/error Google', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<!DOCTYPE html><html><head><title>Google Accounts</title></head><body>Login required</body></html>',
    } as any);

    const res = await probeAppsScript(
      'https://script.google.com/macros/s/TEST_EXEC_ID/exec',
      'secret-123'
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman web HTML');
    expect(res.message).toContain('Siapa saja');
  });
});
