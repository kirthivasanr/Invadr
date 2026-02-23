import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import { COLORS, SYNC_STATUS_LABELS } from '../constants';
import { useReports } from '../contexts/ReportsContext';
import { InvasiveReport } from '../types';

// ─── Palette ───────────────────────────────────────────────────────────────────
const BG     = '#F0EDE6';   // warm beige background
const CARD   = '#FFFFFF';
const GREEN  = '#2D6A4F';   // primary green
const GREEN2 = '#3B7D5F';
const TEXT    = '#1A202C';
const DIM    = '#8A8F98';
const PILL   = '#2A6243';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtCoord(lat: number, lng: number) {
  const la = `${Math.abs(lat).toFixed(4)}\u00B0 ${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(lng).toFixed(4)}\u00B0 ${lng >= 0 ? 'E' : 'W'}`;
  return `${la}, ${lo}`;
}

// ─── Signal Badge ──────────────────────────────────────────────────────────────
function SignalBadge({ online }: { online: boolean }) {
  return (
    <View style={[sig.pill, !online && sig.pillOff]}>
      <Ionicons
        name={online ? 'cellular' : 'cellular-outline'}
        size={14}
        color="#fff"
      />
      <Text style={sig.text}>{online ? 'Stable Signal' : 'Offline'}</Text>
    </View>
  );
}
const sig = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  pillOff: { backgroundColor: DIM },
  text: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// ─── Transmission Bar ──────────────────────────────────────────────────────────
function TransmissionBar({ status }: { status: string }) {
  const isSent = status === 'uploaded';
  const isFailed = status === 'failed';
  const isSyncing = status === 'syncing';
  const pct = isSent ? 100 : isSyncing ? 65 : isFailed ? 30 : 95;
  const barColor = isFailed ? '#EF4444' : GREEN;
  const label = isSent ? 'Sent' : isFailed ? 'Failed' : `${pct}% Uploaded`;

  return (
    <View style={tx.wrap}>
      <View style={tx.row}>
        <Text style={tx.label}>Transmission</Text>
        <Text style={[tx.status, isFailed && { color: '#EF4444' }]}>{label}</Text>
      </View>
      <View style={tx.track}>
        <View style={[tx.bar, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}
const tx = StyleSheet.create({
  wrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 12, color: DIM, fontWeight: '500' },
  status: { fontSize: 12, color: TEXT, fontWeight: '600' },
  track: { height: 5, backgroundColor: '#E8E8E8', borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
});

// ─── Sighting Card ─────────────────────────────────────────────────────────────
function SightingCard({ report }: { report: InvasiveReport }) {
  const species = report.prediction?.species_name ?? 'Unidentified';
  const conf = report.prediction
    ? `${Math.round(report.prediction.confidence_score * 100)}% Match`
    : '—';
  const loc = report.coordinates
    ? fmtCoord(report.coordinates.latitude, report.coordinates.longitude)
    : 'Location unknown';
  const timeAgo = getTimeAgo(report.timestamp);

  return (
    <View style={c.card}>
      {/* Thumbnail */}
      {report.imageUri ? (
        <Image source={{ uri: report.imageUri }} style={c.thumb} />
      ) : (
        <View style={[c.thumb, c.thumbEmpty]}>
          <Ionicons name="leaf" size={28} color={COLORS.primaryMuted} />
        </View>
      )}

      {/* Details */}
      <View style={c.body}>
        <View style={c.nameRow}>
          <Text style={c.species} numberOfLines={1}>{species}</Text>
          {report.prediction && (
            <View style={c.confPill}>
              <Text style={c.confText}>{conf}</Text>
            </View>
          )}
        </View>

        <View style={c.metaRow}>
          <Ionicons name="location" size={13} color={GREEN} />
          <Text style={c.meta} numberOfLines={1}>{loc}</Text>
        </View>

        <View style={c.metaRow}>
          <Ionicons name="time-outline" size={13} color={DIM} />
          <Text style={c.meta}>{timeAgo}</Text>
        </View>

        <TransmissionBar status={report.syncStatus} />
      </View>
    </View>
  );
}
const c = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  thumb: {
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
  },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, marginLeft: 14 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  species: { fontSize: 17, fontWeight: '800', color: TEXT, flexShrink: 1 },
  confPill: {
    backgroundColor: PILL,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  confText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  meta: { fontSize: 12.5, color: DIM, fontWeight: '500' },
});

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { reports, isRefreshing, refresh } = useReports();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [coords, setCoords] = useState<string>('Getting location...');

  useEffect(() => {
    const unsub = NetInfo.addEventListener((st) => setIsOnline(!!st.isConnected));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setCoords(fmtCoord(loc.coords.latitude, loc.coords.longitude));
        } else {
          setCoords('Location unavailable');
        }
      } catch {
        setCoords('Location unavailable');
      }
    })();
  }, []);

  const recent = useMemo(
    () => reports.filter((r) => !!r.imageUri).slice(0, 10),
    [reports],
  );

  const goCapture = useCallback(() => router.push('/(tabs)/report'), [router]);

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={GREEN}
          />
        }
      >
        {/* ── Frosted header ── */}
        <View style={s.headerWrap}>
          <BlurView intensity={60} tint="light" style={s.headerBlur}>
            <View style={s.headerInner}>
              <View style={s.coordRow}>
                <Ionicons name="globe-outline" size={18} color={DIM} />
                <Text style={s.coordText}>{coords}</Text>
              </View>
              <SignalBadge online={isOnline} />
            </View>
          </BlurView>
        </View>

        {/* ── Capture button ── */}
        <TouchableOpacity style={s.captureBtn} activeOpacity={0.85} onPress={goCapture}>
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={s.captureBtnText}>Capture Species</Text>
        </TouchableOpacity>

        {/* ── Section header ── */}
        <Text style={s.section}>Recent Sightings</Text>

        {/* ── Cards ── */}
        {recent.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="leaf-outline" size={52} color={COLORS.primaryMuted} />
            <Text style={s.emptyTitle}>No sightings yet</Text>
            <Text style={s.emptySub}>
              Capture your first species sighting using the button above.
            </Text>
          </View>
        ) : (
          recent.map((r) => <SightingCard key={r.id} report={r} />)
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 32 },

  /* Header */
  headerWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  headerBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.75)' : 'transparent',
  },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coordText: { fontSize: 14, fontWeight: '500', color: TEXT },

  /* Capture */
  captureBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GREEN,
    borderRadius: 28,
    paddingVertical: 18,
    marginBottom: 28,
    shadowColor: GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  captureBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  /* Section */
  section: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 16 },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginTop: 10 },
  emptySub: {
    fontSize: 13,
    color: DIM,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
