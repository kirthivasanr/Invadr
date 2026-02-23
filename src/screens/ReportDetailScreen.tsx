/**
 * ReportDetailScreen.tsx
 * Full-detail page shown when user presses "Call-to-Action" on a feed card.
 * Includes species info, audio analysis, map preview, recommendations,
 * and emergency contact buttons (Fire Dept, Police, Locals).
 */
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, COLORS } from '../constants';
import { ProcessedReport, THREAT_CONFIG, ThreatLevel } from '../data/mockFeedData';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Emergency Contacts (static for now — will be location-aware later) ──────

interface EmergencyContact {
  id: string;
  label: string;
  subtitle: string;
  phone: string;
  icon: string;
  color: string;
  bgColor: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'fire',
    label: 'Fire Department',
    subtitle: 'Report vegetation / wildfire risk',
    phone: '101',
    icon: 'flame',
    color: '#DC2626',
    bgColor: '#FEE2E2',
  },
  {
    id: 'police',
    label: 'Police Department',
    subtitle: 'Report dangerous wildlife / trespassing',
    phone: '100',
    icon: 'shield',
    color: '#2563EB',
    bgColor: '#DBEAFE',
  },
  {
    id: 'wildlife',
    label: 'Wildlife Control',
    subtitle: 'State Fish & Wildlife Service',
    phone: '18004040700',
    icon: 'paw',
    color: '#059669',
    bgColor: '#D1FAE5',
  },
  {
    id: 'locals',
    label: 'Local Rangers',
    subtitle: 'Nearest park / forest ranger station',
    phone: '18004087725',
    icon: 'people',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  {
    id: 'alert-locals',
    label: 'Alert Locals',
    subtitle: 'Broadcast alert via Twilio to local contacts',
    phone: '',
    icon: 'megaphone',
    color: '#EA580C',
    bgColor: '#FFF7ED',
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  report: ProcessedReport;
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function makeCall(phone: string, label: string) {
  const url = Platform.select({
    ios: `telprompt:${phone}`,
    android: `tel:${phone}`,
    default: `tel:${phone}`,
  });
  Alert.alert(
    `Call ${label}?`,
    `This will dial ${phone === '911' ? '911' : phone}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call Now',
        style: 'destructive',
        onPress: () => Linking.openURL(url!).catch(() =>
          Alert.alert('Error', 'Unable to make the call. Please dial manually.'),
        ),
      },
    ],
  );
}

async function triggerAlertLocals(speciesName: string, location: string) {
  Alert.alert(
    'Alert Locals?',
    `This will broadcast a Twilio call alerting local contacts about ${speciesName} near ${location}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Alert',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/alert-locals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ species: speciesName, location }),
            });
            if (res.ok) {
              Alert.alert('Alert Sent', 'Local contacts are being notified via phone call.');
            } else {
              const data = await res.json().catch(() => ({}));
              Alert.alert('Alert Failed', data.detail || 'Could not send the alert.');
            }
          } catch (err: any) {
            Alert.alert('Network Error', 'Unable to reach the server. Please try again.');
          }
        },
      },
    ],
  );
}

// ── Threat Banner ──────────────────────────────────────────────────────────────

function ThreatBanner({ level, isInvasive }: { level: ThreatLevel; isInvasive: boolean }) {
  const cfg = THREAT_CONFIG[level];
  return (
    <View style={[banner.container, { backgroundColor: cfg.bg, borderColor: cfg.color + '30' }]}>
      <View style={[banner.iconWrap, { backgroundColor: cfg.color }]}>
        <Ionicons name={cfg.icon as any} size={20} color="#fff" />
      </View>
      <View style={banner.info}>
        <Text style={[banner.level, { color: cfg.color }]}>
          {cfg.label} THREAT
        </Text>
        <Text style={banner.sub}>
          {isInvasive
            ? 'This species is classified as INVASIVE in this region'
            : 'This is a native species — no threat detected'}
        </Text>
      </View>
    </View>
  );
}
const banner = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  level: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
});

