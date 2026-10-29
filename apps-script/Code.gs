/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Google Apps Script Web App untuk AI Account Manager (PWA)
 * Versi: 2.1 (Optimized, Self-Healing & Default Tables Generator)
 * 
 * Fitur & Optimasi:
 * 1. Skema kolom tetap (SCHEMAS) menjamin semua atribut (termasuk status limit, durasi, resetAt) terjaga.
 * 2. Generator Tabel Bawaan (init_tables): Otomatis membuat seluruh 6 tab (metadata, services, persons, access, logs, handoff).
 * 3. Seed Bawaan Otomatis: Menyediakan 5 layanan AI default (AI Studio, Claude, ChatGPT, Grok, Perplexity) & metadata awal.
 * 4. Dukungan Spreadsheet ID/URL Kustom: Pengguna dapat menautkan Spreadsheet Google yang sudah ada via ID atau URL.
 * 5. Proteksi Formula Injection: Format teks murni ('@') dan sanitasi karakter formula (=, +, -, @).
 * 6. Tampilan Spreadsheet Profesional: Header slate-800 (#1e293b), teks putih tebal, baris header dibekukan (freeze), auto-fit lebar kolom.
 * 7. Batch processing: Menggunakan setValues() & getDisplayValues() untuk performa maksimal.
 * 8. Diagnosis Lengkap: Aksi "ping" & "init_tables" memberikan informasi nama, URL, dan jumlah baris per tab.
 */

// Kunci rahasia default (Dapat diubah di sini atau di Script Properties: AUTH_SECRET_KEY)
var AUTH_SECRET_KEY = "GANTI_DENGAN_KUNCI_RAHASIA_ANDA";

var SCHEMAS = {
  metadata: ['key', 'value', 'updatedAt'],
  services: ['id', 'name', 'urlTemplate', 'usesAuthuser', 'resetRule', 'createdAt', 'updatedAt'],
  persons:  ['id', 'ownerName', 'googleEmail', 'label', 'note', 'createdAt', 'updatedAt'],
  access:   ['id', 'personId', 'serviceId', 'loginMethod', 'loginName', 'status', 'limitedAt', 'resetAt', 'activeSessionStart', 'createdAt', 'updatedAt'],
  logs:     ['id', 'accessId', 'type', 'at', 'durationSec', 'detail'],
  handoff:  ['id', 'serviceId', 'accessId', 'authorName', 'text', 'createdAt']
};

var JSON_COLS = {
  services: ['resetRule']
};

var TYPES = {
  services: { usesAuthuser: 'bool' },
  logs: { durationSec: 'num' }
};

/**
 * Endpoint GET: Pemeriksaan status dasar dari browser
 */
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    version: "2.1.0",
    message: "AI Account Manager Apps Script Web App aktif. Gunakan POST dengan format JSON text/plain untuk berinteraksi.",
    timestamp: new Date().toISOString()
  });
}

