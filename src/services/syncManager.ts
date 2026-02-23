/**
 * syncManager.ts
 * Orchestrates background synchronisation of pending reports.
 *
 * Flow:
 *  1. Fetch all pending reports from AsyncStorage.
 *  2. For each, set status → "syncing".
 *  3. Try uploading to the backend.
 *  4. On success:  move to synced bucket (status = "uploaded").
 *  5. On failure:  revert status to "failed" (retry next cycle).
 */
import NetInfo from '@react-native-community/netinfo';
import { predictSpecies, uploadReport } from './apiService';
import {
  getPendingReports,
  markReportSynced,
  updateReportStatus,
} from './storageService';
import { InvasiveReport } from '../types';

type SyncListener = (report: InvasiveReport) => void;

const listeners: SyncListener[] = [];
let isSyncing = false;

export function onReportSyncUpdate(listener: SyncListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners(report: InvasiveReport) {
  listeners.forEach((l) => l(report));
}

export async function runSync(): Promise<void> {
  if (isSyncing) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  isSyncing = true;
  try {
    const pending = await getPendingReports();
    const toSync = pending.filter(
      (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed',
    );

    for (const report of toSync) {
      // ── Mark as syncing ──────────────────────────────────────────────────
      await updateReportStatus(report.id, 'syncing');
      notifyListeners({ ...report, syncStatus: 'syncing' });

      try {
        // ── Run ML prediction if still missing ───────────────────────────
        let finalReport = { ...report };
        if (!finalReport.prediction) {
          try {
            const prediction = await predictSpecies(finalReport.imageUri);
            finalReport = { ...finalReport, prediction };
          } catch {
            // Prediction failed — upload without it
          }
        }

        // ── Upload to backend ────────────────────────────────────────────
        await uploadReport({
          id: finalReport.id,
          imageUri: finalReport.imageUri,
          audioUri: finalReport.audioUri,
          latitude: finalReport.coordinates.latitude,
          longitude: finalReport.coordinates.longitude,
          timestamp: finalReport.timestamp,
          notes: finalReport.notes,
          prediction: finalReport.prediction,
          userId: finalReport.userId,
        });

        // ── Move to synced bucket ─────────────────────────────────────────
        await markReportSynced(finalReport.id);
        notifyListeners({ ...finalReport, syncStatus: 'uploaded' });
      } catch (err) {
        console.warn(`[SyncManager] Failed to sync report ${report.id}:`, err);
        await updateReportStatus(report.id, 'failed');
        notifyListeners({ ...report, syncStatus: 'failed' });
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Subscribe to network changes and auto-sync when connectivity is restored.
 * Returns an unsubscribe function.
 */
export function startNetworkListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      runSync().catch(console.warn);
    }
  });
  return unsubscribe;
}
