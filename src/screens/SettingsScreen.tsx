import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { useAuth } from '../contexts/AuthContext';

type TransmissionMode = 'Auto' | 'Low Band' | 'Manual';

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [transmissionMode, setTransmissionMode] = useState<TransmissionMode>('Auto');


  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroller}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings & Preferences</Text>
      </View>
      <View style={s.divider} />

      {/* PROFILE */}
      <Text style={s.sectionLabel}>PROFILE</Text>
      <View style={s.card}>
        {/* Avatar row */}
        <View style={s.profileHero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{user?.name ?? '—'}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeText}>
                {user?.role === 'admin' ? '⚙ Admin' : '🌿 Field Worker'}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.separator} />
        {/* Email */}
        <View style={s.profileRow}>
          <View style={s.iconBox}>
            <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileFieldLabel}>Email</Text>
            <Text style={s.profileFieldValue}>{user?.email ?? '—'}</Text>
          </View>
        </View>
        <View style={s.separator} />
        {/* Phone */}
        <View style={s.profileRow}>
          <View style={s.iconBox}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileFieldLabel}>Phone Number</Text>
            <Text style={s.profileFieldValue}>
              {user?.phone ?? 'Not set'}
            </Text>
          </View>
        </View>
        <View style={s.separator} />
        {/* Home Location */}
        <View style={s.profileRow}>
          <View style={s.iconBox}>
            <Ionicons name="home-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileFieldLabel}>Home Location</Text>
            <Text style={s.profileFieldValue} numberOfLines={2}>
              {user?.home_location ?? 'Not set'}
            </Text>
            {user?.home_latitude && (
              <Text style={s.profileCoords}>
                {user.home_latitude.toFixed(5)}, {user.home_longitude?.toFixed(5)}
              </Text>
            )}
          </View>
          <Ionicons name="location" size={16} color={COLORS.primary} />
        </View>
      </View>

      {/* DISPLAY */}
      <Text style={s.sectionLabel}>DISPLAY</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="moon" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.rowLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
          />
        </View>
        <View style={s.separator} />
        <TouchableOpacity style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="text" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.rowLabel}>Text Size</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </TouchableOpacity>
      </View>

      {/* CONNECTIVITY */}
      <Text style={s.sectionLabel}>CONNECTIVITY</Text>
      <View style={s.card}>
        <View style={s.rowVert}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <View style={s.iconBox}>
              <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={s.rowLabel}>Transmission Mode</Text>
              <Text style={s.rowSub}>Control how field data is uploaded</Text>
            </View>
          </View>
          <View style={s.segmented}>
            {(['Auto', 'Low Band', 'Manual'] as TransmissionMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  s.segBtn,
                  transmissionMode === mode && s.segBtnActive,
                ]}
                onPress={() => setTransmissionMode(mode)}
              >
                <Text
                  style={[
                    s.segText,
                    transmissionMode === mode && s.segTextActive,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>
            * Low Bandwidth mode optimizes data packets for satellite or weak radio connections.
          </Text>
        </View>
      </View>

      {/* INFORMATION */}
      <Text style={s.sectionLabel}>INFORMATION</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="information-circle" size={18} color={COLORS.primary} />
          </View>
          <Text style={[s.rowLabel, { flex: 1 }]}>About Invadr</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </TouchableOpacity>
        <View style={s.separator} />
        <TouchableOpacity style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
          </View>
          <Text style={[s.rowLabel, { flex: 1 }]}>Data Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </TouchableOpacity>
        <View style={s.separator} />
        <TouchableOpacity style={s.row}>
          <View style={s.iconBox}>
            <Ionicons name="code-slash" size={18} color={COLORS.primary} />
          </View>
          <Text style={[s.rowLabel, { flex: 1 }]}>Licenses</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={s.signOutBtn} onPress={signOut} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerVersion}>Version 1.0.0 (Build 1)</Text>
        <Text style={s.footerTag}>DESIGNED FOR FIELD RESEARCH</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroller: { paddingBottom: 40 },

  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, paddingHorizontal: 20, marginTop: 24, marginBottom: 10,
  },

  // ── Profile Card ──
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  profileFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  profileFieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 20,
  },
  profileCoords: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  rowVert: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 52 },

  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 3,
    marginTop: 8,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  segTextActive: { color: COLORS.text },
  hint: {
    fontSize: 12, fontStyle: 'italic', color: COLORS.textDim,
    marginTop: 10, lineHeight: 18,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },

  footer: { alignItems: 'center', marginTop: 28, gap: 4 },
  footerVersion: { fontSize: 13, color: COLORS.textDim },
  footerTag: {
    fontSize: 11, fontWeight: '600', color: COLORS.textDim,
    letterSpacing: 1.5,
  },
});