/**
 * Endpoint POST: Menangani ping, init_tables, backup, dan restore
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Bad Request: Body permintaan kosong." }, 400);
    }

    var requestData = {};
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ success: false, error: "Format JSON tidak valid: " + parseErr.message }, 400);
    }

    var providedSecret = (requestData.secret || "").trim();

    // 1. Verifikasi Kunci Rahasia
    var scriptProps = PropertiesService.getScriptProperties();
    var configuredSecret = (scriptProps.getProperty("AUTH_SECRET_KEY") || AUTH_SECRET_KEY).trim();

    if (!providedSecret || providedSecret !== configuredSecret) {
      return createJsonResponse({ 
        success: false, 
        error: "Akses Ditolak: Kunci rahasia salah atau tidak cocok dengan konfigurasi Web App." 
      }, 403);
    }

    var action = requestData.action || "ping";
    var ss = getOrCreateSpreadsheet(scriptProps, requestData);

    // 2. Aksi: Ping (Probe Latensi & Diagnostik Koneksi)
    if (action === "ping") {
      var sheetsInfo = [];
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        var sh = sheets[s];
        sheetsInfo.push({
          name: sh.getName(),
          rowCount: Math.max(0, sh.getLastRow() - 1)
        });
      }

      return createJsonResponse({
        success: true,
        message: "Pong! Koneksi Apps Script Web App berhasil terverifikasi.",
        timestamp: new Date().toISOString(),
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        tabs: sheetsInfo
      });
    }

    // 3. Aksi: Inisialisasi / Generate Tabel Bawaan Google Sheets (init_tables)
    if (action === "init_tables" || action === "generate_tables") {
      var tabsResult = initDefaultTables(ss);

      return createJsonResponse({
        success: true,
        message: "Tabel bawaan Google Sheets (metadata, services, persons, access, logs, handoff) berhasil dibuat dan diformat!",
        timestamp: new Date().toISOString(),
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        tabs: tabsResult
      });
    }

    // 4. Aksi: Backup (PWA -> Google Sheets)
    if (action === "backup") {
      var backupData = requestData.data || {};
      var nowIso = new Date().toISOString();

      // Siapkan baris metadata
      var metaRows = [
        { key: "appName", value: "AI Account Manager (PWA)", updatedAt: nowIso },
        { key: "appVersion", value: "2.1.0", updatedAt: nowIso },
        { key: "lastBackupAt", value: nowIso, updatedAt: nowIso },
        { key: "resetTimezone", value: (backupData.settings && backupData.settings.resetTimezone) || "America/Los_Angeles", updatedAt: nowIso },
        { key: "maxPersons", value: String((backupData.settings && backupData.settings.maxPersons) || 10), updatedAt: nowIso }
      ];

      var countServices = writeToSheet(ss, "services", backupData.services || []);
      var countPersons  = writeToSheet(ss, "persons", backupData.persons || []);
      var countAccess   = writeToSheet(ss, "access", backupData.access || []);
      var countLogs     = writeToSheet(ss, "logs", backupData.logs || []);
      var countHandoff  = writeToSheet(ss, "handoff", backupData.handoffNotes || []);
      writeToSheet(ss, "metadata", metaRows);

      // Bersihkan sheet bawaan kosong 'Sheet1' jika ada
      cleanupEmptyDefaultSheets(ss);

      return createJsonResponse({
        success: true,
        message: "Pencadangan berhasil! Seluruh data tersimpan di spreadsheet Google Sheets.",
        backupTimestamp: nowIso,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        counts: {
          services: countServices,
          persons: countPersons,
          access: countAccess,
          logs: countLogs,
          handoffNotes: countHandoff,
          total: countServices + countPersons + countAccess + countLogs + countHandoff
        }
      });
    }

    // 5. Aksi: Restore (Google Sheets -> PWA)
    if (action === "restore") {
      var restoredServices = readFromSheet(ss, "services");
      var restoredPersons  = readFromSheet(ss, "persons");
      var restoredAccess   = readFromSheet(ss, "access");
      var restoredLogs     = readFromSheet(ss, "logs");
      var restoredHandoff  = readFromSheet(ss, "handoff");
      var restoredMeta     = readFromSheet(ss, "metadata");

      // Parse metadata ke settings
      var settingsObj = {
        resetTimezone: "America/Los_Angeles",
        maxPersons: 10,
        updatedAt: new Date().toISOString()
      };

      for (var m = 0; m < restoredMeta.length; m++) {
        var row = restoredMeta[m];
        if (row.key === "resetTimezone" && row.value) {
          settingsObj.resetTimezone = row.value;
        } else if (row.key === "maxPersons" && row.value) {
          settingsObj.maxPersons = Number(row.value) || 10;
        }
      }

      var restored = {
        services: restoredServices,
        persons: restoredPersons,
        access: restoredAccess,
        logs: restoredLogs,
        handoffNotes: restoredHandoff,
        settings: settingsObj
      };

      return createJsonResponse({
        success: true,
        message: "Data berhasil dipulihkan dari Google Sheets.",
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        data: restored,
        counts: {
          services: restoredServices.length,
          persons: restoredPersons.length,
          access: restoredAccess.length,
          logs: restoredLogs.length,
          handoffNotes: restoredHandoff.length,
          total: restoredServices.length + restoredPersons.length + restoredAccess.length + restoredLogs.length + restoredHandoff.length
        }
      });
    }

    return createJsonResponse({ success: false, error: "Aksi tidak dikenal: " + action }, 400);

  } catch (err) {
    return createJsonResponse({ 
      success: false, 
      error: "Kesalahan server Apps Script: " + (err.message || err.toString()) 
    }, 500);
  }
}

/**
 * Mengambil Spreadsheet aktif atau membuka/membuat spreadsheet baru
 */
