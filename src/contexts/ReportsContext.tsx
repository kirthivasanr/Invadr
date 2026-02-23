/**
 * ReportsContext.tsx
 * Global state for all reports; drives map, dashboard, and sync UI.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { InvasiveReport, OutbreakZone } from '../types';
import { getAllReports, saveReport } from '../services/storageService';
import { runSync, onReportSyncUpdate, startNetworkListener } from '../services/syncManager';
import { detectOutbreaks } from '../services/outbreakService';
import { fetchAllReports } from '../services/apiService';

interface ReportsContextValue {
  reports: InvasiveReport[];
  outbreakZones: OutbreakZone[];
  pendingCount: number;
  isRefreshing: boolean;
  addReport: (report: InvasiveReport) => Promise<void>;
  refresh: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const ReportsContext = createContext<ReportsContextValue>({
  reports: [],
  outbreakZones: [],
  pendingCount: 0,
  isRefreshing: false,
  addReport: async () => {},
  refresh: async () => {},
  triggerSync: async () => {},
});

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<InvasiveReport[]>([]);
  const [outbreakZones, setOutbreakZones] = useState<OutbreakZone[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const unsubNetRef = useRef<(() => void) | null>(null);
  const unsubSyncRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Always load local reports (includes pending/failed that aren't on server yet)
      const local = await getAllReports();

      let serverReports: InvasiveReport[] = [];
      try {
        serverReports = await fetchAllReports();
      } catch {
        // Network unavailable — fall back to local-only
      }

      // Merge: server reports take priority; add any local reports not on server
      const serverIds = new Set(serverReports.map((r) => r.id));
      const localOnly = local.filter(
        (r) => !serverIds.has(r.id) && (r.syncStatus === 'pending' || r.syncStatus === 'failed'),
      );
      const all = [...serverReports, ...localOnly];
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setReports(all);
      setOutbreakZones(detectOutbreaks(all));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const addReport = useCallback(async (report: InvasiveReport) => {
    await saveReport(report);
    await refresh();
  }, [refresh]);

  const triggerSync = useCallback(async () => {
    await runSync();
    await refresh();
  }, [refresh]);

  // On mount: load reports, start network listener, subscribe to sync updates
  useEffect(() => {
    refresh();

    // Network-triggered auto-sync
    unsubNetRef.current = startNetworkListener();

    // Re-render on individual report status changes
    unsubSyncRef.current = onReportSyncUpdate(() => refresh());

    return () => {
      unsubNetRef.current?.();
      unsubSyncRef.current?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = reports.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed',
  ).length;

  return (
    <ReportsContext.Provider
      value={{
        reports,
        outbreakZones,
        pendingCount,
        isRefreshing,
        addReport,
        refresh,
        triggerSync,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportsContext);
}
