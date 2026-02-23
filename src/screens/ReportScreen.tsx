import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import NetInfo from '@react-native-community/netinfo';

import { COLORS } from '../constants';
import { compressImage } from '../services/imageService';
import { predictSpecies, uploadReport } from '../services/apiService';
import { useReports } from '../contexts/ReportsContext';
import { useAuth } from '../contexts/AuthContext';
import { GPSCoordinates, InvasiveReport, PredictResponse } from '../types';
import { generateId } from '../utils/geo';

/* ── Palette ─────────────────────────────────────────────────────────────── */
const DK = {
  bg: '#0D1117',
  surface: '#161B22',
  card: '#1C2333',
  border: 'rgba(255,255,255,0.08)',
  text: '#E6EDF3',
  textMuted: 'rgba(255,255,255,0.50)',
  textDim: 'rgba(255,255,255,0.30)',
  accent: '#2D6A4F',
  accentGlow: 'rgba(45,106,79,0.35)',
  accentLight: '#40916C',
  danger: '#EF4444',
  warn: '#F59E0B',
};

/* ── Large Confidence Ring (review page) ────────────────────────────────── */
function ConfidenceRing({ percent, loading }: { percent: number; loading?: boolean }) {
  const size = 160;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r}
          stroke="#E5E9EF" strokeWidth={sw} fill="transparent" />
        <SvgCircle cx={size / 2} cy={size / 2} r={r}
          stroke="#2D6A4F" strokeWidth={sw} fill="transparent"
          strokeDasharray={`${circ}`} strokeDashoffset={loading ? circ : offset}
          strokeLinecap="round" />
      </Svg>
      <View style={ringS.inner}>
        {loading ? (
          <ActivityIndicator size="small" color="#2D6A4F" />
        ) : (
          <>
            <Text style={ringS.label}>Match Confidence</Text>
            <Text style={ringS.value}>{percent}%</Text>
          </>
        )}
      </View>
    </View>
  );
}
const ringS = StyleSheet.create({
  inner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  label: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 2 },
  value: { fontSize: 40, fontWeight: '700', color: '#1A202C' },
});

/* ── Glowing leaf overlay ───────────────────────────────────────────────── */
function GlowingLeaf() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);
  return (
    <Animated.View style={[glow.wrap, { opacity: pulse }]} pointerEvents="none">
      <View style={glow.ring}>
        <Ionicons name="leaf" size={36} color={DK.accentLight} />
      </View>
    </Animated.View>
  );
}
const glow = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', top: '40%' },
  ring: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: DK.accentGlow,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: DK.accent, shadowOpacity: 0.6, shadowRadius: 24, elevation: 12,
  },
});

type Mode = 'capture' | 'review';