function getOrCreateSpreadsheet(scriptProps, requestData) {
  var ss = null;

  // Jika pengguna menentukan ID atau URL Spreadsheet eksplisit
  var customSpreadsheetInput = requestData && requestData.spreadsheetId ? String(requestData.spreadsheetId).trim() : "";
  if (customSpreadsheetInput) {
    var extractedId = customSpreadsheetInput;
    var urlMatch = customSpreadsheetInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      extractedId = urlMatch[1];
    }
    try {
      ss = SpreadsheetApp.openById(extractedId);
      scriptProps.setProperty("SPREADSHEET_ID", extractedId);
      return ss;
    } catch (e) {
      throw new Error("Gagal membuka Spreadsheet (" + extractedId + "): " + e.message + ". Pastikan ID/URL valid dan akun pembuat Apps Script memiliki izin akses.");
    }
  }

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }

  if (ss) return ss;

  var storedId = scriptProps.getProperty("SPREADSHEET_ID");
  if (storedId) {
    try {
      return SpreadsheetApp.openById(storedId);
    } catch (openErr) {
      // jika ID lama tidak dapat dibuka, buat baru
    }
  }

  var newSs = SpreadsheetApp.create("AI_Account_Manager_Backup");
  scriptProps.setProperty("SPREADSHEET_ID", newSs.getId());
  return newSs;
}

/**
 * Membuat tabel bawaan (schemas) di Google Sheets dan menyematkan styling profesional
 */
