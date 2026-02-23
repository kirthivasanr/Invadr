import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Region, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RISK_COLORS } from '../constants';
import { useReports } from '../contexts/ReportsContext';
import { InvasiveReport } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatTimestamp(ts: string): string {
  const d = new Date(ts);
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

/* ── Custom marker icon ────────────────────────────────────────────────── */
function GreenPin() {
  return (
    <View style={pin.wrap}>
      <View style={pin.circle}>
        <Ionicons name="leaf" size={22} color="#fff" />
      </View>
      <View style={pin.tail} />
    </View>
  );
}
const pin = StyleSheet.create({
  wrap: { alignItems: 'center', width: 56, height: 62 },
  circle: {
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

/* ═══════════════════════════════════════════════════════════════════════ */
export default function MapScreen() {
  const { reports, outbreakZones } = useReports();
  const mapRef = useRef<MapView>(null);
  const [selectedReport, setSelectedReport] = useState<InvasiveReport | null>(null);
  const [densityOn, setDensityOn] = useState(false);

  const mappable = useMemo(
    () => reports.filter((r) => r.coordinates != null && !!r.imageUri),
    [reports],
  );

  /* ── actions ─────────────────────────────────────────────────────────── */
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

  /* navigate to the selected pin */
  const flyToReport = useCallback((r: InvasiveReport) => {
    mapRef.current?.animateToRegion(
      {
        latitude: r.coordinates.latitude,
        longitude: r.coordinates.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      600,
    );
  }, []);

  return (
    <View style={s.root}>
      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="hybrid"
        customMapStyle={darkMapStyle}
        onPress={() => setSelectedReport(null)}
      >
        {mappable.map((report) => (
          <Marker
            key={report.id}
            coordinate={report.coordinates}
            tracksViewChanges={false}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedReport(report);
            }}
          >
            <GreenPin />
          </Marker>
        ))}

        {/* Outbreak circles */}
        {densityOn &&
          outbreakZones.map((zone) => (
            <Circle
              key={zone.id}
              center={zone.centerCoordinates}
              radius={zone.radiusKm * 1000}
              fillColor="rgba(74,222,128,0.12)"
              strokeColor="rgba(74,222,128,0.5)"
              strokeWidth={1.5}
            />
          ))}
      </MapView>

      {/* ── Right-side buttons ──────────────────────────────────────── */}
      <View style={s.rightCol}>
        {/* Layers */}
        <TouchableOpacity style={s.circleBtn} onPress={() => {}}>
          <Ionicons name="layers" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Compass / locate */}
        <TouchableOpacity style={s.compassBtn} onPress={centerOnUser}>
          <Ionicons name="compass" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Zoom controls */}
      <View style={s.zoomCol}>
        <TouchableOpacity style={s.zoomBtn} onPress={zoomIn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.zoomDiv} />
        <TouchableOpacity style={s.zoomBtn} onPress={zoomOut}>
          <Ionicons name="remove" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Density Map pill ────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.densityBtn, densityOn && s.densityBtnOn]}
        onPress={() => setDensityOn(!densityOn)}
        activeOpacity={0.85}
      >
        <Ionicons name="color-fill" size={18} color={densityOn ? '#fff' : '#CBD5E1'} />
        <Text style={[s.densityText, densityOn && s.densityTextOn]}>Density Map</Text>
      </TouchableOpacity>

      {/* ── Report popup callout ────────────────────────────────────── */}
      {selectedReport && (
        <View style={s.popup}>
          {/* Frosted card */}
          <View style={s.popupCard}>
            {/* Image */}
            {selectedReport.imageUri ? (
              <Image source={{ uri: selectedReport.imageUri }} style={s.popupImg} />
            ) : (
              <View style={[s.popupImg, s.popupImgPlaceholder]}>
                <Ionicons name="leaf" size={32} color="rgba(74,222,128,0.5)" />
              </View>
            )}

            {/* Bottom row: time + navigate */}
            <View style={s.popupBottom}>
              <Text style={s.popupTime}>{formatTimestamp(selectedReport.timestamp)}</Text>
              <TouchableOpacity
                onPress={() => flyToReport(selectedReport)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="navigate" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Species name label */}
            {selectedReport.prediction?.species_name ? (
              <Text style={s.popupSpecies} numberOfLines={1}>
                {selectedReport.prediction.species_name}
              </Text>
            ) : null}
          </View>

          {/* Speech bubble pointer */}
          <View style={s.popupArrow} />
        </View>
      )}
    </View>
  );
}

/* ════════════════════  Dark map JSON style  ════════════════════════════ */
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

/* ════════════════════  Styles  ═════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117' },

  /* right column: layers + compass */
  rightCol: {
    position: 'absolute', top: 100, right: 16,
    gap: 10,
  },
  circleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(30,40,55,0.85)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  compassBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(20,20,30,0.9)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  /* zoom column */
  zoomCol: {
    position: 'absolute', right: 16, bottom: 180,
    backgroundColor: 'rgba(30,40,55,0.85)',
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  zoomBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  zoomDiv: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* density map pill */
  densityBtn: {
    position: 'absolute', bottom: 28, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(30,48,70,0.80)',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  densityBtnOn: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    borderColor: 'rgba(74,222,128,0.4)',
  },
  densityText: { fontSize: 15, fontWeight: '600', color: '#CBD5E1' },
  densityTextOn: { color: '#fff' },

  /* ── callout popup ────────────────────────────────────────────────── */
  popup: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    alignItems: 'center',
  },
  popupCard: {
    width: SCREEN_W * 0.55,
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
  popupImg: {
    width: '100%', height: SCREEN_W * 0.45,
    resizeMode: 'cover',
  },
  popupImgPlaceholder: {
    backgroundColor: 'rgba(30,48,70,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  popupBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  popupTime: {
    fontSize: 13, fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  popupSpecies: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 14, paddingBottom: 12,
    marginTop: -4,
  },
  popupArrow: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(40,55,75,0.88)',
    marginTop: -1,
  },
});
