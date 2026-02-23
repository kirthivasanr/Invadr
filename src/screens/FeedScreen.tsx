/**
 * FeedScreen.tsx
 * Photo Feed showing all processed reports with thumbnails,
 * invasive badges, and Call-to-Action buttons.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants';
import { THREAT_CONFIG, ProcessedReport, ThreatLevel } from '../data/mockFeedData';
import { fetchAdminReports, AdminReport } from '../services/apiService';
import ReportDetailScreen from './ReportDetailScreen';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Threat Badge ───────────────────────────────────────────────────────────────

function ThreatBadge({ level }: { level: ThreatLevel }) {
  const cfg = THREAT_CONFIG[level];
  return (
    <View style={[tb.container, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[tb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const tb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

// ── Invasive Chip ──────────────────────────────────────────────────────────────

function InvasiveChip({ invasive }: { invasive: boolean }) {
  return (
    <View
      style={[
        ic.chip,
        { backgroundColor: invasive ? '#FEE2E2' : '#E0F2FE' },
      ]}
    >
      <View style={[ic.dot, { backgroundColor: invasive ? '#EF4444' : '#0EA5E9' }]} />
      <Text style={[ic.text, { color: invasive ? '#DC2626' : '#0284C7' }]}>
        {invasive ? 'INVASIVE' : 'NATIVE'}
      </Text>
    </View>
  );
}
const ic = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ── Feed Card ──────────────────────────────────────────────────────────────────

function FeedCard({
  report,
  onCTA,
}: {
  report: ProcessedReport;
  onCTA: () => void;
}) {
  const conf = Math.round(report.confidence * 100);

  return (
    <View style={fc.card}>
      {/* Image */}
      <View style={fc.imageWrap}>
        <Image source={{ uri: report.imageUri }} style={fc.image} />

        {/* Overlays on image */}
        <View style={fc.imageOverlayTop}>
          <InvasiveChip invasive={report.isInvasive} />
          <ThreatBadge level={report.threatLevel} />
        </View>

        {/* Confidence bar */}
        <View style={fc.confBar}>
          <View style={[fc.confFill, { width: `${conf}%` }]} />
        </View>

        {/* Audio indicator */}
        {report.audioUri && (
          <View style={fc.audioBadge}>
            <Ionicons name="mic" size={12} color="#fff" />
            <Text style={fc.audioBadgeText}>
              {report.audioDuration ? `${report.audioDuration}s` : 'Audio'}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={fc.info}>
        <View style={fc.infoTop}>
          <View style={{ flex: 1 }}>
            <Text style={fc.speciesName} numberOfLines={1}>
              {report.speciesName}
            </Text>
            <Text style={fc.scientificName} numberOfLines={1}>
              {report.scientificName}
            </Text>
          </View>
          <View style={fc.confCircle}>
            <Text style={fc.confText}>{conf}%</Text>
          </View>
        </View>

        <Text style={fc.description} numberOfLines={2}>
          {report.description}
        </Text>

        {/* Meta */}
        <View style={fc.metaRow}>
          <View style={fc.metaItem}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={fc.metaText} numberOfLines={1}>
              {report.locationName}
            </Text>
          </View>
          <View style={fc.metaItem}>
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={fc.metaText}>{timeAgo(report.timestamp)}</Text>
          </View>
        </View>

        {/* Audio analysis summary */}
        {report.audioAnalysisComplete && report.audioAnalysisSummary && (
          <View style={fc.audioSummary}>
            <Ionicons name="volume-high" size={14} color={COLORS.primary} />
            <Text style={fc.audioSummaryText} numberOfLines={1}>
              {report.audioAnalysisSummary}
            </Text>
          </View>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            fc.ctaBtn,
            report.isInvasive ? fc.ctaBtnDanger : fc.ctaBtnSafe,
          ]}
          onPress={onCTA}
          activeOpacity={0.85}
        >
          <Ionicons
            name={report.isInvasive ? 'alert-circle' : 'information-circle'}
            size={18}
            color="#fff"
          />
          <Text style={fc.ctaBtnText}>
            {report.isInvasive ? 'Take Action' : 'View Details'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  imageWrap: {
    height: 200,
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlayTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  confBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  confFill: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 2,
  },
  audioBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  audioBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  info: {
    padding: 16,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  speciesName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  scientificName: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  confCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  confText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  audioSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  audioSummaryText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaBtnDanger: {
    backgroundColor: '#DC2626',
  },
  ctaBtnSafe: {
    backgroundColor: COLORS.primary,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
});

// ── Filter Chips ───────────────────────────────────────────────────────────────

type FilterType = 'all' | 'invasive' | 'native' | 'critical';

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'invasive', label: 'Invasive', icon: 'alert-circle' },
  { key: 'native', label: 'Native', icon: 'leaf' },
  { key: 'critical', label: 'Critical', icon: 'flame' },
];

// ── Map AdminReport → ProcessedReport ─────────────────────────────────────────

function toProcessedReport(r: AdminReport): ProcessedReport {
  const risk = r.prediction?.invasive_risk_level ?? 'low';
  const threatLevel: ThreatLevel =
    risk === 'high' ? 'high' : risk === 'medium' ? 'moderate' : 'low';
  const isInvasive = risk !== 'low';
  return {
    id: r.id,
    imageUri: r.imageUrl,
    speciesName: r.prediction?.species_name ?? 'Unidentified',
    scientificName: '',
    isInvasive,
    threatLevel,
    confidence: r.prediction?.confidence_score ?? 0,
    description: r.notes || (isInvasive ? 'Invasive species detected by ML pipeline.' : 'Non-invasive species identified.'),
    recommendations: isInvasive ? ['Report to local authority', 'Do not disturb'] : ['Monitor area'],
    latitude: r.latitude,
    longitude: r.longitude,
    locationName: `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
    timestamp: r.timestamp,
    reportedBy: r.userName,
    reporterEmail: r.userEmail ?? '',
    notes: r.notes ?? '',
    audioAnalysisComplete: false,
    audioUri: r.has_audio ? r.audioUrl : undefined,
  } as ProcessedReport;
}

const POLL_MS = 8_000;

// ── Main Feed Screen ───────────────────────────────────────────────────────────

export default function FeedScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ProcessedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ProcessedReport | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReports = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const raw = await fetchAdminReports();
      setReports(raw.map(toProcessedReport));
    } catch (e) {
      console.warn('FeedScreen fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
    pollRef.current = setInterval(() => loadReports(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadReports]);

  const filteredReports = reports.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'invasive') return r.isInvasive;
    if (filter === 'native') return !r.isInvasive;
    if (filter === 'critical') return r.threatLevel === 'critical' || r.threatLevel === 'high';
    return true;
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports();
  }, [loadReports]);

  const invasiveCount = reports.filter((r) => r.isInvasive).length;
  const criticalCount = reports.filter(
    (r) => r.threatLevel === 'critical' || r.threatLevel === 'high',
  ).length;

  // Show detail page if a report is selected
  if (selectedReport) {
    return (
      <ReportDetailScreen
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (loading && reports.length === 0) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textMuted, fontSize: 14 }}>Loading reports…</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Photo Feed</Text>
            <Text style={s.headerSub}>
              {reports.length} reports · {invasiveCount} invasive · {criticalCount} critical
            </Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
            {criticalCount > 0 && (
              <View style={s.notifDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon as any}
              size={14}
              color={filter === f.key ? '#fff' : COLORS.textMuted}
            />
            <Text
              style={[s.filterText, filter === f.key && s.filterTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed list */}
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard report={item} onCTA={() => setSelectedReport(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="images-outline" size={48} color={COLORS.textDim} />
            <Text style={s.emptyTitle}>No reports match this filter</Text>
            <Text style={s.emptySub}>
              Try selecting a different filter above.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: COLORS.white,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
