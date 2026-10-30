/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  ChevronRight, 
  Database, 
  UserPlus, 
  Users, 
  AlertCircle, 
  Clock, 
  Timer, 
  Play, 
  Square, 
  AlertOctagon, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Globe2, 
  KeyRound, 
  Edit3,
  Activity,
  History,
  Download,
  Upload,
  FileJson,
  Radio,
  FileSpreadsheet,
  Zap,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Search,
  BookOpen,
  Wifi,
  WifiOff,
  Smartphone,
  Filter,
  LogOut,
  Cloud,
  FolderOpen
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from './google/auth';
import {
  createGoogleSpreadsheet,
  findUserSpreadsheets,
  backupDirectToGoogleSheets,
  restoreDirectFromGoogleSheets,
  type SheetFileSummary,
} from './google/sheets-api';
import { 
  getAllPersons, 
  getAllServices, 
  getAllAccess, 
  getSettings, 
  saveSettings,
  getLogsByAccessId,
  getAccessById
} from './storage/db';
import type { Person, Service, Access, ResetRuleMode, LoginMethod, UsageLog, HandoffNote, Settings } from './storage/types';
import { getRemainingCountdown } from './domain/access-status';
import { 
  seedInitialServices, 
  createServiceWithValidation, 
  deleteServiceWithCascade, 
  DEFAULT_AI_SERVICES 
} from './services/service-manager';
import { 
  createAccount, 
  deleteAccountWithCascade, 
  createAccountAccess, 
  deleteAccountAccess 
} from './accounts/account-manager';
import { 
  openSession, 
  stopSession, 
  hitLimitSession, 
  editLimitResetAt, 
  processAutoReadyCheck 
} from './session/session-manager';
import { 
  getReadyCountSinceLastOpen, 
  getNextReadyAccountSuggestion 
} from './ui/dashboard-helper';
import { 
  createHandoffNote, 
  getHandoffNotesForService, 
  getLatestHandoffNote 
} from './handoff/handoff-manager';
import { 
  getAllChronologicalLogs, 
  updateAccountNote, 
  type EnrichedHistoryLog 
} from './history/history-manager';
import { 
  exportLocalJsonData, 
  importLocalJsonData 
} from './backup/json-backup';
import { 
  probeAppsScript, 
  initSheetTables,
  normalizeEndpointUrl,
  backupToSheet, 
  restoreFromSheet, 
  type ProbeResult 
} from './backup/sheet-probe';
import {
  executeSheetBackup,
  executeSheetRestore,
  PRE_RESTORE_STORAGE_KEY,
} from './backup/sheet-backup';
import {
  promptPwaInstall,
  subscribeInstallPrompt,
} from './pwa/register-sw';
import { APPS_SCRIPT_CODE_GS } from './backup/apps-script-code';
import { ATTACHED_BACKUP_20261030 } from './storage/initial-backup';
import { PwaInstallGuideModal } from './components/PwaInstallGuideModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { Copy, Code, Check, CheckCheck, Share2, FileDown, Clock4, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { buildServiceUrl } from './domain/url-builder';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sessions' | 'history' | 'backup' | 'accounts' | 'services'>('dashboard');

  // State Interaktif & Fungsional (TASK-REV-11)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [sessionServiceFilter, setSessionServiceFilter] = useState<string>('ALL');
  const [dashboardFocusedService, setDashboardFocusedService] = useState<string | null>(null);

  // State Google Workspace Auth & Direct Google Sheets API
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [userSpreadsheets, setUserSpreadsheets] = useState<SheetFileSummary[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isCreatingDirectSheet, setIsCreatingDirectSheet] = useState(false);
  const [isDirectSyncing, setIsDirectSyncing] = useState(false);
  
  // State Data IndexedDB
  const [persons, setPersons] = useState<Person[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accessList, setAccessList] = useState<Access[]>([]);
  const [settings, setAppSettings] = useState<Settings>({
    id: 'default',
    resetTimezone: 'America/Los_Angeles',
    maxPersons: 10,
    sheetEndpoint: '',
    sheetSecret: '',
    updatedAt: '',
  });

  // State Banner Auto-Ready on Open (BR-06)
  const [autoReadyCount, setAutoReadyCount] = useState<number>(0);
  const [dismissAutoReadyBanner, setDismissAutoReadyBanner] = useState(false);

  // State Filter Cepat Dashboard Status READY
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'ALL' | 'READY'>('ALL');

  // State Sesi Pemakaian (TASK-006)
  const [selectedAccessId, setSelectedAccessId] = useState<string>('');
  const [sessionLogs, setSessionLogs] = useState<UsageLog[]>([]);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showEditResetModal, setShowEditResetModal] = useState(false);
  const [limitManualDate, setLimitManualDate] = useState('');
  const [editResetManualDate, setEditResetManualDate] = useState('');

  // State Riwayat & Catatan Lanjutan (TASK-008)
  const [allHistoryLogs, setAllHistoryLogs] = useState<EnrichedHistoryLog[]>([]);
  const [historyServiceFilter, setHistoryServiceFilter] = useState('ALL');
  const [handoffNotesMap, setHandoffNotesMap] = useState<Record<string, HandoffNote[]>>({});
  const [newHandoffText, setNewHandoffText] = useState('');
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [selectedPersonForNoteEdit, setSelectedPersonForNoteEdit] = useState<Person | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // State Backup & Restore (TASK-009 & TASK-010)
  const [sheetEndpointInput, setSheetEndpointInput] = useState('');
  const [sheetSecretInput, setSheetSecretInput] = useState('');
  const [sheetSpreadsheetIdInput, setSheetSpreadsheetIdInput] = useState('');
  const [isGeneratingTables, setIsGeneratingTables] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Google Apps Script Web App & Metode Sinkronisasi
  const [activeSyncMethod, setActiveSyncMethod] = useState<'apps-script' | 'google-direct'>('apps-script');
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Reusable confirmation modal state for Sheet restore
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details?: Array<{ label: string; value: string | number }>;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  // State Form Person (TASK-005)
  const [ownerName, setOwnerName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [label, setLabel] = useState('Akun Utama');
  const [note, setNote] = useState('');
  const [personError, setPersonError] = useState<string | null>(null);
  const [personSuccess, setPersonSuccess] = useState<string | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [selectedPersonForAccess, setSelectedPersonForAccess] = useState<Person | null>(null);

  // State Modal Tambah Akses ke Layanan (TASK-005)
  const [targetServiceId, setTargetServiceId] = useState('');
  const [targetLoginMethod, setTargetLoginMethod] = useState<LoginMethod>('google');
  const [targetLoginName, setTargetLoginName] = useState('');
  const [accessModalError, setAccessModalError] = useState<string | null>(null);

  // State Form Service (TASK-004)
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceUrl, setNewServiceUrl] = useState('');
  const [newServiceUsesAuthuser, setNewServiceUsesAuthuser] = useState(true);
  const [newServiceResetMode, setNewServiceResetMode] = useState<ResetRuleMode>('pacific_midnight');
  const [newServiceDurationHours, setNewServiceDurationHours] = useState(3);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceSuccess, setServiceSuccess] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  // Live countdown timer ticker (ticks every second)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // State PWA Offline & Install (TASK-012)
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [canInstallPwa, setCanInstallPwa] = useState<boolean>(false);
  const [pwaInstallSuccess, setPwaInstallSuccess] = useState<string | null>(null);
  const [showPwaGuideModal, setShowPwaGuideModal] = useState<boolean>(false);

  const loadAllData = async () => {
    try {
      // Auto-restore dataset cadangan terlampir jika persons masih kosong atau belum di-seed (TASK-REV-10)
      const hasSeeded = localStorage.getItem('ai_account_manager_seeded_backup') === '2026-10-30';
      const initialPersons = await getAllPersons();
      if (!hasSeeded || initialPersons.length === 0) {
        try {
          await importLocalJsonData(JSON.stringify(ATTACHED_BACKUP_20261030));
          localStorage.setItem('ai_account_manager_seeded_backup', '2026-10-30');
        } catch (seedErr) {
          console.warn('Gagal memulihkan dataset cadangan terlampir:', seedErr);
        }
      }

      const [allPersons, allServices, allAccess, dbSettings] = await Promise.all([
        getAllPersons(),
        getAllServices(),
        getAllAccess(),
        getSettings(),
      ]);
      setPersons(allPersons);
      setServices(allServices);
      setAccessList(allAccess);
      setAppSettings(dbSettings);
      setActiveSyncMethod(dbSettings.activeSyncMethod || 'apps-script');
      setSheetEndpointInput(dbSettings.sheetEndpoint || '');
      setSheetSecretInput(dbSettings.sheetSecret || '');
      setSheetSpreadsheetIdInput(dbSettings.googleSpreadsheetId || '');
      if (allAccess.length > 0 && (!selectedAccessId || !allAccess.find((a) => a.id === selectedAccessId))) {
        setSelectedAccessId(allAccess[0].id);
      }
      if (allServices.length > 0 && !targetServiceId) {
        setTargetServiceId(allServices[0].id);
      }

      // Check auto-ready on open (BR-06)
      const lastOpen = localStorage.getItem('zlce_last_open_time');
      const readyNotice = getReadyCountSinceLastOpen(allAccess, lastOpen, new Date());
      if (readyNotice.count > 0) {
        setAutoReadyCount(readyNotice.count);
      }
      localStorage.setItem('zlce_last_open_time', new Date().toISOString());

      // Load handoff notes for each service
      const noteMap: Record<string, HandoffNote[]> = {};
      for (const s of allServices) {
        noteMap[s.id] = await getHandoffNotesForService(s.id);
      }
      setHandoffNotesMap(noteMap);

      // Load chronological logs
      const enriched = await getAllChronologicalLogs();
      setAllHistoryLogs(enriched);

    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    loadAllData();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeInstall = subscribeInstallPrompt((prompt) => {
      setCanInstallPwa(Boolean(prompt));
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeInstall();
    };
  }, []);

  // Listen to Google Workspace OAuth auth state
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) {
          findUserSpreadsheets(token)
            .then((files) => setUserSpreadsheets(files))
            .catch(() => {});
        }
      },
      () => {
        setGoogleUser(null);
        setUserSpreadsheets([]);
      }
    );
    return () => {
      if (typeof unsubscribeAuth === 'function') unsubscribeAuth();
    };
  }, []);

  const handleInstallClick = async () => {
    const accepted = await promptPwaInstall();
    if (accepted) {
      setPwaInstallSuccess('Aplikasi AI Account Manager berhasil dipasang ke perangkat Anda!');
      setCanInstallPwa(false);
    }
  };

  // Update logs when selected access changes
  useEffect(() => {
    const fetchLogs = async () => {
      if (selectedAccessId) {
        try {
          const logs = await getLogsByAccessId(selectedAccessId);
          setSessionLogs(logs);
        } catch {
          setSessionLogs([]);
        }
      } else {
        setSessionLogs([]);
      }
    };
    fetchLogs();
  }, [selectedAccessId]);

  // Periodic Auto-Ready & 1-second clock tick
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = new Date();
      setCurrentTime(now);

      // Background Auto-Ready Checker without reloading entire state constantly
      try {
        const checkResult = await processAutoReadyCheck({ now });
        if (checkResult.transitionedCount > 0) {
          await loadAllData();
        }
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [accessList]);

  // Sesi Pemakaian Actions (TASK-006 & TASK-007 Fast Switch)
  const handleOpenSessionById = async (accessId: string) => {
    setSessionError(null);
    setSessionNotice(null);
    try {
      const res = await openSession(accessId, { openInBrowser: true, now: new Date() });
      setSelectedAccessId(accessId);
      setSessionNotice(`Sesi dibuka! Tautan diluncurkan: ${res.url}`);
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const handleStopSessionById = async (accessId: string) => {
    setSessionError(null);
    setSessionNotice(null);
    try {
      const res = await stopSession(accessId, { now: new Date() });
      const durationText = res.durationSec !== undefined ? `${res.durationSec} detik` : 'tanpa durasi';
      setSessionNotice(`Sesi dihentikan (Stop). Durasi: ${durationText}. Status tetap READY.`);
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const handleLimitSessionById = (accessId: string) => {
    setSelectedAccessId(accessId);
    setShowLimitModal(true);
  };

  const handleApplyLimit = async (useManual = false) => {
    if (!selectedAccessId) return;
    setSessionError(null);
    setSessionNotice(null);
    try {
      const manualDate = useManual && limitManualDate ? new Date(limitManualDate) : undefined;
      const res = await hitLimitSession(selectedAccessId, { manualResetAt: manualDate, now: new Date() });
      setSessionNotice(`Limit tercapai! Status menjadi LIMITED hingga ${new Date(res.resetAt).toLocaleString('id-ID')}.`);
      setShowLimitModal(false);
      setLimitManualDate('');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const handleEditResetAt = async () => {
    if (!selectedAccessId || !editResetManualDate) return;
    setSessionError(null);
    setSessionNotice(null);
    try {
      const targetDate = new Date(editResetManualDate);
      const res = await editLimitResetAt(selectedAccessId, targetDate, { now: new Date() });
      setSessionNotice(`Waktu resetAt dikoreksi menjadi ${new Date(res.access.resetAt || '').toLocaleString('id-ID')}.`);
      setShowEditResetModal(false);
      setEditResetManualDate('');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const handleEditResetById = (accessId: string) => {
    setSelectedAccessId(accessId);
    const target = accessList.find((a) => a.id === accessId);
    if (target?.resetAt) {
      const d = new Date(target.resetAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setEditResetManualDate(`${year}-${month}-${day}T${hours}:${mins}`);
    } else {
      setEditResetManualDate('');
    }
    setShowEditResetModal(true);
  };

  // Clipboard & Direct Functional Actions (TASK-REV-11)
  const copyToClipboard = async (text: string, key: string, labelSuccess?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (labelSuccess) setSessionNotice(labelSuccess);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiedKey(key);
        if (labelSuccess) setSessionNotice(labelSuccess);
        setTimeout(() => setCopiedKey(null), 2500);
      } catch (e) {
        console.warn('Copy failed:', e);
      }
    }
  };

  const handleCopyAccessUrl = (acc: Access) => {
    const s = services.find((srv) => srv.id === acc.serviceId);
    const p = persons.find((per) => per.id === acc.personId);
    if (!s) return;
    try {
      const url = buildServiceUrl(s.urlTemplate, s.usesAuthuser, p?.googleEmail);
      copyToClipboard(url, `url-${acc.id}`, `Tautan akses langsung "${p?.ownerName || 'User'}" (${s.name}) berhasil disalin ke papan klip!`);
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const handleDirectExternalOpen = (acc: Access) => {
    const s = services.find((srv) => srv.id === acc.serviceId);
    const p = persons.find((per) => per.id === acc.personId);
    if (!s) return;
    try {
      const url = buildServiceUrl(s.urlTemplate, s.usesAuthuser, p?.googleEmail);
      window.open(url, '_blank', 'noopener,noreferrer');
      setSessionNotice(`Membuka URL langsung: ${url} di jendela baru (tanpa mencatat sesi).`);
    } catch (err: unknown) {
      if (err instanceof Error) setSessionError(err.message);
    }
  };

  const applyPresetLimitDuration = (hoursOffset: number | 'pacific_midnight') => {
    const now = new Date();
    let target: Date;
    if (hoursOffset === 'pacific_midnight') {
      // Hitung tengah malam Pacific Time berikutnya
      const pacificDateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
      const pacificTomorrow = new Date(pacificDateStr);
      pacificTomorrow.setDate(pacificTomorrow.getDate() + 1);
      target = new Date(pacificTomorrow.getTime() + (7 * 3600 * 1000));
    } else {
      target = new Date(now.getTime() + hoursOffset * 3600 * 1000);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    setLimitManualDate(`${year}-${month}-${day}T${hours}:${mins}`);
  };

  const handleExportHistoryCsv = () => {
    if (allHistoryLogs.length === 0) {
      setSessionError('Belum ada data riwayat yang dapat diekspor.');
      return;
    }
    const headers = ['ID Log', 'Waktu (ISO)', 'Layanan', 'Pengguna', 'Email', 'Tipe Kejadian', 'Durasi (detik)', 'Detail Aktivitas'];
    const rows = allHistoryLogs.map((item) => [
      item.log.id,
      item.log.at,
      `"${(item.service?.name || '').replace(/"/g, '""')}"`,
      `"${(item.person?.ownerName || '').replace(/"/g, '""')}"`,
      `"${(item.person?.googleEmail || '').replace(/"/g, '""')}"`,
      item.log.type,
      item.log.durationSec !== undefined ? item.log.durationSec : '',
      `"${(item.log.detail || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-account-manager-riwayat-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSessionNotice(`Riwayat (${allHistoryLogs.length} kejadian) berhasil diekspor ke file CSV!`);
  };

  // Handoff Note & Account Note (TASK-008)
  const handleCreateHandoff = async (serviceId: string) => {
    if (!newHandoffText.trim()) return;
    setHandoffNotice(null);

    // Ambil akses aktif saat ini untuk service ini
    const activeAccess = accessList.find((a) => a.serviceId === serviceId && a.id === selectedAccessId) 
      || accessList.find((a) => a.serviceId === serviceId);

    if (!activeAccess) {
      setHandoffNotice('Tidak ada akun terhubung pada layanan ini untuk menulis catatan lanjutan.');
      return;
    }

    try {
      await createHandoffNote(serviceId, activeAccess.id, newHandoffText.trim(), { now: new Date() });
      setNewHandoffText('');
      setHandoffNotice('Catatan Lanjutan berhasil disimpan dan dibagikan!');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setHandoffNotice(err.message);
    }
  };

  const handleSavePersonNote = async () => {
    if (!selectedPersonForNoteEdit) return;
    try {
      await updateAccountNote(selectedPersonForNoteEdit.id, editingNoteText);
      setSelectedPersonForNoteEdit(null);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  // Backup & Restore Actions (TASK-009 & TASK-010)
  const handleExportJson = async () => {
    setBackupNotice(null);
    setBackupError(null);
    try {
      const jsonStr = await exportLocalJsonData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-account-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupNotice('Cadangan JSON lokal berhasil diunduh (rahasia endpoint/secret dikecualikan).');
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupNotice(null);
    setBackupError(null);

    const confirmed = window.confirm(
      'PERINGATAN: Memulihkan cadangan akan menimpa seluruh data akun, layanan, dan riwayat yang ada saat ini. Lanjutkan?'
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const result = await importLocalJsonData(content);
          setBackupNotice(`Pemulihan berhasil! ${result.importedCount} data entitas dipulihkan.`);
          await loadAllData();
        } catch (err: unknown) {
          if (err instanceof Error) setBackupError(err.message);
        }
      };
      reader.readAsText(file);
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestoreAttachedBackup = async () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Konfirmasi Pemulihan Dataset Cadangan Terlampir (30 Okt 2026)',
      description: 'Memulihkan dataset cadangan terlampir (ai-account-manager-backup-2026-10-30.json) akan menimpa data akun, layanan, hak akses, log, dan catatan lanjutan di IndexedDB lokal. Salinan pengaman lokal otomatis akan dibuat sebelum penimpaan (Fail-Closed).',
      details: [
        { label: 'Layanan AI', value: ATTACHED_BACKUP_20261030.data.services.length },
        { label: 'Akun Pengguna', value: ATTACHED_BACKUP_20261030.data.persons.length },
        { label: 'Akses Layanan', value: ATTACHED_BACKUP_20261030.data.access.length },
        { label: 'Log Riwayat', value: ATTACHED_BACKUP_20261030.data.logs.length },
        { label: 'Catatan Lanjutan', value: ATTACHED_BACKUP_20261030.data.handoffNotes.length },
        { label: 'Total Entitas', value: 86 },
      ],
      confirmLabel: 'Ya, Pulihkan Dataset Sekarang',
      confirmVariant: 'danger',
      action: async () => {
        try {
          const res = await importLocalJsonData(JSON.stringify(ATTACHED_BACKUP_20261030));
          localStorage.setItem('ai_account_manager_seeded_backup', '2026-10-30');
          await loadAllData();
          setBackupNotice(`Dataset cadangan terlampir berhasil dipulihkan! Total ${res.importedCount} entitas dimuat ke tabel.`);
        } catch (err: unknown) {
          if (err instanceof Error) setBackupError(err.message);
        } finally {
          setConfirmModalConfig(null);
        }
      },
    });
  };

  // Google Workspace Direct Auth & Sheets API Actions
  const handleGoogleSignInClick = async () => {
    setIsGoogleLoggingIn(true);
    setBackupNotice(null);
    setBackupError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setBackupNotice(`Berhasil masuk sebagai ${res.user.displayName || res.user.email}!`);
        setIsLoadingDriveFiles(true);
        try {
          const files = await findUserSpreadsheets(res.accessToken);
          setUserSpreadsheets(files);
        } catch (e) {
          console.warn('Gagal memuat berkas Drive:', e);
        } finally {
          setIsLoadingDriveFiles(false);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBackupError(`Gagal masuk dengan Google: ${err.message}`);
      }
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setUserSpreadsheets([]);
      setBackupNotice('Berhasil keluar dari akun Google Workspace.');
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    }
  };

  const handleSelectSyncMethod = async (method: 'apps-script' | 'google-direct') => {
    setActiveSyncMethod(method);
    try {
      const updated: Settings = {
        ...settings,
        activeSyncMethod: method,
        updatedAt: new Date().toISOString(),
      };
      await saveSettings(updated);
      setAppSettings(updated);
      setBackupNotice(
        method === 'apps-script'
          ? 'Metode aktif berhasil dialihkan ke: Google Apps Script Web App (Skrip Code.gs Pribadi).'
          : 'Metode aktif berhasil dialihkan ke: Google Workspace Direct Sheets API (OAuth Resmi).'
      );
    } catch (e) {
      console.warn('Gagal menyimpan preferensi metode sinkronisasi:', e);
    }
  };

  const handleCreateDirectSpreadsheetClick = async () => {
    const token = await getAccessToken();
    if (!token) {
      setBackupError('Sesi login Google tidak ditemukan. Silakan klik "Sign in with Google" terlebih dahulu.');
      return;
    }
    setIsCreatingDirectSheet(true);
    setBackupNotice(null);
    setBackupError(null);

    try {
      const created = await createGoogleSpreadsheet(token, 'AI Account Manager - Data Backup');
      const updated: Settings = {
        ...settings,
        googleSpreadsheetId: created.spreadsheetId,
        googleSpreadsheetUrl: created.spreadsheetUrl,
        googleSpreadsheetTitle: created.title,
        updatedAt: new Date().toISOString(),
      };
      await saveSettings(updated);
      setAppSettings(updated);
      setSheetSpreadsheetIdInput(created.spreadsheetId);

      // Otomatis cadangkan data saat ini ke sheet baru
      const backupResult = await backupDirectToGoogleSheets(token, created.spreadsheetId);
      setBackupNotice(`Spreadsheet "${created.title}" berhasil dibuat di Google Drive dan ${backupResult.counts?.total || 0} entitas dicadangkan!`);
      await loadAllData();

      // Refresh list
      const files = await findUserSpreadsheets(token);
      setUserSpreadsheets(files);
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsCreatingDirectSheet(false);
    }
  };

  const handleSelectDriveSpreadsheet = async (file: SheetFileSummary) => {
    try {
      const updated: Settings = {
        ...settings,
        googleSpreadsheetId: file.id,
        googleSpreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
        googleSpreadsheetTitle: file.name,
        updatedAt: new Date().toISOString(),
      };
      await saveSettings(updated);
      setAppSettings(updated);
      setSheetSpreadsheetIdInput(file.id);
      setBackupNotice(`Spreadsheet "${file.name}" berhasil dipilih dan ditautkan.`);
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    }
  };

  const handleDirectBackupClick = async () => {
    const token = await getAccessToken();
    if (!token) {
      setBackupError('Silakan masuk dengan akun Google terlebih dahulu.');
      return;
    }
    const targetSheetId = settings.googleSpreadsheetId || sheetSpreadsheetIdInput.trim();
    if (!targetSheetId) {
      setBackupError('Pilih atau buat spreadsheet terlebih dahulu.');
      return;
    }

    setIsDirectSyncing(true);
    setBackupNotice(null);
    setBackupError(null);

    try {
      const res = await backupDirectToGoogleSheets(token, targetSheetId);
      if (res.success) {
        setBackupNotice(res.message);
        const updated: Settings = {
          ...settings,
          lastGoogleSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveSettings(updated);
        setAppSettings(updated);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsDirectSyncing(false);
    }
  };

  const handleDirectRestoreClick = async () => {
    const token = await getAccessToken();
    if (!token) {
      setBackupError('Silakan masuk dengan akun Google terlebih dahulu.');
      return;
    }
    const targetSheetId = settings.googleSpreadsheetId || sheetSpreadsheetIdInput.trim();
    if (!targetSheetId) {
      setBackupError('Pilih atau buat spreadsheet terlebih dahulu.');
      return;
    }

    setBackupNotice(null);
    setBackupError(null);

    // Buka konfirmasi melalui modal
    setConfirmModalConfig({
      isOpen: true,
      title: 'Konfirmasi Pemulihan dari Google Sheets',
      description: 'Pemulihan data akan menimpa seluruh akun, layanan, dan riwayat yang ada di aplikasi ini dengan data dari Google Sheets. Salinan pengaman lokal otomatis akan dibuat sebelum penimpaan.',
      confirmLabel: 'Ya, Pulihkan Data Sekarang',
      confirmVariant: 'danger',
      action: async () => {
        setIsDirectSyncing(true);
        try {
          const res = await restoreDirectFromGoogleSheets(token, targetSheetId);
          if (res.success) {
            setBackupNotice(res.message);
            await loadAllData();
          }
        } catch (err: unknown) {
          if (err instanceof Error) setBackupError(err.message);
        } finally {
          setIsDirectSyncing(false);
          setConfirmModalConfig(null);
        }
      },
    });
  };

  const handleSaveSettings = async () => {
    try {
      const endpoint = sheetEndpointInput.trim();
      let normalizedEndpoint = endpoint;
      if (endpoint) {
        const norm = normalizeEndpointUrl(endpoint);
        if (norm.valid) {
          normalizedEndpoint = norm.url;
          setSheetEndpointInput(norm.url);
        }
      }

      const updated: Settings = {
        ...settings,
        sheetEndpoint: normalizedEndpoint,
        sheetSecret: sheetSecretInput.trim(),
        googleSpreadsheetId: sheetSpreadsheetIdInput.trim() || undefined,
        activeSyncMethod,
        updatedAt: new Date().toISOString(),
      };
      await saveSettings(updated);
      setAppSettings(updated);
      setBackupNotice('Konfigurasi Google Apps Script & Spreadsheet ID berhasil disimpan secara lokal di IndexedDB.');
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    }
  };

  const handleProbeAppsScript = async () => {
    if (!isOnline) {
      setBackupError('Perangkat sedang offline (mode pesawat). Pengujian koneksi ke Google Apps Script membutuhkan jaringan internet aktif.');
      return;
    }
    setProbeResult(null);
    setBackupNotice(null);
    setBackupError(null);
    setIsProbing(true);

    try {
      const res = await probeAppsScript(
        sheetEndpointInput,
        sheetSecretInput,
        sheetSpreadsheetIdInput.trim() || undefined
      );
      setProbeResult(res);
      if (res.success) {
        setBackupNotice(`Probe Berhasil (${res.latencyMs}ms): ${res.message}`);
        if (res.spreadsheetUrl || res.spreadsheetName) {
          const updated: Settings = {
            ...settings,
            sheetEndpoint: sheetEndpointInput.trim(),
            sheetSecret: sheetSecretInput.trim(),
            googleSpreadsheetId: res.spreadsheetId || settings.googleSpreadsheetId,
            googleSpreadsheetUrl: res.spreadsheetUrl || settings.googleSpreadsheetUrl,
            googleSpreadsheetTitle: res.spreadsheetName || settings.googleSpreadsheetTitle,
            updatedAt: new Date().toISOString(),
          };
          await saveSettings(updated);
          setAppSettings(updated);
        }
      } else {
        setBackupError(`Probe Gagal (${res.latencyMs}ms): ${res.message}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsProbing(false);
    }
  };

  const handleInitSheetTables = async () => {
    if (!sheetEndpointInput || !sheetSecretInput) {
      setBackupError('Isi Endpoint URL dan Kunci Rahasia terlebih dahulu.');
      return;
    }
    setIsGeneratingTables(true);
    setBackupNotice(null);
    setBackupError(null);

    try {
      const res = await initSheetTables(
        sheetEndpointInput,
        sheetSecretInput,
        sheetSpreadsheetIdInput.trim() || undefined
      );
      setProbeResult(res);
      if (res.success) {
        const tabListStr = res.tabs?.map((t) => `${t.name} (${t.rowCount} baris)`).join(', ') || 'metadata, services, persons, access, logs, handoff';
        setBackupNotice(`Tabel bawaan Google Sheets berhasil dibuat dan diinisialisasi! Tab aktif: ${tabListStr}.`);
        const updated: Settings = {
          ...settings,
          sheetEndpoint: sheetEndpointInput.trim(),
          sheetSecret: sheetSecretInput.trim(),
          googleSpreadsheetId: res.spreadsheetId || settings.googleSpreadsheetId,
          googleSpreadsheetUrl: res.spreadsheetUrl || settings.googleSpreadsheetUrl,
          googleSpreadsheetTitle: res.spreadsheetName || settings.googleSpreadsheetTitle,
          lastGoogleSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveSettings(updated);
        setAppSettings(updated);
        await loadAllData();
      } else {
        setBackupError(`Gagal membuat tabel bawaan di Sheet: ${res.message}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsGeneratingTables(false);
    }
  };

  const handleSyncToSheet = async () => {
    if (!sheetEndpointInput || !sheetSecretInput) {
      setBackupError('Isi Endpoint URL dan Kunci Rahasia terlebih dahulu.');
      return;
    }
    setIsSyncingSheet(true);
    setBackupNotice(null);
    setBackupError(null);

    try {
      const res = await executeSheetBackup(
        sheetEndpointInput,
        sheetSecretInput,
        undefined,
        sheetSpreadsheetIdInput.trim() || undefined
      );
      if (res.success) {
        const timeStr = new Date(res.timestamp || new Date()).toLocaleTimeString('id-ID');
        setBackupNotice(`Cadangan berhasil disinkronkan ke seluruh tab Spreadsheet pada pukul ${timeStr}!`);
        const updated: Settings = {
          ...settings,
          sheetEndpoint: sheetEndpointInput.trim(),
          sheetSecret: sheetSecretInput.trim(),
          googleSpreadsheetId: res.spreadsheetId || settings.googleSpreadsheetId,
          googleSpreadsheetUrl: res.spreadsheetUrl || settings.googleSpreadsheetUrl,
          googleSpreadsheetTitle: res.spreadsheetName || settings.googleSpreadsheetTitle,
          lastGoogleSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveSettings(updated);
        setAppSettings(updated);
      } else {
        setBackupError(`Gagal sinkronisasi ke Sheet: ${res.message}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleRestoreFromSheet = async () => {
    if (!sheetEndpointInput || !sheetSecretInput) {
      setBackupError('Isi Endpoint URL dan Kunci Rahasia terlebih dahulu.');
      return;
    }

    setIsSyncingSheet(true);
    setBackupNotice(null);
    setBackupError(null);

    try {
      const res = await executeSheetRestore(
        sheetEndpointInput,
        sheetSecretInput,
        {
          confirmOverwrite: async ({ remote, local }) => {
            return new Promise<boolean>((resolve) => {
              setConfirmModalConfig({
                isOpen: true,
                title: 'Konfirmasi Pemulihan dari Google Sheets',
                description: 'Memulihkan data akan menimpa seluruh akun, layanan, hak akses, dan riwayat di IndexedDB lokal dengan isi dari Google Sheets. Salinan pengaman lokal otomatis akan dibuat sebelum penimpaan (Fail-Closed).',
                details: [
                  { label: 'Akun di Sheet', value: remote.persons },
                  { label: 'Layanan di Sheet', value: remote.services },
                  { label: 'Akses Layanan di Sheet', value: remote.access },
                  { label: 'Log Riwayat di Sheet', value: remote.logs },
                  { label: 'Catatan Lanjutan di Sheet', value: remote.handoffNotes },
                  { label: 'Total Entitas Remote', value: remote.total },
                  { label: 'Total Entitas Lokal Saat Ini', value: local.total },
                ],
                confirmLabel: 'Timpa Data Lokal & Pulihkan',
                confirmVariant: 'danger',
                action: async () => {
                  setConfirmModalConfig(null);
                  resolve(true);
                },
              });
            });
          },
        },
        undefined,
        sheetSpreadsheetIdInput.trim() || undefined
      );

      if (res.success) {
        setBackupNotice('Data berhasil dipulihkan dari Google Sheets! (Salinan pengaman lokal tersimpan otomatis).');
        const updated: Settings = {
          ...settings,
          sheetEndpoint: sheetEndpointInput.trim(),
          sheetSecret: sheetSecretInput.trim(),
          googleSpreadsheetId: res.spreadsheetId || settings.googleSpreadsheetId,
          googleSpreadsheetUrl: res.spreadsheetUrl || settings.googleSpreadsheetUrl,
          googleSpreadsheetTitle: res.spreadsheetName || settings.googleSpreadsheetTitle,
          lastGoogleSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveSettings(updated);
        setAppSettings(updated);
        await loadAllData();
      } else {
        setBackupError(`Gagal pemulihan dari Sheet: ${res.message}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleDownloadPreRestoreSnapshot = () => {
    try {
      const snapshot = localStorage.getItem(PRE_RESTORE_STORAGE_KEY);
      if (!snapshot) {
        setBackupError('Belum ada salinan pengaman otomatis yang tersimpan.');
        return;
      }
      const timestamp = localStorage.getItem(`${PRE_RESTORE_STORAGE_KEY}_timestamp`) || new Date().toISOString();
      const blob = new Blob([snapshot], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-account-manager-pre-restore-safety-${timestamp.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupNotice('Salinan pengaman sebelum pemulihan berhasil diunduh!');
    } catch (err: unknown) {
      if (err instanceof Error) setBackupError(err.message);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE_GS);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch (e) {
      console.warn('Failed to copy to clipboard', e);
    }
  };

  // CRUD Account (TASK-005)
  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonError(null);
    setPersonSuccess(null);
    try {
      const created = await createAccount({
        ownerName: ownerName.trim(),
        googleEmail: googleEmail.trim(),
        label: label.trim(),
        note: note.trim(),
      });
      setPersonSuccess(`Akun "${created.ownerName}" (${created.googleEmail}) berhasil dibuat!`);
      setOwnerName('');
      setGoogleEmail('');
      setNote('');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setPersonError(err.message);
    }
  };

  const handleConfirmDeletePerson = async () => {
    if (!personToDelete) return;
    try {
      await deleteAccountWithCascade(personToDelete.id, true);
      setPersonSuccess(`Akun "${personToDelete.ownerName}" berhasil dihapus.`);
      setPersonToDelete(null);
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setPersonError(err.message);
    }
  };

  const handleAddAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonForAccess || !targetServiceId) return;
    setAccessModalError(null);
    try {
      await createAccountAccess({
        personId: selectedPersonForAccess.id,
        serviceId: targetServiceId,
        loginMethod: targetLoginMethod,
        loginName: targetLoginName.trim() || undefined,
      });
      setTargetLoginName('');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setAccessModalError(err.message);
    }
  };

  // CRUD Service (TASK-004)
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError(null);
    setServiceSuccess(null);
    try {
      const created = await createServiceWithValidation({
        name: newServiceName.trim(),
        urlTemplate: newServiceUrl.trim(),
        usesAuthuser: newServiceUsesAuthuser,
        resetRule: {
          mode: newServiceResetMode,
          hours: newServiceResetMode === 'duration' ? newServiceDurationHours : undefined,
        },
      });
      setServiceSuccess(`Layanan "${created.name}" berhasil ditambahkan!`);
      setNewServiceName('');
      setNewServiceUrl('');
      await loadAllData();
    } catch (err: unknown) {
      if (err instanceof Error) setServiceError(err.message);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedInitialServices();
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const currentAccess = accessList.find((a) => a.id === selectedAccessId);
  const currentPerson = persons.find((p) => p.id === currentAccess?.personId);
  const currentService = services.find((s) => s.id === currentAccess?.serviceId);
  const totalReadyAccounts = accessList.filter((a) => a.status === 'ready').length;

  // Telemetri Sesi Aktif Waktu Nyata (TASK-REV-11)
  const activeRunningAccess = accessList.find((a) => !!a.activeSessionStart);
  const activeRunningPerson = activeRunningAccess ? persons.find((p) => p.id === activeRunningAccess.personId) : null;
  const activeRunningService = activeRunningAccess ? services.find((s) => s.id === activeRunningAccess.serviceId) : null;
  const activeElapsedSec = activeRunningAccess?.activeSessionStart 
    ? Math.max(0, Math.floor((currentTime.getTime() - new Date(activeRunningAccess.activeSessionStart).getTime()) / 1000))
    : 0;
  const formatStopwatch = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">AI Account Manager</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950 text-sky-400 border border-sky-800 font-mono font-bold tracking-wider">PWA v1.0</span>
              </div>
              <p className="text-xs text-slate-400">Multi-Akun AI & Reset Timer • IndexedDB Offline</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Live Active Session Stopwatch (BR-03, TASK-REV-11) */}
            {activeRunningAccess && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAccessId(activeRunningAccess.id);
                  setActiveTab('sessions');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-sky-950 text-sky-300 border border-sky-700 animate-pulse transition hover:bg-sky-900 active:scale-[0.98]"
                title="Sesi berjalan - Klik untuk buka kontrol sesi"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{activeRunningService?.name || 'Sesi'}: {formatStopwatch(activeElapsedSec)}</span>
              </button>
            )}

            {/* Quick Status Count Badge */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('dashboard');
                setDashboardStatusFilter(dashboardStatusFilter === 'READY' ? 'ALL' : 'READY');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition active:scale-[0.98]"
              title="Klik untuk filter akun READY di Dashboard"
            >
              <span className="text-emerald-400 font-bold">{totalReadyAccounts}</span>
              <span className="text-slate-500">/</span>
              <span>{accessList.length} READY</span>
            </button>

            {/* Active Sync Method Chip */}
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition active:scale-[0.98]"
              title="Metode Sinkronisasi Cloud Aktif - Klik untuk kelola"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] font-mono">{activeSyncMethod === 'apps-script' ? 'Apps Script' : 'Sheets API'}</span>
            </button>

            {canInstallPwa && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 transition animate-pulse active:scale-[0.98]"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Pasang PWA</span>
              </button>
            )}

            <button
              onClick={() => setShowPwaGuideModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 shadow-sm transition active:scale-[0.98]"
              title="Panduan Instalasi & Berkas PWA Android"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>Panduan Android</span>
            </button>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : 'bg-rose-950/80 text-rose-400 border-rose-800 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900 text-slate-300 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              {currentTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 sm:px-6 overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto flex gap-6 text-sm min-w-max">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Sesi Pemakaian
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat & Catatan
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Cadangan & Google Sheet
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Akun & Akses
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`py-3 font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'services'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            Layanan AI
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Banner Auto-Ready on Open (BR-06) */}
        {autoReadyCount > 0 && !dismissAutoReadyBanner && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900 border border-emerald-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-900 border border-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-200">
                  {autoReadyCount} Akses Akun Kembali READY!
                </h4>
                <p className="text-xs text-slate-300">
                  Waktu reset telah terlampaui sejak pembukaan/refresh terakhir. Status diperbarui otomatis tanpa notifikasi push latar belakang.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissAutoReadyBanner(true)}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Offline Banner (TASK-012) */}
        {!isOnline && (
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-900/60 border border-amber-700 flex items-center justify-center shrink-0">
                <WifiOff className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-200">Mode Pesawat / Offline Aktif</h4>
                <p className="text-xs text-slate-300">
                  Aplikasi PWA berjalan mandiri dengan IndexedDB lokal. Pergantian akun, hitung mundur, catatan, dan riwayat tetap berfungsi penuh tanpa koneksi internet.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0">
              PWA Offline Ready
            </span>
          </div>
        )}

        {/* PWA Install Success Notice */}
        {pwaInstallSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pwaInstallSuccess}</span>
            </div>
            <button
              onClick={() => setPwaInstallSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Global Notices */}
        {sessionNotice && (
          <div className="p-3.5 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>{sessionNotice}</span>
          </div>
        )}

        {sessionError && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{sessionError}</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD & SWITCH CEPAT (TASK-007) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header Hero */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  Manajemen Sesi Cepat
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Dashboard Layanan & Rekomendasi Switch</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Pantau status semua akun AI secara instan. Tiap kartu layanan dilengkapi hitung mundur reset waktu nyata, Catatan Lanjutan bersama tim, serta tombol peluncuran cepat ke akun ready berikutnya.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Filter Bar (Filter Status Akun READY) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                  dashboardStatusFilter === 'READY'
                    ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Filter Cepat Status Akun</h3>
                    {dashboardStatusFilter === 'READY' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold animate-in fade-in">
                        Hanya READY Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {dashboardStatusFilter === 'READY'
                      ? `Menampilkan ${totalReadyAccounts} akun yang siap digunakan langsung.`
                      : `Menampilkan seluruh ${accessList.length} akun (READY & LIMITED).`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardStatusFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-[0.98] ${
                    dashboardStatusFilter === 'ALL'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>Semua Akun</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-950 text-slate-300 font-mono">
                    {accessList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardStatusFilter('READY')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 active:scale-[0.98] ${
                    dashboardStatusFilter === 'READY'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 hover:bg-emerald-900/80'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Hanya READY</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    dashboardStatusFilter === 'READY' ? 'bg-emerald-800 text-white' : 'bg-emerald-900 text-emerald-300'
                  }`}>
                    {totalReadyAccounts}
                  </span>
                </button>
              </div>
            </div>

            {/* Matriks Kuota Layanan (Service Quota Matrix - TASK-REV-11) */}
            {services.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Matriks Kuota & Ketersediaan Layanan AI</h3>
                      <p className="text-[11px] text-slate-400">Klik kartu layanan untuk memfokuskan daftar akun di bawah</p>
                    </div>
                  </div>

                  {dashboardFocusedService && (
                    <button
                      type="button"
                      onClick={() => setDashboardFocusedService(null)}
                      className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 flex items-center gap-1.5 w-fit active:scale-[0.98]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tampilkan Semua Layanan</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {services.map((s) => {
                    const sAccesses = accessList.filter((a) => a.serviceId === s.id);
                    const sReady = sAccesses.filter((a) => a.status === 'ready');
                    const readyPercent = sAccesses.length > 0 ? Math.round((sReady.length / sAccesses.length) * 100) : 0;
                    const isFocused = dashboardFocusedService === s.id;

                    return (
                      <div
                        key={s.id}
                        onClick={() => setDashboardFocusedService(isFocused ? null : s.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-2.5 active:scale-[0.98] ${
                          isFocused
                            ? 'bg-sky-950/70 border-sky-500 shadow-md shadow-sky-950/50'
                            : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white truncate">{s.name}</span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                              sReady.length > 0 
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/80' 
                                : 'bg-rose-950 text-rose-400 border-rose-800/80'
                            }`}>
                              {sReady.length}/{sAccesses.length}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {s.resetRule.mode === 'pacific_midnight' ? 'Pasifik 00:00' : `${s.resetRule.hours} Jam`}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="w-full bg-slate-900 rounded-md h-1.5 overflow-hidden border border-slate-800">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                readyPercent === 100 ? 'bg-emerald-500' : readyPercent > 0 ? 'bg-sky-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${readyPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                            <span>{readyPercent}% Siap</span>
                            {isFocused && <span className="text-sky-400 font-bold">Fokus</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty Services Warning */}
            {services.length === 0 && (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <Globe2 className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-200">Belum Ada Layanan AI Terdaftar</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tambahkan layanan AI bawaan untuk langsung mulai menggunakan dashboard.
                </p>
                <button
                  onClick={handleSeedDefaults}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 active:scale-[0.98]"
                >
                  Muat 5 Layanan Bawaan (AI Studio, Claude, dsb)
                </button>
              </div>
            )}

            {/* Service Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services
                .filter((svc) => !dashboardFocusedService || svc.id === dashboardFocusedService)
                .map((svc) => {
                const svcAccesses = accessList.filter((a) => a.serviceId === svc.id);
                const readyAccesses = svcAccesses.filter((a) => a.status === 'ready');
                const limitedAccesses = svcAccesses.filter((a) => a.status === 'limited');
                const displayedAccesses = dashboardStatusFilter === 'READY' ? readyAccesses : svcAccesses;
                const suggestion = getNextReadyAccountSuggestion(
                  svc.id,
                  currentPerson?.id || null,
                  accessList,
                  persons,
                  currentTime
                );
                const latestNote = handoffNotesMap[svc.id]?.[0] || null;

                return (
                  <div
                    key={svc.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{svc.name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {svc.resetRule.mode === 'pacific_midnight' ? 'Pacific 00:00' : `${svc.resetRule.hours} Jam`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono truncate max-w-[280px]">
                            {svc.urlTemplate}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {readyAccesses.length} Ready
                          </span>
                          {limitedAccesses.length > 0 && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-950 text-rose-400 border border-rose-800">
                              {limitedAccesses.length} Limited
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Catatan Lanjutan Preview (BR-15) */}
                      {latestNote && (
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-900/60 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-indigo-400">
                            <span className="font-semibold flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Catatan Lanjutan ({latestNote.authorName})
                            </span>
                            <span className="font-mono text-slate-500">
                              {new Date(latestNote.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-slate-300 italic text-[11px] line-clamp-2">
                            "{latestNote.text}"
                          </p>
                        </div>
                      )}

                      {/* Saran Switch Cepat (BR-11, BR-15) */}
                      {suggestion.suggestedAccess && suggestion.suggestedPerson && (
                        <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-800/80 flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-xs font-bold text-sky-200">Rekomendasi Akun</span>
                            </div>
                            <p className="text-xs text-slate-300">
                              <strong className="text-white">{suggestion.suggestedPerson.ownerName}</strong> ({suggestion.suggestedPerson.label})
                            </p>
                            <p className="text-[10px] text-slate-400">{suggestion.reason}</p>
                          </div>

                          <button
                            onClick={() => handleOpenSessionById(suggestion.suggestedAccess!.id)}
                            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/30 shrink-0 transition active:scale-[0.98]"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Buka Sesi (1-Tap)
                          </button>
                        </div>
                      )}

                      {/* Daftar Akun Terhubung */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-slate-400 block">
                            {dashboardStatusFilter === 'READY'
                              ? `Akun Siap Pakai (${displayedAccesses.length} READY):`
                              : `Daftar Akun Terdaftar (${svcAccesses.length}):`}
                          </label>
                          {dashboardStatusFilter === 'READY' && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {readyAccesses.length} dari {svcAccesses.length} Ready
                            </span>
                          )}
                        </div>
                        {displayedAccesses.length === 0 ? (
                          dashboardStatusFilter === 'READY' && svcAccesses.length > 0 ? (
                            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <p>
                                Tidak ada akun berstatus READY saat ini. Seluruh {svcAccesses.length} akun pada layanan ini berstatus LIMITED (menunggu reset).
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-2">Belum ada akun yang dihubungkan ke layanan ini.</p>
                          )
                        ) : (
                          displayedAccesses.map((acc) => {
                            const p = persons.find((per) => per.id === acc.personId);
                            const cd = acc.status === 'limited' && acc.resetAt 
                              ? getRemainingCountdown(acc.resetAt, currentTime).formatted
                              : null;
                            const isCopied = copiedKey === `url-${acc.id}`;

                            return (
                              <div
                                key={acc.id}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                                  selectedAccessId === acc.id
                                    ? 'bg-slate-950 border-sky-600 shadow-sm'
                                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-200 truncate">{p?.ownerName || 'Unknown'}</span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono font-bold uppercase tracking-wider ${
                                      acc.status === 'ready'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                                    }`}>
                                      {acc.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-400 truncate">{p?.googleEmail}</p>
                                  {cd && (
                                    <p className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
                                      <Timer className="w-3 h-3" />
                                      Reset: {cd}
                                    </p>
                                  )}
                                </div>

                                {/* Full Functional Action Button Group (TASK-REV-11) */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleOpenSessionById(acc.id)}
                                    title="Buka Sesi (Peluncuran URL + catat sesi)"
                                    className="p-2 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800 transition active:scale-[0.98]"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleCopyAccessUrl(acc)}
                                    title="Salin Tautan Akses Langsung (dengan parameter authuser)"
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-[0.98]"
                                  >
                                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    onClick={() => handleDirectExternalOpen(acc)}
                                    title="Buka Langsung di Jendela Baru (tanpa mengubah status)"
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-[0.98]"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleStopSessionById(acc.id)}
                                    title="Stop Sesi (Hitung durasi & tetap ready)"
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-[0.98]"
                                  >
                                    <Square className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleLimitSessionById(acc.id)}
                                    title="Tandai Limit (Hitung mundur reset)"
                                    className="p-2 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-400 border border-amber-900 transition active:scale-[0.98]"
                                  >
                                    <AlertOctagon className="w-3.5 h-3.5" />
                                  </button>

                                  {acc.status === 'limited' && (
                                    <button
                                      onClick={() => handleEditResetById(acc.id)}
                                      title="Koreksi Waktu Reset akun ini secara langsung"
                                      className="p-2 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-400 border border-purple-800 transition active:scale-[0.98]"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: SESI PEMAKAIAN (TASK-006) */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-sky-950/80 text-sky-400 border border-sky-800 text-xs font-medium">
                  <Activity className="w-3.5 h-3.5" />
                  Pelacakan Waktu Nyata
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Sesi Pemakaian AI: Buka, Stop, & Limit</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Kontrol sesi pemakaian terintegrasi: Buka (peluncuran URL & catat <code>opened</code>), Stop (hitung durasi & status tetap <code>ready</code>), Limit (status <code>limited</code> & catat <code>limit_hit</code>), koreksi waktu reset, serta evaluasi Auto-Ready tanpa duplikasi log.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                    <Activity className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Status Akses Aktif</p>
                      <p className="text-sm font-semibold text-slate-100 uppercase font-mono">{currentAccess?.status || 'Belum Ada Akses'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                    <Timer className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Hitung Mundur Reset</p>
                      <p className="text-sm font-semibold font-mono text-emerald-400">
                        {currentAccess?.status === 'limited' && currentAccess.resetAt
                          ? getRemainingCountdown(currentAccess.resetAt, currentTime).formatted
                          : '00:00:00'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Total Layanan Terhubung</p>
                      <p className="text-sm font-semibold text-slate-100">{services.length} Layanan AI Aktif</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Service Switcher Bar (TASK-REV-11) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1.5 pl-1">
                <Filter className="w-3.5 h-3.5 text-sky-400" />
                <span>Pilih Layanan:</span>
              </span>

              <button
                type="button"
                onClick={() => setSessionServiceFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition active:scale-[0.98] ${
                  sessionServiceFilter === 'ALL'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Semua Layanan ({accessList.length})
              </button>

              {services.map((svc) => {
                const count = accessList.filter((a) => a.serviceId === svc.id).length;
                const isSelected = sessionServiceFilter === svc.id;

                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setSessionServiceFilter(svc.id);
                      const firstAcc = accessList.find((a) => a.serviceId === svc.id);
                      if (firstAcc) setSelectedAccessId(firstAcc.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{svc.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Session Controller & Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controller Box */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-sky-400" />
                    Kontrol Sesi Akses Akun
                  </h3>
                  {currentAccess && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                      currentAccess.status === 'ready'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                    }`}>
                      {currentAccess.status}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">Pilih Akses Layanan yang Akan Digunakan:</label>
                  {accessList.length === 0 ? (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                      Belum ada akses terhubung. Silakan hubungkan akun ke layanan di tab "Akun & Akses".
                    </div>
                  ) : (
                    <select
                      value={selectedAccessId}
                      onChange={(e) => setSelectedAccessId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                    >
                      {accessList
                        .filter((acc) => sessionServiceFilter === 'ALL' || acc.serviceId === sessionServiceFilter)
                        .map((acc) => {
                          const p = persons.find((per) => per.id === acc.personId);
                          const s = services.find((ser) => ser.id === acc.serviceId);
                          return (
                            <option key={acc.id} value={acc.id}>
                              [{s?.name || acc.serviceId}] {p?.ownerName || acc.personId} ({p?.googleEmail}) — Status: {acc.status.toUpperCase()}
                            </option>
                          );
                        })}
                    </select>
                  )}
                </div>

                {currentAccess && currentPerson && currentService && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{currentService.name}</h4>
                        <p className="text-xs text-slate-400">
                          Pengguna: <strong className="text-sky-300">{currentPerson.ownerName}</strong> ({currentPerson.googleEmail})
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                        {currentAccess.loginMethod === 'google' ? 'Google Auth' : `User: ${currentAccess.loginName || 'Sendiri'}`}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                      <div>
                        {currentAccess.activeSessionStart ? (
                          <span className="text-sky-400 font-medium animate-pulse flex items-center gap-1.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            Sesi Berjalan: {formatStopwatch(activeElapsedSec)} (Mulai: {new Date(currentAccess.activeSessionStart).toLocaleTimeString()})
                          </span>
                        ) : (
                          <span>Tidak ada sesi yang sedang berjalan pada akun ini.</span>
                        )}
                      </div>

                      {currentAccess.status === 'limited' && currentAccess.resetAt && (
                        <div className="text-right">
                          <span className="text-rose-400 font-mono">
                            Reset: {getRemainingCountdown(currentAccess.resetAt, currentTime).formatted}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick URL Copy & External Direct Open Bar */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyAccessUrl(currentAccess)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1.5 transition active:scale-[0.98]"
                      >
                        {copiedKey === `url-${currentAccess.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-sky-400" />
                        )}
                        <span>Salin Tautan Akses</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectExternalOpen(currentAccess)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1.5 transition active:scale-[0.98]"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                        <span>Kunjungi Web Langsung</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <button
                      onClick={() => handleOpenSessionById(selectedAccessId)}
                      disabled={!currentAccess || currentAccess.status === 'limited'}
                      className={`p-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] ${
                        !currentAccess || currentAccess.status === 'limited'
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                          : 'bg-sky-600 hover:bg-sky-500 text-white'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      1. Tombol Buka Sesi (Buka URL)
                    </button>

                    <button
                      onClick={() => handleStopSessionById(selectedAccessId)}
                      disabled={!currentAccess || currentAccess.status === 'limited'}
                      className={`p-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                        !currentAccess || currentAccess.status === 'limited'
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <Square className="w-4 h-4" />
                      2. Tombol Stop (Tetap Ready)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <button
                      onClick={() => setShowLimitModal(true)}
                      disabled={!currentAccess}
                      className="p-3 rounded-xl bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-amber-200 font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                      <AlertOctagon className="w-4 h-4 text-amber-400" />
                      3. Tombol Limit (Tunggu Reset)
                    </button>

                    {currentAccess?.status === 'limited' ? (
                      <button
                        onClick={() => setShowEditResetModal(true)}
                        className="p-3 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-800 text-purple-200 font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
                      >
                        <Edit3 className="w-4 h-4 text-purple-400" />
                        Edit Waktu Reset (Koreksi)
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center text-[11px]">
                        Edit reset aktif saat status LIMITED
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Riwayat Log Sesi Terpilih */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    Riwayat Sesi Akses ({sessionLogs.length})
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Real-time IndexedDB</span>
                </div>

                {sessionLogs.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl flex-1 flex items-center justify-center">
                    Belum ada riwayat aktivitas pada akses ini. Tekan "Tombol Buka" untuk memulai.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 flex-1">
                    {sessionLogs.map((log) => {
                      const logBadgeColor = 
                        log.type === 'opened' ? 'bg-sky-950 text-sky-400 border-sky-800' :
                        log.type === 'stop' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                        log.type === 'limit_hit' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                        log.type === 'reset_ready' ? 'bg-purple-950 text-purple-400 border-purple-800' :
                        'bg-slate-800 text-slate-300 border-slate-700';

                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono font-bold uppercase tracking-wider ${logBadgeColor}`}>
                              {log.type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(log.at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-snug">{log.detail}</p>
                          {log.durationSec !== undefined && (
                            <p className="text-[10px] text-sky-400 font-mono">Durasi: {log.durationSec} detik</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Input Limit dengan 6 Tombol Preset Cepat (TASK-REV-11) */}
            {showLimitModal && currentService && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-amber-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="flex items-center gap-3 text-amber-400">
                    <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center">
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">Set Status Limit Pemakaian</h4>
                      <p className="text-xs text-amber-300">Pilih waktu resetAt (BR-04, BR-05)</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">
                    Gunakan kalkulasi bawaan layanan (<strong className="text-sky-300">{currentService.resetRule.mode}</strong>), tombol preset cepat, atau input manual:
                  </p>

                  <div className="space-y-3 pt-1">
                    <button
                      onClick={() => handleApplyLimit(false)}
                      className="w-full p-3 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-sky-200 text-xs font-semibold text-left transition flex items-center justify-between active:scale-[0.98]"
                    >
                      <div>
                        <span className="block font-bold">1. Gunakan Aturan Layanan Otomatis</span>
                        <span className="text-[10px] text-sky-400">
                          {currentService.resetRule.mode === 'pacific_midnight' ? 'Tengah Malam Pasifik (00:00 PST/PDT)' : `${currentService.resetRule.hours} Jam dari sekarang`}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-sky-400" />
                    </button>

                    {/* Tombol Preset Cepat Durasi (TASK-REV-11) */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        2. Tombol Preset Cepat Penambahan Durasi:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration(1)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold transition active:scale-[0.98]"
                        >
                          +1 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration(2)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold transition active:scale-[0.98]"
                        >
                          +2 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration(3)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold transition active:scale-[0.98]"
                        >
                          +3 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration(4)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold transition active:scale-[0.98]"
                        >
                          +4 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration(8)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-mono font-semibold transition active:scale-[0.98]"
                        >
                          +8 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLimitDuration('pacific_midnight')}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-800/80 text-[10px] font-mono font-semibold transition active:scale-[0.98]"
                          title="Tengah Malam Pasifik Besok"
                        >
                          Pasifik 00:00
                        </button>
                      </div>

                      <div className="pt-2">
                        <label className="text-[10px] text-slate-400 block mb-1">Nilai Waktu Reset Dipilih (atau edit manual):</label>
                        <input
                          type="datetime-local"
                          value={limitManualDate}
                          onChange={(e) => setLimitManualDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono"
                        />
                      </div>

                      <button
                        onClick={() => handleApplyLimit(true)}
                        disabled={!limitManualDate}
                        className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition active:scale-[0.98] ${
                          !limitManualDate 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20'
                        }`}
                      >
                        Simpan Limit dengan Waktu Manual / Preset
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setShowLimitModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium active:scale-[0.98]"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Edit resetAt */}
            {showEditResetModal && currentAccess && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-purple-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="flex items-center gap-3 text-purple-400">
                    <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">Koreksi Waktu Reset (resetAt)</h4>
                      <p className="text-xs text-purple-300">BR-05: Tidak ada tombol Ready manual</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">
                    Waktu reset saat ini: <strong className="text-purple-300 font-mono">{currentAccess.resetAt ? new Date(currentAccess.resetAt).toLocaleString('id-ID') : '-'}</strong>.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 block">Preset Koreksi Waktu:</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + 1 * 3600 * 1000);
                            setEditResetManualDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold"
                        >
                          +1 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + 2 * 3600 * 1000);
                            setEditResetManualDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold"
                        >
                          +2 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + 4 * 3600 * 1000);
                            setEditResetManualDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold"
                        >
                          +4 Jam
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + 8 * 3600 * 1000);
                            setEditResetManualDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold"
                        >
                          +8 Jam
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 block">Waktu Reset Baru (&gt; sekarang):</label>
                      <input
                        type="datetime-local"
                        value={editResetManualDate}
                        onChange={(e) => setEditResetManualDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowEditResetModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium active:scale-[0.98]"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleEditResetAt}
                      disabled={!editResetManualDate}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-[0.98] ${
                        !editResetManualDate
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      Simpan Koreksi Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RIWAYAT & CATATAN LANJUTAN (TASK-008 & TASK-REV-11) */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-800 text-xs font-medium">
                  <History className="w-3.5 h-3.5" />
                  Audit Trail & Kolaborasi Tim
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Audit Trail & Catatan Kolaborasi Tim</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Jejak riwayat aktivitas terurut kronologis (opened, stop, limit, auto-ready, note), filter multi-kategori, ekspor CSV fungsional, serta Catatan Lanjutan bersama per layanan.
                  </p>
                </div>
              </div>
            </div>

            {handoffNotice && (
              <div className="p-3.5 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{handoffNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Kolom Kiri: Catatan Lanjutan Layanan + Catatan Akun */}
              <div className="lg:col-span-5 space-y-6">
                {/* Catatan Lanjutan Komposer */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    Tulis Catatan Lanjutan Layanan
                  </h3>
                  <p className="text-xs text-slate-400">
                    Catatan ini akan langsung tampil kepada anggota tim lain saat mereka membuka layanan tersebut (BR-15).
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Pilih Layanan AI:</label>
                      <select
                        value={targetServiceId}
                        onChange={(e) => setTargetServiceId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-400 block">Isi Catatan Lanjutan:</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setNewHandoffText((prev) => `[UPDATE] ${prev}`)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                          >
                            + [UPDATE]
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewHandoffText((prev) => `[LIMIT] ${prev}`)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-white border border-slate-800"
                          >
                            + [LIMIT]
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewHandoffText((prev) => `[SERAH TERIMA] ${prev}`)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-sky-400 hover:text-white border border-slate-800"
                          >
                            + [SERAH TERIMA]
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={newHandoffText}
                        onChange={(e) => setNewHandoffText(e.target.value)}
                        placeholder="mis. Prompt riset data keuangan baru separuh jalan, lanjutkan dari poin 4..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={() => handleCreateHandoff(targetServiceId)}
                      disabled={!newHandoffText.trim() || !targetServiceId}
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 active:scale-[0.98] ${
                        !newHandoffText.trim() || !targetServiceId
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Kirim Catatan Lanjutan
                    </button>
                  </div>
                </div>

                {/* Catatan Bebas Akun Google (BR-09) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      Catatan Bebas per Akun Google
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {persons.length} Akun
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {persons.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{p.ownerName}</span>
                          <div className="flex items-center gap-2">
                            {p.note && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(p.note || '', `pnote-${p.id}`, `Catatan akun ${p.ownerName} disalin!`)}
                                className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1"
                                title="Salin Catatan Akun"
                              >
                                {copiedKey === `pnote-${p.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPersonForNoteEdit(p);
                                setEditingNoteText(p.note || '');
                              }}
                              className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center gap-1 active:scale-[0.98]"
                            >
                              <Edit3 className="w-3 h-3" />
                              Ubah
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">{p.googleEmail}</p>
                        <p className="text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                          {p.note || 'Belum ada catatan.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Unified Chronological Event History */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-400" />
                      Audit Trail Kronologis Terpadu
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {allHistoryLogs.length} Log
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tombol Ekspor CSV Fungsional (TASK-REV-11) */}
                    <button
                      type="button"
                      onClick={handleExportHistoryCsv}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition active:scale-[0.98]"
                      title="Unduh seluruh data riwayat dalam format spreadsheet CSV"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Ekspor CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar untuk Riwayat */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        placeholder="Cari dalam log (nama pengguna, email, keterangan)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={historyServiceFilter}
                        onChange={(e) => setHistoryServiceFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="ALL">Semua Layanan</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Filter Kategori Tipe Kejadian (Zero-Pill Badges) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {[
                      { id: 'ALL', label: 'Semua Tipe' },
                      { id: 'opened', label: 'Sesi Dibuka' },
                      { id: 'stop', label: 'Durasi Stop' },
                      { id: 'limit_hit', label: 'Limit' },
                      { id: 'reset_ready', label: 'Auto-Ready' },
                      { id: 'note', label: 'Catatan' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setHistoryTypeFilter(type.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition shrink-0 active:scale-[0.98] ${
                          historyTypeFilter === type.id
                            ? 'bg-sky-600 text-white font-bold shadow-sm'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Log List View */}
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 flex-1">
                  {allHistoryLogs
                    .filter((item) => {
                      if (historyServiceFilter !== 'ALL' && item.service?.id !== historyServiceFilter) return false;
                      if (historyTypeFilter !== 'ALL' && item.log.type !== historyTypeFilter) return false;
                      if (historySearchQuery.trim()) {
                        const q = historySearchQuery.toLowerCase();
                        const matchOwner = item.person?.ownerName?.toLowerCase().includes(q);
                        const matchEmail = item.person?.googleEmail?.toLowerCase().includes(q);
                        const matchDetail = item.log.detail?.toLowerCase().includes(q);
                        const matchService = item.service?.name?.toLowerCase().includes(q);
                        if (!matchOwner && !matchEmail && !matchDetail && !matchService) return false;
                      }
                      return true;
                    })
                    .map((item) => {
                      const badgeColor = 
                        item.log.type === 'opened' ? 'bg-sky-950 text-sky-400 border-sky-800' :
                        item.log.type === 'stop' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                        item.log.type === 'limit_hit' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                        item.log.type === 'reset_ready' ? 'bg-purple-950 text-purple-400 border-purple-800' :
                        'bg-amber-950 text-amber-400 border-amber-800';

                      const isCopied = copiedKey === `log-${item.log.id}`;
                      const logSummary = `[${new Date(item.log.at).toLocaleString('id-ID')}] ${item.service?.name} - ${item.person?.ownerName} (${item.log.type}): ${item.log.detail}`;

                      return (
                        <div key={item.log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs hover:border-slate-700 transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono font-bold uppercase tracking-wider ${badgeColor}`}>
                                {item.log.type}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {item.service?.name || 'Layanan'} • {item.person?.ownerName || 'Pengguna'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-slate-500">
                                {new Date(item.log.at).toLocaleString('id-ID')}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(logSummary, `log-${item.log.id}`, 'Log aktivitas berhasil disalin!')}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-[0.98]"
                                title="Salin Baris Log Ini"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-snug">{item.log.detail}</p>
                          {item.log.durationSec !== undefined && (
                            <p className="text-[10px] font-mono text-sky-400">Durasi sesi: {item.log.durationSec} detik</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Edit Account Note */}
            {selectedPersonForNoteEdit && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h4 className="text-base font-bold text-white">Edit Catatan Akun: {selectedPersonForNoteEdit.ownerName}</h4>
                  <textarea
                    rows={4}
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    placeholder="Masukkan catatan baru..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedPersonForNoteEdit(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium active:scale-[0.98]"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSavePersonNote}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold active:scale-[0.98]"
                    >
                      Simpan Catatan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BACKUP & SPREADSHEET (TASK-009, 010 & GOOGLE SHEETS DIRECT) */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Google Workspace Direct API • Tanpa Basis Data Firebase
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Sinkronisasi Google Sheets & Pencadangan Data</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Hubungkan akun Google Anda untuk mencadangkan dan memulihkan seluruh data layanan, akun, dan riwayat secara langsung ke Google Sheets pribadi Anda melalui Google Sheets API v4 resmi tanpa database Firebase pihak ketiga.
                  </p>
                </div>
              </div>
            </div>

            {/* Global Notices for Backup & Sheet Sync */}
            {backupNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{backupNotice}</span>
              </div>
            )}

            {backupError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{backupError}</span>
              </div>
            )}

            {/* SELEKTOR METODE SINKRONISASI GOOGLE SHEETS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white">Metode Sinkronisasi Cloud</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                      {activeSyncMethod === 'apps-script' ? 'Apps Script Aktif' : 'OAuth Direct Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pilih antara metode skrip mandiri (Google Apps Script) atau koneksi OAuth resmi Google Workspace.
                  </p>
                </div>
              </div>

              <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectSyncMethod('apps-script')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeSyncMethod === 'apps-script'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Google Apps Script Web App</span>
                  {activeSyncMethod === 'apps-script' && (
                    <span className="text-[9px] bg-emerald-950 text-emerald-200 border border-emerald-700 px-1.5 py-0.5 rounded font-mono">AKTIF</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSyncMethod('google-direct')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    activeSyncMethod === 'google-direct'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>Google Workspace Direct (OAuth)</span>
                  {activeSyncMethod === 'google-direct' && (
                    <span className="text-[9px] bg-sky-950 text-sky-200 border border-sky-700 px-1.5 py-0.5 rounded font-mono">AKTIF</span>
                  )}
                </button>
              </div>
            </div>

            {/* SEKSI: GOOGLE WORKSPACE OAUTH & DIRECT GOOGLE SHEETS API (OFFICIAL 1-CLICK SYNC) */}
            <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 rounded-2xl p-6 space-y-5 shadow-2xl transition border ${
              activeSyncMethod === 'google-direct'
                ? 'border-sky-500/80 ring-2 ring-sky-500/20'
                : 'border-slate-800 opacity-95'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                    activeSyncMethod === 'google-direct'
                      ? 'bg-sky-900 border border-sky-500 text-sky-200'
                      : 'bg-sky-950 border border-sky-800 text-sky-400'
                  }`}>
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">Google Workspace Direct Sheets API</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-800 font-semibold">
                        OAuth 2.0 Resmi
                      </span>
                      {activeSyncMethod === 'google-direct' ? (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-700 font-semibold flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                          Metode Aktif Digunakan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectSyncMethod('google-direct')}
                          className="text-[10px] px-2.5 py-0.5 rounded-md bg-slate-800 hover:bg-sky-900/80 text-slate-300 hover:text-sky-200 border border-slate-700 transition cursor-pointer active:scale-[0.98]"
                        >
                          Aktifkan Metode Ini
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Sinkronisasi dua arah instan ke Google Drive & Google Sheets tanpa perlu menyalin skrip Code.gs
                    </p>
                  </div>
                </div>

                {googleUser && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      {googleUser.photoURL ? (
                        <img src={googleUser.photoURL} alt="Avatar" className="w-6 h-6 rounded-full border border-sky-500" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-sky-800 flex items-center justify-center text-white text-[10px] font-bold">
                          {googleUser.displayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-white font-semibold leading-none">{googleUser.displayName || 'Google User'}</p>
                        <p className="text-[10px] font-mono text-slate-400 leading-tight">{googleUser.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGoogleSignOutClick}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Keluar dari akun Google"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {!googleUser ? (
                <div className="p-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                  <div className="space-y-1 max-w-lg">
                    <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Hubungkan Langsung ke Akun Google Anda
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Masuk dengan Akun Google Anda untuk otomatis membuat spreadsheet cadangan di Google Drive, mencadangkan seluruh data multi-akun dengan 1 klik, serta memulihkan data kapan saja.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={isGoogleLoggingIn}
                    className="gsi-material-button shrink-0 shadow-lg shadow-sky-600/20"
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isGoogleLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Spreadsheet Connected Banner */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-slate-400">Spreadsheet Terhubung:</span>
                        <strong className="text-white font-semibold">
                          {settings.googleSpreadsheetTitle || 'Belum Ada Spreadsheet Dipilih'}
                        </strong>
                      </div>
                      {settings.googleSpreadsheetId && (
                        <p className="text-[11px] font-mono text-slate-500">ID: {settings.googleSpreadsheetId}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {settings.googleSpreadsheetUrl && (
                        <a
                          href={settings.googleSpreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Google Sheets</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons for Direct Sync */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={handleCreateDirectSpreadsheetClick}
                      disabled={isCreatingDirectSheet}
                      className="p-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition cursor-pointer"
                    >
                      <Sparkles className={`w-4 h-4 ${isCreatingDirectSheet ? 'animate-spin' : ''}`} />
                      <span>{isCreatingDirectSheet ? 'Membuat Spreadsheet...' : '1-Click Buat Spreadsheet Baru'}</span>
                    </button>

                    <button
                      onClick={handleDirectBackupClick}
                      disabled={isDirectSyncing || (!settings.googleSpreadsheetId && !sheetSpreadsheetIdInput)}
                      className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <Upload className={`w-4 h-4 ${isDirectSyncing ? 'animate-bounce' : ''}`} />
                      <span>{isDirectSyncing ? 'Menyinkronkan...' : 'Cadangkan ke Google Sheets'}</span>
                    </button>

                    <button
                      onClick={handleDirectRestoreClick}
                      disabled={isDirectSyncing || (!settings.googleSpreadsheetId && !sheetSpreadsheetIdInput)}
                      className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-rose-300 border border-rose-900/40 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className={`w-4 h-4 ${isDirectSyncing ? 'animate-bounce' : ''}`} />
                      <span>Pulihkan dari Google Sheets</span>
                    </button>
                  </div>

                  {/* Drive Spreadsheets Browser */}
                  {userSpreadsheets.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-amber-400" />
                          Spreadsheet di Google Drive Anda ({userSpreadsheets.length}):
                        </span>
                        <span className="text-[10px] text-slate-500">Pilih berkas untuk ditautkan</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {userSpreadsheets.map((file) => {
                          const isSelected = settings.googleSpreadsheetId === file.id;
                          return (
                            <div
                              key={file.id}
                              onClick={() => handleSelectDriveSpreadsheet(file)}
                              className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-2 transition ${
                                isSelected
                                  ? 'bg-sky-950/80 border-sky-600 text-sky-200 font-semibold'
                                  : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="truncate min-w-0">
                                <p className="truncate text-xs">{file.name}</p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">{file.id}</p>
                              </div>
                              {isSelected ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-600 text-white shrink-0">Aktif</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 hover:text-white shrink-0">Pilih</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEKSI: GOOGLE SHEETS VIA APPS SCRIPT WEB APP (ALTERNATIVE SCRIPT INTEGRATION) */}
            <div className={`bg-slate-900 rounded-2xl p-6 space-y-6 shadow-xl transition border ${
              activeSyncMethod === 'apps-script'
                ? 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-950/40'
                : 'border-slate-800 opacity-95'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                    activeSyncMethod === 'apps-script'
                      ? 'bg-emerald-900 border border-emerald-500 text-emerald-300'
                      : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                  }`}>
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">Metode Alternatif: Google Apps Script Web App</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                        Kunci Rahasia & Endpoint
                      </span>
                      {activeSyncMethod === 'apps-script' ? (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Metode Aktif Digunakan
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectSyncMethod('apps-script')}
                          className="text-[10px] px-2.5 py-0.5 rounded-md bg-slate-800 hover:bg-emerald-900/80 text-slate-300 hover:text-emerald-200 border border-slate-700 transition cursor-pointer active:scale-[0.98]"
                        >
                          Aktifkan Metode Ini
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Penyimpanan lokal di IndexedDB • Cadangan & pemulihan dua arah ke Google Sheets via skrip Code.gs pribadi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowScriptModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Code className="w-3.5 h-3.5" />
                    Panduan & Kode Script
                  </button>
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Tersalin!' : 'Salin Code.gs'}
                  </button>
                </div>
              </div>

              {/* Form Konfigurasi Endpoint, Kunci Rahasia & Spreadsheet ID */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 space-y-1 text-xs">
                    <label className="text-slate-300 font-medium block">
                      URL Endpoint Web App (Deployment Google Apps Script):
                    </label>
                    <input
                      type="url"
                      value={sheetEndpointInput}
                      onChange={(e) => setSheetEndpointInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:border-sky-500 focus:outline-none text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      URL dari menu <strong>Deploy &gt; New deployment &gt; Web app</strong> (Who has access: <strong>Anyone</strong>).
                    </p>
                  </div>

                  <div className="md:col-span-3 space-y-1 text-xs">
                    <label className="text-slate-300 font-medium block">
                      Kunci Rahasia (AUTH_SECRET_KEY):
                    </label>
                    <input
                      type="password"
                      value={sheetSecretInput}
                      onChange={(e) => setSheetSecretInput(e.target.value)}
                      placeholder="Kunci rahasia di Code.gs"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:border-sky-500 focus:outline-none text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Sama persis dengan AUTH_SECRET_KEY di Code.gs.
                    </p>
                  </div>

                  <div className="md:col-span-3 space-y-1 text-xs">
                    <label className="text-slate-300 font-medium block">
                      ID / URL Spreadsheet (Opsional):
                    </label>
                    <input
                      type="text"
                      value={sheetSpreadsheetIdInput}
                      onChange={(e) => setSheetSpreadsheetIdInput(e.target.value)}
                      placeholder="Kosongkan untuk buat otomatis"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:border-sky-500 focus:outline-none text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Tautkan sheet yang ada atau kosongkan untuk auto-create.
                    </p>
                  </div>
                </div>

                {/* Tombol Aksi: Simpan, Uji Probe, dan Generate Tabel Bawaan */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSaveSettings}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                    >
                      Simpan Pengaturan
                    </button>

                    <button
                      onClick={handleProbeAppsScript}
                      disabled={isProbing || !sheetEndpointInput || !sheetSecretInput}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                        isProbing || !sheetEndpointInput || !sheetSecretInput
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 ${isProbing ? 'animate-pulse' : ''}`} />
                      {isProbing ? 'Menguji Koneksi...' : 'Uji Koneksi (Test Probe)'}
                    </button>

                    <button
                      onClick={handleInitSheetTables}
                      disabled={isGeneratingTables || !sheetEndpointInput || !sheetSecretInput}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                        isGeneratingTables || !sheetEndpointInput || !sheetSecretInput
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                          : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-600/20'
                      }`}
                      title="Buat seluruh 6 tab (metadata, services, persons, access, logs, handoff) dengan styling rapi di Google Sheets"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGeneratingTables ? 'animate-spin' : 'text-sky-200'}`} />
                      {isGeneratingTables ? 'Membuat Tabel...' : 'Generate Tabel Bawaan Google Sheets'}
                    </button>

                    <button
                      onClick={() => setShowSchemaPreview(!showSchemaPreview)}
                      className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition"
                    >
                      {showSchemaPreview ? 'Sembunyikan Skema Tabel' : 'Lihat Skema 6 Tabel'}
                    </button>
                  </div>

                  {settings.lastGoogleSyncAt && (
                    <span className="text-[11px] font-mono text-slate-400">
                      Sinkronisasi terakhir: {new Date(settings.lastGoogleSyncAt).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                {/* Banner Spreadsheet Terhubung Aktif */}
                {(settings.googleSpreadsheetUrl || probeResult?.spreadsheetUrl) && (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-400">Spreadsheet Google Sheets Terhubung:</span>
                      <strong className="text-white font-semibold">
                        {settings.googleSpreadsheetTitle || probeResult?.spreadsheetName || 'AI_Account_Manager_Backup'}
                      </strong>
                    </div>
                    <a
                      href={settings.googleSpreadsheetUrl || probeResult?.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Buka Google Sheets Langsung
                    </a>
                  </div>
                )}

                {/* Kartu Status Hasil Uji Koneksi (Test Probe) */}
                {probeResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2.5 animate-in fade-in ${
                    probeResult.success
                      ? 'bg-slate-950/90 border-emerald-800/80 text-slate-200'
                      : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {probeResult.success ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-bold text-sm">
                          {probeResult.success ? 'Uji Koneksi Berhasil!' : 'Uji Koneksi Gagal'}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
                        Latensi: {probeResult.latencyMs} ms
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{probeResult.message}</p>

                    {probeResult.tabs && probeResult.tabs.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Tab Terdeteksi di Spreadsheet ({probeResult.tabs.length} tab):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {probeResult.tabs.map((tab, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400"
                            >
                              {tab.name}: {tab.rowCount} baris
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Skema 6 Tabel Bawaan Drawer */}
                {showSchemaPreview && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <h4 className="font-bold text-slate-200 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        Struktur 6 Tabel Bawaan Google Sheets (Auto-Generated)
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Format Teks Murni & Anti-Formula Injection</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-emerald-400 font-mono text-[11px]">1. metadata</div>
                        <p className="text-[11px] text-slate-400">key, value, updatedAt</p>
                        <p className="text-[10px] text-slate-500 italic">Menyimpan konfigurasi zona waktu, versi, & limit akun</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-sky-400 font-mono text-[11px]">2. services</div>
                        <p className="text-[11px] text-slate-400">id, name, urlTemplate, usesAuthuser, resetRule, createdAt, updatedAt</p>
                        <p className="text-[10px] text-slate-500 italic">Daftar layanan AI & aturan reset waktu</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-indigo-400 font-mono text-[11px]">3. persons</div>
                        <p className="text-[11px] text-slate-400">id, ownerName, googleEmail, label, note, createdAt, updatedAt</p>
                        <p className="text-[10px] text-slate-500 italic">Akun Google pengguna (maks. 10 akun)</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-purple-400 font-mono text-[11px]">4. access</div>
                        <p className="text-[11px] text-slate-400">id, personId, serviceId, loginMethod, loginName, status, limitedAt, resetAt, activeSessionStart, createdAt, updatedAt</p>
                        <p className="text-[10px] text-slate-500 italic">Hak akses akun x layanan & status limit reset</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-amber-400 font-mono text-[11px]">5. logs</div>
                        <p className="text-[11px] text-slate-400">id, accessId, type, at, durationSec, detail</p>
                        <p className="text-[10px] text-slate-500 italic">Audit trail kejadian buka, stop, limit</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="font-semibold text-rose-400 font-mono text-[11px]">6. handoff</div>
                        <p className="text-[11px] text-slate-400">id, serviceId, accessId, authorName, text, createdAt</p>
                        <p className="text-[10px] text-slate-500 italic">Catatan lanjutan bersama tim per layanan</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tombol Aksi Utama: Cadangkan & Pulihkan ke Google Sheets via Apps Script */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={handleSyncToSheet}
                    disabled={isSyncingSheet || !sheetEndpointInput || !sheetSecretInput}
                    className={`p-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                      isSyncingSheet || !sheetEndpointInput || !sheetSecretInput
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                    title="Kirim seluruh data IndexedDB ke Google Sheets via Google Apps Script Web App"
                  >
                    <Upload className={`w-4 h-4 ${isSyncingSheet ? 'animate-bounce' : ''}`} />
                    <span>{isSyncingSheet ? 'Menyinkronkan ke Google Sheets...' : 'Cadangkan ke Google Sheets (via Apps Script)'}</span>
                  </button>

                  <button
                    onClick={handleRestoreFromSheet}
                    disabled={isSyncingSheet || !sheetEndpointInput || !sheetSecretInput}
                    className={`p-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border transition cursor-pointer ${
                      isSyncingSheet || !sheetEndpointInput || !sheetSecretInput
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-800'
                        : 'bg-slate-950 hover:bg-slate-900 text-rose-300 border-rose-900/40 hover:border-rose-800'
                    }`}
                    title="Pulihkan data dari Google Sheets ke IndexedDB dengan perlindungan snapshot lokal (Fail-Closed)"
                  >
                    <Download className={`w-4 h-4 ${isSyncingSheet ? 'animate-bounce' : ''}`} />
                    <span>Pulihkan dari Google Sheets (via Apps Script)</span>
                  </button>
                </div>

              </div>
            </div>

            {/* SEKSI 2: CADANGAN JSON LOKAL & SNAPSHOT PENGAMAN */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadangan JSON Lokal (Mandiri & Offline)</h3>
                  <p className="text-xs text-slate-400">Pencadangan berkas JSON langsung pada perangkat tanpa koneksi internet</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Ekspor mencakup data akun, layanan, akses, riwayat log pemakaian, dan catatan lanjutan tim. Sesuai aturan keamanan <strong>BR-13</strong>, endpoint dan kunci rahasia <strong>dikecualikan mutlak</strong> dari berkas ekspor JSON.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={handleExportJson}
                  className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition"
                >
                  <Download className="w-4 h-4" />
                  Unduh Berkas JSON Lokal
                </button>

                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    Pulihkan dari Berkas JSON (Impor)
                  </button>
                </div>

                {typeof window !== 'undefined' && localStorage.getItem(PRE_RESTORE_STORAGE_KEY) && (
                  <button
                    onClick={handleDownloadPreRestoreSnapshot}
                    className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-900/60 font-medium text-xs flex items-center justify-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Unduh Salinan Pengaman Pre-Restore
                  </button>
                )}
              </div>

              {/* KARTU RESTORE DATASET CADANGAN TERLAMPIR (TASK-REV-10) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-xs">Dataset Cadangan Terlampir (30 Okt 2026)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                      86 Entitas Terverifikasi
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Memuat 6 Layanan AI, 9 Akun Google Pengguna, 23 Hak Akses Layanan, 35 Log Riwayat Pemakaian, dan 13 Catatan Lanjutan Tim.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRestoreAttachedBackup}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 shrink-0 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Pulihkan Dataset Terlampir</span>
                </button>
              </div>
            </div>

            {/* MODAL PANDUAN & KODE GOOGLE APPS SCRIPT */}
            {showScriptModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Code className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">Panduan & Kode Google Apps Script (Code.gs)</h3>
                    </div>
                    <button
                      onClick={() => setShowScriptModal(false)}
                      className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg bg-slate-800"
                    >
                      ✕ Tutup
                    </button>
                  </div>

                  <div className="overflow-y-auto space-y-4 text-xs pr-1">
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                      <h4 className="font-bold text-slate-200">Cara Memasang di Google Drive Anda (Gratis & Tanpa Firebase):</h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                        <li>Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-400 underline font-semibold">script.google.com</a> dan klik tombol <strong>+ Proyek baru</strong>.</li>
                        <li>Hapus semua teks default di editor, lalu tempel kode skrip di bawah ini ke <code>Code.gs</code>.</li>
                        <li>Ubah variabel <code>AUTH_SECRET_KEY</code> dengan kata sandi rahasia yang Anda tentukan sendiri.</li>
                        <li>Klik <strong>Deploy &gt; Deployment baru</strong> (New deployment).</li>
                        <li>Klik ikon roda gigi di sebelah "Pilih jenis", pilih jenis <strong>Aplikasi web</strong> (Web app).</li>
                        <li>Set <strong>Jalankan sebagai:</strong> <em>Saya</em> (Me), dan <strong>Siapa yang memiliki akses:</strong> <em>Siapa saja</em> (Anyone) <span className="text-amber-400 font-semibold">(Wajib agar tidak error HTML login)</span>.</li>
                        <li>Klik <strong>Deploy</strong>, izinkan akses Google saat diminta, lalu salin URL yang berakhiran <code>/exec</code> ke kolom Endpoint di aplikasi ini.</li>
                        <li>Setelah menyimpan pengaturan, klik tombol <strong>"Generate Tabel Bawaan Google Sheets"</strong> untuk otomatis membuat 6 tab terformat rapi di Spreadsheet Anda!</li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-400 text-[11px]">Kode Skrip: Code.gs (Versi 2.1 Optimized)</span>
                        <button
                          onClick={handleCopyCode}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedCode ? 'Tersalin!' : 'Salin Seluruh Kode'}
                        </button>
                      </div>
                      <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
                        {APPS_SCRIPT_CODE_GS}
                      </pre>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex justify-end shrink-0">
                    <button
                      onClick={() => setShowScriptModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AKUN & AKSES (TASK-005) */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-medium">
                  <Users className="w-3.5 h-3.5" />
                  Manajemen Multi-Akun
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Akun Google & Akses Layanan AI (Maks. 10 Akun)</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Kelola hingga 10 akun Google dengan keunikan nama pemilik & email. Hubungkan akun ke layanan dengan metode login Google atau kredensial akun sendiri.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Tambah Akun */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-sky-400" />
                    Tambah Akun Google Baru
                  </h3>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                    persons.length >= settings.maxPersons ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {persons.length >= settings.maxPersons ? 'Penuh (10/10)' : `${persons.length}/${settings.maxPersons}`}
                  </span>
                </div>

                {personError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{personError}</span>
                  </div>
                )}

                {personSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{personSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleCreatePerson} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nama Pemilik Akun (ownerName - Unik)</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="mis. Budi Santoso"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Email Google Akun (googleEmail - Unik)</label>
                    <input
                      type="email"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="budi@gmail.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Label Identitas Akun</label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="mis. Akun Kantor 01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Catatan Bebas Akun (Opsional)</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Catatan akun..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={persons.length >= settings.maxPersons}
                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition shadow-sm ${
                      persons.length >= settings.maxPersons 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    Simpan Akun Google
                  </button>
                </form>
              </div>

              {/* Daftar Akun */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Daftar Akun Google ({persons.length})
                  </h3>
                </div>

                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {persons.map((p, idx) => {
                    const pAccesses = accessList.filter((a) => a.personId === p.id);
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-sky-400 font-mono">#{idx + 1}</span>
                              <span className="text-xs font-bold text-slate-200">{p.ownerName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{p.label}</span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">{p.googleEmail}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setSelectedPersonForAccess(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800 text-xs font-medium flex items-center gap-1 transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Akses ({pAccesses.length})
                            </button>
                            <button
                              onClick={() => setPersonToDelete(p)}
                              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Akses per Akun Tags */}
                        {pAccesses.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                            {pAccesses.map((acc) => {
                              const s = services.find((ser) => ser.id === acc.serviceId);
                              return (
                                <span
                                  key={acc.id}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1"
                                >
                                  {s?.name || acc.serviceId}
                                  <span className={`w-1.5 h-1.5 rounded-full ${acc.status === 'ready' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Tambah Akses ke Layanan */}
            {selectedPersonForAccess && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h4 className="text-base font-bold text-white">Hubungkan Akses: {selectedPersonForAccess.ownerName}</h4>
                  
                  {accessModalError && (
                    <div className="p-3 rounded-xl bg-rose-950 text-rose-300 text-xs border border-rose-800">
                      {accessModalError}
                    </div>
                  )}

                  <form onSubmit={handleAddAccess} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Pilih Layanan AI:</label>
                      <select
                        value={targetServiceId}
                        onChange={(e) => setTargetServiceId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Metode Login:</label>
                      <select
                        value={targetLoginMethod}
                        onChange={(e) => setTargetLoginMethod(e.target.value as LoginMethod)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                      >
                        <option value="google">Login dengan Akun Google</option>
                        <option value="own">Login dengan Akun Sendiri / Username Pengingat</option>
                      </select>
                    </div>

                    {targetLoginMethod === 'own' && (
                      <div>
                        <label className="text-slate-400 block mb-1">Nama Pengguna / Pengingat (loginName):</label>
                        <input
                          type="text"
                          value={targetLoginName}
                          onChange={(e) => setTargetLoginName(e.target.value)}
                          placeholder="mis. user_claude_01 (hanya pengingat, bukan password)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPersonForAccess(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                      >
                        Tutup
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                      >
                        Hubungkan Akses
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Konfirmasi Hapus Person */}
            {personToDelete && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-rose-900 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h4 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
                    <AlertCircle className="w-5 h-5" />
                    Konfirmasi Hapus Akun
                  </h4>
                  <p className="text-xs text-slate-300">
                    Apakah Anda yakin ingin menghapus akun <strong>{personToDelete.ownerName}</strong>? Seluruh akses ke layanan dan riwayat sesi terkait akun ini akan dihapus secara kaskade.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setPersonToDelete(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleConfirmDeletePerson}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                    >
                      Hapus Akun & Kaskade
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: LAYANAN AI (TASK-004) */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-medium">
                  <Globe2 className="w-3.5 h-3.5" />
                  Konfigurasi Layanan AI
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Layanan AI & Builder URL authuser</h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Konfigurasi tautan URL layanan AI dengan injeksi parameter <code>?authuser=&lt;email&gt;</code> otomatis, aturan waktu reset (Pacific Midnight DST atau durasi jam), dan hapus kaskade terproteksi konfirmasi.
                  </p>
                </div>
              </div>
            </div>

            {serviceSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{serviceSuccess}</span>
              </div>
            )}

            {serviceError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{serviceError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Tambah Layanan */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-sky-400" />
                  Tambah Layanan AI Baru
                </h3>

                <form onSubmit={handleCreateService} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nama Layanan:</label>
                    <input
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="mis. Mistral Le Chat"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">URL Tautan Layanan (http/https):</label>
                    <input
                      type="url"
                      value={newServiceUrl}
                      onChange={(e) => setNewServiceUrl(e.target.value)}
                      placeholder="https://chat.mistral.ai"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="usesAuthuser"
                      checked={newServiceUsesAuthuser}
                      onChange={(e) => setNewServiceUsesAuthuser(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-sky-600 focus:ring-0"
                    />
                    <label htmlFor="usesAuthuser" className="text-slate-300">
                      Gunakan <code>?authuser=&lt;email&gt;</code> untuk switch akun Google
                    </label>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Aturan Waktu Reset:</label>
                    <select
                      value={newServiceResetMode}
                      onChange={(e) => setNewServiceResetMode(e.target.value as ResetRuleMode)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    >
                      <option value="pacific_midnight">Tengah Malam Pasifik (America/Los_Angeles - DST Akurat)</option>
                      <option value="duration">Durasi Jam Sejak Limit</option>
                    </select>
                  </div>

                  {newServiceResetMode === 'duration' && (
                    <div>
                      <label className="text-slate-400 block mb-1">Jumlah Durasi (Jam):</label>
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={newServiceDurationHours}
                        onChange={(e) => setNewServiceDurationHours(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm transition"
                  >
                    Simpan Layanan AI
                  </button>
                </form>
              </div>

              {/* Daftar Layanan Terdaftar */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-indigo-400" />
                    Layanan AI Terdaftar ({services.length})
                  </h3>
                  <button
                    onClick={handleSeedDefaults}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Muat Default
                  </button>
                </div>

                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {services.map((svc) => (
                    <div key={svc.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-white">{svc.name}</h4>
                          <p className="text-[11px] font-mono text-slate-400 truncate max-w-sm">{svc.urlTemplate}</p>
                        </div>
                        <button
                          onClick={() => setServiceToDelete(svc)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {svc.resetRule.mode === 'pacific_midnight' ? 'Pacific 00:00' : `${svc.resetRule.hours} Jam`}
                        </span>
                        {svc.usesAuthuser && (
                          <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                            authuser: Ya
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Konfirmasi Hapus Service */}
            {serviceToDelete && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-rose-900 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h4 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
                    <AlertCircle className="w-5 h-5" />
                    Konfirmasi Hapus Layanan
                  </h4>
                  <p className="text-xs text-slate-300">
                    Apakah Anda yakin ingin menghapus layanan <strong>{serviceToDelete.name}</strong>? Seluruh data akses, riwayat pemakaian, dan catatan lanjutan terkait layanan ini akan ikut terhapus secara kaskade.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setServiceToDelete(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteServiceWithCascade(serviceToDelete.id, true);
                          setServiceToDelete(null);
                          await loadAllData();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                    >
                      Hapus Layanan & Kaskade
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Pengguna untuk Operasi Restore Google Sheets */}
      {confirmModalConfig && (
        <ConfirmationModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          description={confirmModalConfig.description}
          details={confirmModalConfig.details}
          confirmLabel={confirmModalConfig.confirmLabel}
          confirmVariant={confirmModalConfig.confirmVariant}
          isLoading={isSyncingSheet}
          onConfirm={confirmModalConfig.action}
          onCancel={() => setConfirmModalConfig(null)}
        />
      )}

      {/* Modal Panduan Instalasi PWA di Android */}
      <PwaInstallGuideModal
        isOpen={showPwaGuideModal}
        onClose={() => setShowPwaGuideModal(false)}
        canInstall={canInstallPwa}
        onInstall={handleInstallClick}
        isOnline={isOnline}
      />

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 px-4 sm:px-6 text-center text-xs text-slate-500">
        AI Account Manager PWA • Penyimpanan Lokal IndexedDB • PWA Siap Pakai & Aman
      </footer>
    </div>
  );
}
