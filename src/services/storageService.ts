/**
 * storageService.ts
 * Wraps AsyncStorage to provide typed CRUD operations for InvasiveReports.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InvasiveReport, SyncStatus } from '../types';
import { STORAGE_KEYS } from '../constants';

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getAllReports(): Promise<InvasiveReport[]> {
  try {
    const [pendingRaw, syncedRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS),
      AsyncStorage.getItem(STORAGE_KEYS.SYNCED_REPORTS),
    ]);
    const pending: InvasiveReport[] = pendingRaw ? JSON.parse(pendingRaw) : [];
    const synced: InvasiveReport[] = syncedRaw ? JSON.parse(syncedRaw) : [];
    // Most-recent first
    return [...pending, ...synced].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch {
    return [];
  }
}

export async function getPendingReports(): Promise<InvasiveReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getSyncedReports(): Promise<InvasiveReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SYNCED_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Write ─────────────────────────────────────────────────────────────────────

export async function saveReport(report: InvasiveReport): Promise<void> {
  const pending = await getPendingReports();
  // Avoid duplicates
  const filtered = pending.filter((r) => r.id !== report.id);
  await AsyncStorage.setItem(
    STORAGE_KEYS.PENDING_REPORTS,
    JSON.stringify([...filtered, report]),
  );
}

export async function updateReportStatus(
  id: string,
  status: SyncStatus,
): Promise<void> {
  const pending = await getPendingReports();
  const updated = pending.map((r) => (r.id === id ? { ...r, syncStatus: status } : r));
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS, JSON.stringify(updated));
}

// ─── Move to Synced ────────────────────────────────────────────────────────────

export async function markReportSynced(id: string): Promise<void> {
  const [pending, synced] = await Promise.all([
    getPendingReports(),
    getSyncedReports(),
  ]);

  const target = pending.find((r) => r.id === id);
  if (!target) return;

  const newPending = pending.filter((r) => r.id !== id);
  const newSynced = [...synced, { ...target, syncStatus: 'uploaded' as SyncStatus }];

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS, JSON.stringify(newPending)),
    AsyncStorage.setItem(STORAGE_KEYS.SYNCED_REPORTS, JSON.stringify(newSynced)),
  ]);
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteReport(id: string): Promise<void> {
  const [pending, synced] = await Promise.all([
    getPendingReports(),
    getSyncedReports(),
  ]);
  await Promise.all([
    AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_REPORTS,
      JSON.stringify(pending.filter((r) => r.id !== id)),
    ),
    AsyncStorage.setItem(
      STORAGE_KEYS.SYNCED_REPORTS,
      JSON.stringify(synced.filter((r) => r.id !== id)),
    ),
  ]);
}

export async function clearAllReports(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.PENDING_REPORTS),
    AsyncStorage.removeItem(STORAGE_KEYS.SYNCED_REPORTS),
  ]);
}