function initDefaultTables(ss) {
  var tabNames = ['metadata', 'services', 'persons', 'access', 'logs', 'handoff'];

  for (var i = 0; i < tabNames.length; i++) {
    var name = tabNames[i];
    var sheet = ss.getSheetByName(name);
    var isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(name);
      isNew = true;
    }

    var headers = SCHEMAS[name];
    var lastRow = sheet.getLastRow();

    if (lastRow === 0 || isNew) {
      sheet.clear();
      sheet.appendRow(headers);
      formatHeaderRow(sheet, headers.length);

      // Seed data awal jika tab metadata atau services masih kosong
      if (name === 'metadata') {
        var nowIso = new Date().toISOString();
        var defaultMeta = [
          { key: "appName", value: "AI Account Manager (PWA)", updatedAt: nowIso },
          { key: "appVersion", value: "2.1.0", updatedAt: nowIso },
          { key: "resetTimezone", value: "America/Los_Angeles", updatedAt: nowIso },
          { key: "maxPersons", value: "10", updatedAt: nowIso },
          { key: "initializedAt", value: nowIso, updatedAt: nowIso }
        ];
        writeToSheet(ss, 'metadata', defaultMeta);
      } else if (name === 'services') {
        var defaultServices = [
          {
            id: 'svc-ai-studio',
            name: 'Google AI Studio',
            urlTemplate: 'https://aistudio.google.com/',
            usesAuthuser: true,
            resetRule: { mode: 'pacific_midnight' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'svc-claude',
            name: 'Claude',
            urlTemplate: 'https://claude.ai/',
            usesAuthuser: false,
            resetRule: { mode: 'duration', hours: 5 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'svc-chatgpt',
            name: 'ChatGPT',
            urlTemplate: 'https://chatgpt.com/',
            usesAuthuser: false,
            resetRule: { mode: 'duration', hours: 3 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'svc-grok',
            name: 'Grok',
            urlTemplate: 'https://x.com/i/grok',
            usesAuthuser: false,
            resetRule: { mode: 'duration', hours: 2 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'svc-perplexity',
            name: 'Perplexity',
            urlTemplate: 'https://www.perplexity.ai/',
            usesAuthuser: false,
            resetRule: { mode: 'duration', hours: 4 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        writeToSheet(ss, 'services', defaultServices);
      }
    } else {
      formatHeaderRow(sheet, headers.length);
    }
  }

  cleanupEmptyDefaultSheets(ss);

  var resultTabs = [];
  var finalSheets = ss.getSheets();
  for (var f = 0; f < finalSheets.length; f++) {
    var cur = finalSheets[f];
    resultTabs.push({
      name: cur.getName(),
      rowCount: Math.max(0, cur.getLastRow() - 1)
    });
  }

  return resultTabs;
}

/**
 * Menghapus sheet kosong default bawaan Spreadsheet ('Sheet1' / 'Halaman 1')
 */
function cleanupEmptyDefaultSheets(ss) {
  var allSheets = ss.getSheets();
  if (allSheets.length > 1) {
    for (var k = 0; k < allSheets.length; k++) {
      var s = allSheets[k];
      var sName = s.getName().trim().toLowerCase();
      if ((sName === 'sheet1' || sName === 'sheet 1' || sName === 'halaman1' || sName === 'halaman 1') && s.getLastRow() <= 1) {
        try {
          ss.deleteSheet(s);
        } catch (delErr) {}
      }
    }
  }
}

/**
 * Menulis data ke tab sheet dengan optimasi batch, sanitasi formula, dan styling elegan
 */
function writeToSheet(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();

  var headers = SCHEMAS[sheetName] || (rows && rows.length > 0 ? Object.keys(rows[0]) : []);
  if (!headers || headers.length === 0) {
    sheet.appendRow(["_empty"]);
    return 0;
  }

  if (!rows || rows.length === 0) {
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length);
    return 0;
  }

  var dataMatrix = [headers];
  var jsonCols = JSON_COLS[sheetName] || [];

  for (var i = 0; i < rows.length; i++) {
    var rowObj = rows[i];
    var rowValues = [];
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      var val = rowObj[h];
      if (val === undefined || val === null) {
        rowValues.push("");
      } else if (jsonCols.indexOf(h) >= 0) {
        rowValues.push(JSON.stringify(val));
      } else {
        var strVal = String(val);
        // Sanitasi formula injection: jika karakter awal formula, beri tanda kutip tunggal
        if (/^[=+\-@]/.test(strVal)) {
          rowValues.push("'" + strVal);
        } else {
          rowValues.push(strVal);
        }
      }
    }
    dataMatrix.push(rowValues);
  }

  // Tulis dengan proteksi teks murni (@)
  var range = sheet.getRange(1, 1, dataMatrix.length, headers.length);
  range.setNumberFormat('@');
  range.setValues(dataMatrix);

  // Format visual header & kolom
  formatHeaderRow(sheet, headers.length);

  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (resizeErr) {
    // Abaikan jika autoResizeColumns melampaui batas batas waktu
  }

  return rows.length;
}

/**
 * Memformat baris judul (header) menjadi gelap modern, teks putih tebal, dan beku (freeze)
 */
function formatHeaderRow(sheet, colCount) {
  try {
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, colCount);
    headerRange.setBackground("#1e293b"); // slate-800
    headerRange.setFontColor("#f8fafc"); // slate-50
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Roboto");
  } catch (e) {
    // Abaikan kegagalan styling pada lingkungan terbatas
  }
}

/**
 * Membaca data dari tab sheet dengan deserialisasi tipe yang tepat
 */
function readFromSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var headers = SCHEMAS[sheetName];
  if (!headers) {
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }

  if (lastRow < 2) return [];

  var rawData = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  var result = [];
  var jsonCols = JSON_COLS[sheetName] || [];
  var typeMap = TYPES[sheetName] || {};

  for (var i = 0; i < rawData.length; i++) {
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var rawVal = rawData[i][j];
      if (rawVal === "" || rawVal === undefined) {
        continue;
      }

      // Hapus leading single quote jika disanitasi dari formula injection
      if (rawVal.charAt(0) === "'" && /^[=+\-@]/.test(rawVal.substring(1))) {
        rawVal = rawVal.substring(1);
      }

      if (jsonCols.indexOf(key) >= 0) {
        try {
          item[key] = JSON.parse(rawVal);
        } catch (e) {
          item[key] = rawVal;
        }
      } else if (typeMap[key] === 'bool') {
        item[key] = (rawVal.toLowerCase() === 'true');
      } else if (typeMap[key] === 'num') {
        item[key] = Number(rawVal);
      } else {
        item[key] = rawVal;
      }
    }
    result.push(item);
  }

  return result;
}

/**
 * Helper JSON response text/plain untuk CORS compatibility
 */
function createJsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
