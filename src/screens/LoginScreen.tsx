import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS } from '../constants';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [homeLatitude, setHomeLatitude] = useState<number | undefined>();
  const [homeLongitude, setHomeLongitude] = useState<number | undefined>();
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      Alert.alert('Missing Fields', 'Please fill in name, email and password.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Missing Fields', 'Please enter your phone number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        home_location: homeLocation || undefined,
        home_latitude: homeLatitude,
        home_longitude: homeLongitude,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const detectHomeLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your home location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setHomeLatitude(latitude);
      setHomeLongitude(longitude);
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const parts = [
          place.name,
          place.street,
          place.city || place.subregion,
          place.region,
          place.country,
        ].filter(Boolean);
        setHomeLocation(parts.join(', '));
      } else {
        setHomeLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      Alert.alert('Location Error', 'Could not detect location. Please try again.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const switchMode = () => {
    setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setName('');
    setPhone('');
    setHomeLocation('');
    setHomeLatitude(undefined);
    setHomeLongitude(undefined);
    setShowPassword(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.container}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.inner}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Ionicons name="leaf" size={40} color={COLORS.primary} />
            </View>
            <Text style={s.title}>Invadr</Text>
            <Text style={s.subtitle}>Invasive Species Reporter</Text>
          </View>

          {/* Mode toggle */}
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeTab, authMode === 'login' && s.modeTabActive]}
              onPress={() => setAuthMode('login')}
            >
              <Text style={[s.modeTabText, authMode === 'login' && s.modeTabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeTab, authMode === 'register' && s.modeTabActive]}
              onPress={() => setAuthMode('register')}
            >
              <Text style={[s.modeTabText, authMode === 'register' && s.modeTabTextActive]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={s.form}>
            {authMode === 'register' && (
              <>
                <Text style={s.label}>Full Name</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textDim} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="John Doe"
                    placeholderTextColor={COLORS.textDim}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <Text style={s.label}>Phone Number</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="call-outline" size={18} color={COLORS.textDim} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 234 567 8900"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                  />
                </View>

                <Text style={s.label}>Home Location</Text>
                <TouchableOpacity
                  style={[s.inputWrap, s.locationWrap]}
                  onPress={detectHomeLocation}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={homeLocation ? COLORS.primary : COLORS.textDim}
                    style={s.inputIcon}
                  />
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ flex: 1 }} />
                  ) : (
                    <Text
                      style={[s.locationText, homeLocation && s.locationTextSet]}
                      numberOfLines={2}
                    >
                      {homeLocation || 'Tap to detect current location'}
                    </Text>
                  )}
                  {!detectingLocation && (
                    <Ionicons
                      name={homeLocation ? 'checkmark-circle' : 'navigate'}
                      size={18}
                      color={homeLocation ? '#16A34A' : COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
                {homeLocation ? (
                  <TouchableOpacity onPress={() => { setHomeLocation(''); setHomeLatitude(undefined); setHomeLongitude(undefined); }}>
                    <Text style={s.clearLocation}>✕ Clear location</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}

            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textDim} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="field.worker@example.com"
                placeholderTextColor={COLORS.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={authMode === 'register' ? 'Min 6 characters' : 'Enter password'}
                placeholderTextColor={COLORS.textDim}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textDim}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.button, loading && s.buttonDisabled]}
              onPress={authMode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Test credentials hint */}
          {authMode === 'login' && (
            <View style={s.testCreds}>
              <Text style={s.testCredsTitle}>Test Credentials</Text>
              <Text style={s.testCredsLine}>
                User: user@invadr.io / user123
              </Text>
              <Text style={s.testCredsLine}>
                Admin: admin@invadr.io / admin123
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={switchMode} style={s.switchBtn}>
            <Text style={s.switchText}>
              {authMode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>

          <Text style={s.footer}>
            Reports are stored offline and synced when connectivity is available.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 32, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 32 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 34, fontWeight: '800', color: COLORS.primary, letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14, color: COLORS.textMuted, marginTop: 4, letterSpacing: 0.5,
  },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
  },
  modeTabText: {
    fontSize: 14, fontWeight: '600', color: COLORS.textMuted,
  },
  modeTabTextActive: {
    color: '#fff',
  },

  form: { gap: 4 },
  label: {
    fontSize: 12, fontWeight: '600', color: COLORS.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16, color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  testCreds: {
    marginTop: 20,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  testCredsTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.primary,
    letterSpacing: 1, marginBottom: 6,
  },
  testCredsLine: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 20,
  },

  switchBtn: { alignItems: 'center', marginTop: 20 },
  switchText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  locationWrap: {
    paddingVertical: 12,
    alignItems: 'flex-start',
    minHeight: 50,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDim,
    lineHeight: 20,
  },
  locationTextSet: {
    color: COLORS.text,
    fontWeight: '500',
  },
  clearLocation: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },

  footer: {
    marginTop: 24, textAlign: 'center',
    fontSize: 12, color: COLORS.textDim, lineHeight: 18,
  },
});
