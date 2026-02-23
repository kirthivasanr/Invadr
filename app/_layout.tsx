import { Slot, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ReportsProvider } from '../src/contexts/ReportsContext';
import SplashScreen from '../src/screens/SplashScreen';

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Role-based routing: admin → dashboard, user → tabs
      if (user.role === 'admin') {
        router.replace('/(dashboard)' as any);
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Preload Ionicons font before rendering any screens
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn('Failed to load icon fonts:', e);
      }
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  if (showSplash || !fontsLoaded) {
    return (
      <>
        <StatusBar style="light" backgroundColor="#1A3C28" />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <AuthProvider>
      <ReportsProvider>
        <StatusBar style="dark" backgroundColor="#F2F4F7" />
        <AuthGuard />
        <Slot />
      </ReportsProvider>
    </AuthProvider>
  );
}
