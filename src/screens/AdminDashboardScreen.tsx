/**
 * AdminDashboardScreen.tsx
 * Real-time admin dashboard showing uploaded photos, coordinates, user info,
 * and an interactive map with markers for every report.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { COLORS, RISK_COLORS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import {
  AdminReport,
  AdminStats,
  fetchAdminReports,
  fetchAdminStats,
} from '../services/apiService';

const { width: SCREEN_W } = Dimensions.get('window');
const POLL_INTERVAL_MS = 8_000;

type DashTab = 'feed' | 'map';

/* ── Helpers ────────────────────────────────────────────────────────── */

function timeAgo(ts: string | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimestamp(ts: string | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const time = `${h12}:${mins} ${ampm}`;
  if (isToday) return `${time}, Today`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `${time}, Yesterday`;
  return `${time}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function riskColor(level?: string): string {
  return RISK_COLORS[level ?? 'unknown'] ?? RISK_COLORS.unknown;
}

/* ── Custom green pin ──────────────────────────────────────────────── */
function GreenPin() {
  return (
    <View style={adminPin.wrap}>
      <View style={adminPin.head}>
        <Ionicons name="leaf" size={22} color="#fff" />
      </View>
      <View style={adminPin.tail} />
    </View>
  );
}
const adminPin = StyleSheet.create({
  wrap: { alignItems: 'center', width: 56, height: 62 },
  head: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2D6A4F',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 3, borderColor: '#fff',
  },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#2D6A4F',
    marginTop: -3,
  },
});

/* ── Dark map JSON style ───────────────────────────────────────────── */
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2332' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7c93' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2b' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a80' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#243447' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a2b3d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c4a6e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e3048' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3325' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e3048' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2e4a6e' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#1a2a38' }] },
];

/* ── Stat Card ──────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={26} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Expanded Report Modal ─────────────────────────────────────────────────────

function ReportDetail({
  report,
  onClose,
}: {
  report: AdminReport;
  onClose: () => void;
}) {
  const risk = report.prediction?.invasive_risk_level ?? 'unknown';
  return (
    <View style={styles.detailOverlay}>
      <View style={styles.detailCard}>
        <Pressable style={styles.detailClose} onPress={onClose}>
          <Ionicons name="close-circle" size={30} color={COLORS.white} />
        </Pressable>

        <Image
          source={{ uri: report.imageUrl }}
          style={styles.detailImage}
          resizeMode="cover"
        />
        <ScrollView style={styles.detailBody}>
          {/* Species */}
          {report.prediction && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Species Identified</Text>
              <View style={styles.speciesRow}>
                <View
                  style={[
                    styles.riskDot,
                    { backgroundColor: riskColor(risk) },
                  ]}
                />
                <Text style={styles.detailSpecies}>
                  {report.prediction.species_name}
                </Text>
                <Text style={styles.detailConf}>
                  {Math.round(report.prediction.confidence_score * 100)}%
                </Text>
              </View>
              <Text style={styles.detailRisk}>
                Risk: {risk.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Coordinates */}
          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Location</Text>
            <Text style={styles.detailCoords}>
              {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
            </Text>
          </View>

          {/* User */}
          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Reported By</Text>
            <Text style={styles.detailUser}>{report.userName}</Text>
            <Text style={styles.detailEmail}>{report.userEmail}</Text>
          </View>

          {/* Timestamp */}
          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Timestamp</Text>
            <Text style={styles.detailUser}>{report.timestamp}</Text>
          </View>

          {/* Notes */}
          {report.notes ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Notes</Text>
              <Text style={styles.detailNotes}>{report.notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashTab>('feed');
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [densityOn, setDensityOn] = useState(false);
  const [mapPopup, setMapPopup] = useState<AdminReport | null>(null);
  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch data ───────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [reps, st] = await Promise.all([
        fetchAdminReports(),
        fetchAdminStats(),
      ]);
      setReports(reps);
      setStats(st);
    } catch (err: any) {
      console.warn('Admin fetch error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Initial + polling ────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (liveEnabled) {
      pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [liveEnabled, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  /* ── Map helpers ─────────────────────────────────────────────────── */
  const centerOnUser = useCallback(async () => {
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800,
      );
    } catch {}
  }, []);

  const zoomIn = useCallback(() => {
    mapRef.current?.getCamera().then((cam) => {
      if (cam.zoom) mapRef.current?.animateCamera({ zoom: cam.zoom + 1 }, { duration: 300 });
    });
  }, []);

  const zoomOut = useCallback(() => {
    mapRef.current?.getCamera().then((cam) => {
      if (cam.zoom) mapRef.current?.animateCamera({ zoom: cam.zoom - 1 }, { duration: 300 });
    });
  }, []);

  const flyToReport = useCallback((r: AdminReport) => {
    mapRef.current?.animateToRegion(
      {
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      600,
    );
  }, []);

  // ── Map region from reports ──────────────────────────────────────────
  const mapRegion = reports.length > 0
    ? {
        latitude:
          reports.reduce((s, r) => s + r.latitude, 0) / reports.length,
        longitude:
          reports.reduce((s, r) => s + r.longitude, 0) / reports.length,
        latitudeDelta: 2,
        longitudeDelta: 2,
      }
    : {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 20,
        longitudeDelta: 20,
      };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading && reports.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>
            Welcome, {user?.name ?? 'Admin'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Live indicator */}
          <Pressable
            style={styles.liveBadge}
            onPress={() => setLiveEnabled((p) => !p)}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: liveEnabled ? '#EF4444' : COLORS.textDim },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: liveEnabled ? '#EF4444' : COLORS.textDim },
              ]}
            >
              {liveEnabled ? 'LIVE' : 'PAUSED'}
            </Text>
          </Pressable>
          <Pressable onPress={signOut} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {/* ── Stats Row ──────────────────────────────────────────────── */}
      {stats && (
        <View style={styles.statsRow}>
          <StatCard
            icon="document-text"
            label="REPORTS"
            value={stats.total_reports}
            color={COLORS.primary}
          />
          <StatCard
            icon="people"
            label="USERS"
            value={stats.total_users}
            color={COLORS.info}
          />
          <StatCard
            icon="shield-checkmark"
            label="ADMINS"
            value={stats.total_admins}
            color={COLORS.warning}
          />
        </View>
      )}

      {/* ── Photo Feed Analysis Banner ──────────────────────────── */}
      <TouchableOpacity
        style={styles.feedBanner}
        activeOpacity={0.85}
        onPress={() => router.push('/(dashboard)/feed')}
      >
        <View style={styles.feedBannerIcon}>
          <Ionicons name="alert-circle" size={24} color="#DC2626" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.feedBannerTitle}>Photo Feed Analysis</Text>
          <Text style={styles.feedBannerSub}>Threat levels, CTA & emergency contacts</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
      </TouchableOpacity>

      {/* ── Tab Bar ────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons
            name="images-outline"
            size={18}
            color={activeTab === 'feed' ? COLORS.primary : COLORS.textDim}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'feed' && styles.tabTextActive,
            ]}
          >
            Photo Feed
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons
            name="map-outline"
            size={18}
            color={activeTab === 'map' ? COLORS.primary : COLORS.textDim}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'map' && styles.tabTextActive,
            ]}
          >
            Live Map
          </Text>
        </Pressable>
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {activeTab === 'feed' ? (
        reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-upload-outline" size={64} color={COLORS.textDim} />
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptySubtitle}>
              Reports from field workers will appear here in real time.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={(r) => r.id}
            numColumns={2}
            contentContainerStyle={styles.feedGrid}
            columnWrapperStyle={styles.feedRow}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.gridCard}
                onPress={() => setSelected(item)}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
                {/* Risk badge */}
                <View
                  style={[
                    styles.gridRisk,
                    {
                      backgroundColor: riskColor(
                        item.prediction?.invasive_risk_level,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.gridRiskText}>
                    {(
                      item.prediction?.invasive_risk_level ?? 'unknown'
                    ).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.gridInfo}>
                  <Text style={styles.gridSpecies} numberOfLines={1}>
                    {item.prediction?.species_name ?? 'Unidentified'}
                  </Text>
                  <View style={styles.gridMetaRow}>
                    <Ionicons
                      name="person-outline"
                      size={10}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.gridMeta} numberOfLines={1}>
                      {item.userName}
                    </Text>
                  </View>
                  <View style={styles.gridMetaRow}>
                    <Ionicons
                      name="location-outline"
                      size={10}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.gridMeta}>
                      {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
                    </Text>
                  </View>
                  <Text style={styles.gridTime}>
                    {timeAgo(item.created_at ?? item.timestamp)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : (
        /* ── Map View (same style as user MapScreen) ─────────────── */
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            mapType="hybrid"
            customMapStyle={darkMapStyle}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton={false}
            onPress={() => setMapPopup(null)}
          >
            {reports.filter((r) => !!r.imageUrl && r.has_image).map((r) => (
              <Marker
                key={r.id}
                coordinate={{
                  latitude: r.latitude,
                  longitude: r.longitude,
                }}
                tracksViewChanges={false}
                onPress={(e) => {
                  e.stopPropagation();
                  setMapPopup(r);
                }}
              >
                <GreenPin />
              </Marker>
            ))}

            {/* Density circles */}
            {densityOn &&
              reports.map((r) => (
                <Circle
                  key={`circle-${r.id}`}
                  center={{ latitude: r.latitude, longitude: r.longitude }}
                  radius={2000}
                  fillColor="rgba(74,222,128,0.12)"
                  strokeColor="rgba(74,222,128,0.5)"
                  strokeWidth={1.5}
                />
              ))}
          </MapView>

          {/* Report count overlay */}
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>
              {reports.length} report{reports.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Right-side buttons */}
          <View style={styles.mapRightCol}>
            <TouchableOpacity style={styles.mapCircleBtn} onPress={() => {}}>
              <Ionicons name="layers" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapCompassBtn} onPress={centerOnUser}>
              <Ionicons name="compass" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Zoom controls */}
          <View style={styles.mapZoomCol}>
            <TouchableOpacity style={styles.mapZoomBtn} onPress={zoomIn}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.mapZoomDiv} />
            <TouchableOpacity style={styles.mapZoomBtn} onPress={zoomOut}>
              <Ionicons name="remove" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Density Map pill */}
          <TouchableOpacity
            style={[styles.densityBtn, densityOn && styles.densityBtnOn]}
            onPress={() => setDensityOn(!densityOn)}
            activeOpacity={0.85}
          >
            <Ionicons name="color-fill" size={18} color={densityOn ? '#fff' : '#CBD5E1'} />
            <Text style={[styles.densityText, densityOn && styles.densityTextOn]}>Density Map</Text>
          </TouchableOpacity>

          {/* Popup callout */}
          {mapPopup && (
            <View style={styles.mapPopup}>
              <View style={styles.mapPopupCard}>
                {mapPopup.imageUrl ? (
                  <Image source={{ uri: mapPopup.imageUrl }} style={styles.mapPopupImg} />
                ) : (
                  <View style={[styles.mapPopupImg, styles.mapPopupImgPlaceholder]}>
                    <Ionicons name="leaf" size={32} color="rgba(74,222,128,0.5)" />
                  </View>
                )}
                <View style={styles.mapPopupBottom}>
                  <Text style={styles.mapPopupTime}>
                    {formatTimestamp(mapPopup.created_at ?? mapPopup.timestamp)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setSelected(mapPopup); setMapPopup(null); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
                {mapPopup.prediction?.species_name ? (
                  <Text style={styles.mapPopupSpecies} numberOfLines={1}>
                    {mapPopup.prediction.species_name}
                  </Text>
                ) : null}
              </View>
              <View style={styles.mapPopupArrow} />
            </View>
          )}
        </View>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────── */}
      {selected && (
        <ReportDetail report={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const GRID_GAP = 10;
const GRID_CARD_W = (SCREEN_W - GRID_GAP * 3) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EAED',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1D21',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: '#8C939B',
    marginTop: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Stats Row ── */
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1D21',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C939B',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.8,
  },

  /* ── Feed Banner ── */
  feedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  feedBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D21',
  },
  feedBannerSub: {
    fontSize: 12,
    color: '#8C939B',
    marginTop: 3,
    lineHeight: 17,
  },

  /* ── Tab Bar ── */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#EDEEF1',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
    gap: 7,
  },
  tabActive: {
    backgroundColor: '#DCF5E7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C939B',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  /* ── Feed Grid ── */
  feedGrid: {
    paddingHorizontal: GRID_GAP,
    paddingBottom: 24,
    paddingTop: 4,
  },
  feedRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gridCard: {
    width: GRID_CARD_W,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  gridImage: {
    width: '100%',
    height: GRID_CARD_W * 0.75,
  },
  gridRisk: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridRiskText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gridInfo: {
    padding: 12,
  },
  gridSpecies: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1D21',
    marginBottom: 5,
  },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  gridMeta: {
    fontSize: 11,
    color: '#8C939B',
  },
  gridTime: {
    fontSize: 10,
    color: '#B0B6BE',
    marginTop: 4,
  },

  /* ── Empty State ── */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1D21',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8C939B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  /* ── Map ── */
  mapContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: '#0D1117',
  },
  mapOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  mapRightCol: {
    position: 'absolute',
    top: 14,
    right: 14,
    gap: 10,
  },
  mapCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30,40,55,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapCompassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,20,30,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapZoomCol: {
    position: 'absolute',
    right: 14,
    bottom: 80,
    backgroundColor: 'rgba(30,40,55,0.85)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapZoomBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapZoomDiv: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  densityBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,48,70,0.80)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  densityBtnOn: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    borderColor: 'rgba(74,222,128,0.4)',
  },
  densityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  densityTextOn: {
    color: '#fff',
  },
  mapPopup: {
    position: 'absolute',
    alignSelf: 'center',
    top: '25%',
    alignItems: 'center',
  },
  mapPopupCard: {
    width: SCREEN_W * 0.5,
    backgroundColor: 'rgba(40,55,75,0.88)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },
  mapPopupImg: {
    width: '100%',
    height: SCREEN_W * 0.38,
    resizeMode: 'cover',
  } as any,
  mapPopupImgPlaceholder: {
    backgroundColor: 'rgba(30,48,70,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPopupBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapPopupTime: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  mapPopupSpecies: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginTop: -4,
  },
  mapPopupArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(40,55,75,0.88)',
    marginTop: -1,
  },

  /* ── Detail Modal ── */
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  detailCard: {
    width: SCREEN_W - 32,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  detailClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  detailImage: {
    width: '100%',
    height: 240,
  },
  detailBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C939B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailSpecies: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1D21',
    flex: 1,
  },
  detailConf: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  detailRisk: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  detailCoords: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1D21',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1D21',
  },
  detailEmail: {
    fontSize: 12,
    color: '#8C939B',
    marginTop: 2,
  },
  detailNotes: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