// ── Section Component ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sec.container}>
      <View style={sec.header}>
        <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        <Text style={sec.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
const sec = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReportDetailScreen({ report, onBack }: Props) {
  const conf = Math.round(report.confidence * 100);
  const threatCfg = THREAT_CONFIG[report.threatLevel];

  return (
    <View style={s.container}>
      {/* Header image with overlay */}
      <View style={s.imageContainer}>
        <Image source={{ uri: report.imageUri }} style={s.heroImage} />
        <View style={s.imageGradient} />

        {/* Back button */}
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity style={s.shareBtn}>
          <Ionicons name="share-outline" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Species name overlay */}
        <View style={s.heroOverlay}>
          <View style={s.heroInvasiveBadge}>
            <View
              style={[
                s.heroDot,
                { backgroundColor: report.isInvasive ? '#EF4444' : '#0EA5E9' },
              ]}
            />
            <Text
              style={[
                s.heroChipText,
                { color: report.isInvasive ? '#FCA5A5' : '#7DD3FC' },
              ]}
            >
              {report.isInvasive ? 'INVASIVE' : 'NATIVE'}
            </Text>
          </View>
          <Text style={s.heroSpecies}>{report.speciesName}</Text>
          <Text style={s.heroScientific}>{report.scientificName}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Threat banner */}
        <ThreatBanner level={report.threatLevel} isInvasive={report.isInvasive} />

        {/* Quick stats row */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{conf}%</Text>
            <Text style={s.statLabel}>Confidence</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: threatCfg.color }]}>
              {threatCfg.label}
            </Text>
            <Text style={s.statLabel}>Threat Level</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>
              {report.audioUri ? 'Yes' : 'No'}
            </Text>
            <Text style={s.statLabel}>Audio Data</Text>
          </View>
        </View>

        {/* Description */}
        <Section title="About This Species" icon="book-outline">
          <Text style={s.bodyText}>{report.description}</Text>
        </Section>

        {/* Audio Analysis */}
        {report.audioUri && (
          <Section title="Audio Analysis" icon="volume-high-outline">
            <View style={s.audioRow}>
              <View style={s.audioIcon}>
                <Ionicons name="mic" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.audioTitle}>Recording captured</Text>
                <Text style={s.audioDuration}>
                  Duration: {report.audioDuration}s
                </Text>
              </View>
              <TouchableOpacity style={s.playBtn}>
                <Ionicons name="play" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            {report.audioAnalysisComplete ? (
              <View style={s.audioResult}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={s.audioResultText}>
                  {report.audioAnalysisSummary}
                </Text>
              </View>
            ) : (
              <View style={[s.audioResult, { backgroundColor: COLORS.warningLight }]}>
                <Ionicons name="hourglass-outline" size={16} color={COLORS.warning} />
                <Text style={[s.audioResultText, { color: COLORS.warning }]}>
                  Audio analysis pending — will process when ML model is connected
                </Text>
              </View>
            )}
          </Section>
        )}

        {/* Recommendations */}
        <Section title="Recommended Actions" icon="clipboard-outline">
          {report.recommendations.map((rec, i) => (
            <View key={i} style={s.recItem}>
              <View
                style={[
                  s.recBullet,
                  {
                    backgroundColor:
                      i === 0 && report.isInvasive
                        ? '#DC2626'
                        : COLORS.primary,
                  },
                ]}
              >
                <Text style={s.recNumber}>{i + 1}</Text>
              </View>
              <Text style={s.recText}>{rec}</Text>
            </View>
          ))}
        </Section>

        {/* Location */}
        <Section title="Location Details" icon="navigate-outline">
          <View style={s.locRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={s.locName}>{report.locationName}</Text>
          </View>
          <View style={s.locCoords}>
            <Text style={s.coordText}>
              {report.latitude.toFixed(6)}° N, {report.longitude.toFixed(6)}° W
            </Text>
          </View>
          {/* Map placeholder */}
          <View style={s.mapPlaceholder}>
            <Ionicons name="map" size={32} color={COLORS.textDim} />
            <Text style={s.mapPlaceholderText}>Map view coming soon</Text>
          </View>
        </Section>

        {/* Reporter info */}
        <Section title="Reported By" icon="person-outline">
          <View style={s.reporterRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {report.reportedBy.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reporterName}>{report.reportedBy}</Text>
              <Text style={s.reporterEmail}>{report.reporterEmail}</Text>
            </View>
            <Text style={s.reporterTime}>{formatDate(report.timestamp)}</Text>
          </View>
          {report.notes ? (
            <View style={s.notesBox}>
              <Ionicons name="chatbubble-outline" size={14} color={COLORS.textMuted} />
              <Text style={s.notesText}>{report.notes}</Text>
            </View>
          ) : null}
        </Section>

        {/* ── Emergency Contacts ──────────────────────────────────────── */}
        <View style={s.emergencySection}>
          <View style={s.emergencyHeader}>
            <Ionicons name="call" size={18} color="#DC2626" />
            <Text style={s.emergencyTitle}>Emergency Contacts</Text>
          </View>
          <Text style={s.emergencySub}>
            {report.isInvasive
              ? 'Contact the appropriate authority to report this invasive species.'
              : 'For general inquiries, contact your local wildlife service.'}
          </Text>

          <View style={s.contactGrid}>
            {EMERGENCY_CONTACTS.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[s.contactCard, { borderColor: contact.color + '30' }]}
                onPress={() =>
                  contact.id === 'alert-locals'
                    ? triggerAlertLocals(report.speciesName, report.locationName)
                    : makeCall(contact.phone, contact.label)
                }
                activeOpacity={0.8}
              >
                <View style={[s.contactIcon, { backgroundColor: contact.bgColor }]}>
                  <Ionicons name={contact.icon as any} size={22} color={contact.color} />
                </View>
                <Text style={s.contactLabel}>{contact.label}</Text>
                <Text style={s.contactSub} numberOfLines={2}>
                  {contact.subtitle}
                </Text>
                <View style={[s.callChip, { backgroundColor: contact.color }]}>
                  <Ionicons
                    name={contact.id === 'alert-locals' ? 'megaphone' : 'call'}
                    size={12}
                    color="#fff"
                  />
                  <Text style={s.callChipText}>
                    {contact.id === 'alert-locals' ? 'Alert Now' : 'Call Now'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageContainer: {
    height: 280,
    backgroundColor: '#1A202C',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroInvasiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroSpecies: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  heroScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },

  // Body text
  bodyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  // Audio
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  audioIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  audioDuration: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.successLight,
    padding: 12,
    borderRadius: 10,
  },
  audioResultText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  // Recommendations
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  recBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  recNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  recText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },

  // Location
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  locName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  locCoords: {
    marginBottom: 12,
  },
  coordText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.textMuted,
  },
  mapPlaceholder: {
    height: 120,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  mapPlaceholderText: {
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 6,
  },

  // Reporter
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  reporterName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  reporterEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  reporterTime: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Emergency Contacts
  emergencySection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emergencySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 19,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactCard: {
    width: (SCREEN_W - 44) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  contactSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 10,
  },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  callChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
