import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const DARK_GREEN = '#1B3C28';
const CREAM = '#EAE6D8';
const GOLD = '#C4A84E';
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

// ─── Compass + Leaf Logo ──────────────────────────────────────────────────────

function InvadrLogo({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Compass circle */}
      <Circle cx="40" cy="50" r="28" stroke={CREAM} strokeWidth="2.2" />

      {/* Compass rose – 4-pointed star, north elongated */}
      <Path
        d="M 40 18 L 44.5 43 L 68 50 L 44.5 55 L 40 78 L 35.5 55 L 12 50 L 35.5 43 Z"
        fill={CREAM}
      />

      {/* Leaf – overlaps right side of compass */}
      <Path
        d="M 52 88 C 47 64 56 40 78 16 C 76 40 66 64 58 84 Z"
        fill={CREAM}
      />

      {/* Leaf centre vein */}
      <Path d="M 56 80 Q 60 54 73 24" stroke={DARK_GREEN} strokeWidth="1.6" />

      {/* Leaf side veins */}
      <Path d="M 58 66 Q 63 55 69 42" stroke={DARK_GREEN} strokeWidth="1.1" />
      <Path d="M 56 74 Q 59 66 64 56" stroke={DARK_GREEN} strokeWidth="0.9" />
    </Svg>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onFinish, 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.container}>
      {/* Golden glow at bottom */}
      <View style={s.glowWrap} pointerEvents="none">
        <View style={[s.glow, s.glowOuter]} />
        <View style={[s.glow, s.glowMid]} />
        <View style={[s.glow, s.glowInner]} />
      </View>

      {/* Centre content */}
      <Animated.View
        style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
      >
        <InvadrLogo size={150} />

        <Text style={s.title}>Invadr</Text>
        <Text style={s.subtitle}>Track Nature. Anywhere.</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_GREEN,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },

  /* Typography */
  title: {
    fontSize: 46,
    fontWeight: '300',
    color: CREAM,
    letterSpacing: 6,
    marginTop: 20,
    fontFamily: SERIF,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(234,230,216,0.55)',
    marginTop: 8,
    letterSpacing: 1.2,
    fontStyle: 'italic',
    fontFamily: SERIF,
  },

  /* Golden glow */
  glowWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  glowOuter: {
    width: width * 1.6,
    height: width * 1.1,
    bottom: -(width * 0.6),
    backgroundColor: GOLD,
    opacity: 0.07,
  },
  glowMid: {
    width: width * 1.1,
    height: width * 0.75,
    bottom: -(width * 0.42),
    backgroundColor: GOLD,
    opacity: 0.11,
  },
  glowInner: {
    width: width * 0.65,
    height: width * 0.45,
    bottom: -(width * 0.26),
    backgroundColor: GOLD,
    opacity: 0.18,
  },
});