export default function ReportScreen() {
  const { user } = useAuth();
  const { addReport, triggerSync } = useReports();

  /* camera */
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState(false);
  const [proMode, setProMode] = useState(false);

  /* state */
  const [mode, setMode] = useState<Mode>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<GPSCoordinates | null>(null);
  const [speciesName, setSpeciesName] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  /* prediction */
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);

  /* network listener */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOnline(!!s.isConnected));
    return () => unsub();
  }, []);

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const grabLocation = async (): Promise<GPSCoordinates | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
      };
    } catch { return null; }
  };

  const runPrediction = async (uri: string) => {
    const net = await NetInfo.fetch();
    setIsOnline(!!net.isConnected);
    if (!net.isConnected) {
      setPredictionError('No internet. Prediction will run when synced.');
      return;
    }
    setIsPredicting(true);
    setPredictionError(null);
    try {
      const pred = await predictSpecies(uri);
      setPrediction(pred);
      setSpeciesName(pred.species_name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Server unreachable';
      setPredictionError(`Could not identify species: ${msg}`);
    } finally {
      setIsPredicting(false);
    }
  };

  /* ── capture from live camera ────────────────────────────────────────── */
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (!photo) { setIsProcessing(false); return; }
      const compressed = await compressImage(photo.uri);
      setImageUri(compressed.uri);
      const coords = await grabLocation();
      setCoordinates(coords);
      setMode('review');
      runPrediction(compressed.uri);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Capture failed.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /* ── pick from gallery ───────────────────────────────────────────────── */
  const handleGallery = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery access is required.');
        setIsProcessing(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as ImagePicker.MediaType,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) { setIsProcessing(false); return; }
      const compressed = await compressImage(result.assets[0].uri);
      setImageUri(compressed.uri);
      const coords = await grabLocation();
      setCoordinates(coords);
      setMode('review');
      runPrediction(compressed.uri);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /* ── save ─────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!imageUri) {
      Alert.alert('Incomplete', 'Please capture an image first.');
      return;
    }
    setIsProcessing(true);
    try {
      const finalPred = prediction
        ? { ...prediction, species_name: speciesName || prediction.species_name }
        : null;
      const reportId = generateId();
      const report: InvasiveReport = {
        id: reportId,
        imageUri: imageUri ?? '',
        coordinates: coordinates ?? { latitude: 0, longitude: 0 },
        timestamp: new Date().toISOString(),
        notes: notes.trim(),
        prediction: finalPred,
        syncStatus: 'pending',
        userId: user?.id ?? 'anonymous',
      };
      await addReport(report);
      try {
        await uploadReport({
          id: reportId,
          imageUri: imageUri ?? '',
          latitude: coordinates?.latitude ?? 0,
          longitude: coordinates?.longitude ?? 0,
          timestamp: report.timestamp,
          notes: report.notes,
          prediction: finalPred,
          userId: user?.id ?? 'anonymous',
        });
      } catch {
        triggerSync().catch(() => {});
      }
      resetForm();
      Alert.alert('Saved!', 'Report uploaded successfully.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, coordinates, prediction, speciesName, notes, user, addReport, triggerSync]);

  const resetForm = () => {
    setMode('capture');
    setImageUri(null);
    setCoordinates(null);
    setPrediction(null);
    setSpeciesName('');
    setNotes('');
    setIsPredicting(false);
    setPredictionError(null);
  };

  const confidencePercent = prediction ? Math.round(prediction.confidence_score * 100) : 0;

  /* ══════════════════════  CAPTURE MODE  ═══════════════════════════════ */
  if (mode === 'capture') {
    /* Permission gate */
    if (!permission) {
      return (
        <View style={cs.permWrap}>
          <ActivityIndicator size="large" color={DK.accent} />
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <View style={cs.permWrap}>
          <Ionicons name="camera-outline" size={56} color={DK.textMuted} />
          <Text style={cs.permTitle}>Camera Access Needed</Text>
          <Text style={cs.permSub}>Allow Invadr to use your camera to identify species in real time.</Text>
          <TouchableOpacity style={cs.permBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={cs.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={cs.root}>
        {/* ── Live Camera Preview ─────────────────────────────────── */}
        <CameraView
          ref={cameraRef}
          style={cs.camera}
          facing={facing}
          flash={flash ? 'on' : 'off'}
        />

        {/* ── Viewfinder overlay ──────────────────────────────────── */}
        <View style={cs.overlay} pointerEvents="box-none">
          {/* Top bar */}
          <View style={cs.topBar}>
            <TouchableOpacity
              style={cs.topBtn}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[cs.proToggle, proMode && cs.proToggleOn]}
              onPress={() => setProMode(!proMode)}
              activeOpacity={0.8}
            >
              <Text style={[cs.proText, proMode && cs.proTextOn]}>Pro Mode</Text>
            </TouchableOpacity>
          </View>

          {/* Viewfinder corners */}
          <View style={cs.finderWrap} pointerEvents="none">
            <View style={cs.finder}>
              <View style={[cs.corner, cs.tl]} />
              <View style={[cs.corner, cs.tr]} />
              <View style={[cs.corner, cs.bl]} />
              <View style={[cs.corner, cs.br]} />
            </View>
            <GlowingLeaf />
          </View>

          {/* Pro mode extras (flash + gallery) */}
          {proMode && (
            <View style={cs.proRow}>
              <TouchableOpacity style={cs.proBtn} onPress={() => setFlash(!flash)}>
                <Ionicons name={flash ? 'flash' : 'flash-off'} size={20} color="#fff" />
                <Text style={cs.proBtnLabel}>{flash ? 'Flash On' : 'Flash Off'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cs.proBtn} onPress={handleGallery} disabled={isProcessing}>
                <Ionicons name="images-outline" size={20} color="#fff" />
                <Text style={cs.proBtnLabel}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom controls */}
          <View style={cs.bottomWrap}>
            {/* Taxonomy chips */}
            {prediction && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={cs.chipRow}
              >
                {prediction.top_predictions?.slice(0, 3).map((p, i) => (
                  <View key={i} style={cs.chip}>
                    <Text style={cs.chipText}>{p.species_name}</Text>
                  </View>
                ))}
                <View style={[cs.chip, cs.chipAccent]}>
                  <Text style={[cs.chipText, cs.chipAccentText]}>
                    Confidence: {confidencePercent}%
                  </Text>
                </View>
              </ScrollView>
            )}
            {isPredicting && (
              <View style={cs.chipRow}>
                <View style={cs.chip}>
                  <ActivityIndicator size="small" color={DK.accent} />
                  <Text style={cs.chipText}>Identifying...</Text>
                </View>
              </View>
            )}

            {/* Shutter */}
            <View style={cs.shutterRow}>
              <TouchableOpacity
                style={cs.shutterOuter}
                onPress={handleCapture}
                disabled={isProcessing}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={cs.shutterInner} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  /* ══════════════════════  REVIEW MODE  ════════════════════════════════ */
  return (
    <View style={rs.container}>
      {/* Header */}
      <View style={rs.header}>
        <TouchableOpacity onPress={resetForm} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color="#1A202C" />
        </TouchableOpacity>
        <TouchableOpacity
          style={rs.shareBtn}
          onPress={() => {
            Share.share({
              message: `Invadr Sighting: ${speciesName || 'Unknown species'}${coordinates ? ` at ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : ''}`,
            }).catch(() => {});
          }}
        >
          <Ionicons name="share-outline" size={20} color="#4A5568" />
          <Text style={rs.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={rs.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Image card */}
          {imageUri ? (
            <View style={rs.imageCard}>
              <Image source={{ uri: imageUri }} style={rs.image} />
            </View>
          ) : null}

          {/* Confidence card (overlapping image) */}
          <View style={rs.confCard}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <View style={rs.confContent}>
              <ConfidenceRing
                percent={confidencePercent}
                loading={isPredicting}
              />

              {/* Species name below ring */}
              {prediction && !isPredicting ? (
                <Text style={rs.speciesLabel}>{prediction.species_name}</Text>
              ) : isPredicting ? (
                <Text style={rs.speciesLoading}>Identifying species...</Text>
              ) : null}

              {predictionError ? (
                <View style={rs.errorRow}>
                  <Ionicons name="warning" size={16} color="#F59E0B" />
                  <Text style={rs.errorText} numberOfLines={2}>{predictionError}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Fields */}
          <View style={rs.fields}>
            <View style={rs.fieldBox}>
              <Text style={rs.fieldLabel}>Species Name</Text>
              <TextInput
                style={rs.fieldInput}
                value={speciesName}
                onChangeText={setSpeciesName}
                placeholder="Enter species name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={rs.fieldBox}>
              <Text style={rs.fieldLabel}>Notes</Text>
              <TextInput
                style={[rs.fieldInput, { minHeight: 44 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add observations..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom buttons */}
      <View style={rs.bottomBar}>
        <TouchableOpacity
          style={rs.uploadBtn}
          onPress={handleSave}
          disabled={isProcessing || isPredicting}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={rs.uploadBtnText}>Queue for Upload</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={rs.discardBtn} onPress={resetForm} activeOpacity={0.8}>
          <Text style={rs.discardBtnText}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════  CAPTURE STYLES  ══════════════════════════════ */
const cs = StyleSheet.create({
  /* permission gate */
  permWrap: {
    flex: 1, backgroundColor: DK.bg, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, gap: 16,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: DK.text, textAlign: 'center' },
  permSub: { fontSize: 14, color: DK.textMuted, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    backgroundColor: DK.accent, paddingVertical: 14, paddingHorizontal: 36,
    borderRadius: 28, marginTop: 8,
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* main layout */
  root: { flex: 1, backgroundColor: DK.bg },
  camera: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },

  /* top bar */
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 20,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
  },
  proToggle: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  proToggleOn: { backgroundColor: DK.accent, borderColor: DK.accent },
  proText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  proTextOn: { color: '#fff' },

  /* viewfinder */
  finderWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  finder: { width: 260, height: 260 },
  corner: {
    position: 'absolute', width: 32, height: 32,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  /* pro-mode row */
  proRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    paddingVertical: 8,
  },
  proBtn: {
    alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14,
  },
  proBtnLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  /* bottom area */
  bottomWrap: { paddingBottom: 32 },

  /* taxonomy chips */
  chipRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.50)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  chipAccent: { backgroundColor: DK.accentGlow, borderColor: DK.accent },
  chipAccentText: { color: '#fff' },

  /* shutter */
  shutterRow: { alignItems: 'center', paddingBottom: 8 },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: DK.accent,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shutterInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#fff',
  },
});

/* ═══════════════════════  REVIEW STYLES  ═══════════════════════════════ */
const rs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },

  /* header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 20, paddingBottom: 10,
    backgroundColor: '#F7F7F7',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  shareBtnText: { fontSize: 16, fontWeight: '500', color: '#4A5568' },

  scroll: { paddingBottom: 180, paddingHorizontal: 20 },

  /* image card */
  imageCard: {
    width: '100%', height: 340, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#E5E9EF', marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },

  /* frosted confidence card */
  confCard: {
    marginTop: -50, marginHorizontal: 16,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  confContent: {
    paddingVertical: 28, paddingHorizontal: 24,
    alignItems: 'center',
  },
  speciesLabel: {
    fontSize: 20, fontWeight: '700', color: '#1A202C',
    marginTop: 14, textAlign: 'center',
  },
  speciesLoading: {
    fontSize: 14, fontWeight: '500', color: '#9CA3AF',
    marginTop: 10, textAlign: 'center',
  },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: '#6B7280' },

  /* fields */
  fields: { marginTop: 24, gap: 16 },
  fieldBox: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    borderWidth: 1, borderColor: '#E5E9EF',
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginBottom: 4,
  },
  fieldInput: {
    fontSize: 16, fontWeight: '600', color: '#1A202C', padding: 0,
  },

  /* bottom buttons */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    backgroundColor: '#F7F7F7',
  },
  uploadBtn: {
    backgroundColor: '#2D6A4F', borderRadius: 16,
    paddingVertical: 18, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#2D6A4F', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  uploadBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  discardBtn: {
    backgroundColor: '#6B7280', borderRadius: 16,
    paddingVertical: 16, justifyContent: 'center', alignItems: 'center',
  },
  discardBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
