import React, { useEffect, useRef } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// CSS keyframes converted to px for a 280×64 button.
// Source: trophic-cloud-morph in public/index.html.
// Vertical radii (% × 64) drive the shape; clamped to 32 (half-height).
const MORPH_FRAMES = [
  { tl: 28, tr: 32, br: 24, bl: 32 }, // 0%
  { tl: 32, tr: 28, br: 32, bl: 27 }, // 9%
  { tl: 20, tr: 32, br: 27, bl: 32 }, // 18%
  { tl: 32, tr: 22, br: 32, bl: 23 }, // 27%
  { tl: 31, tr: 32, br: 22, bl: 32 }, // 36%
  { tl: 24, tr: 32, br: 32, bl: 22 }, // 45%
  { tl: 32, tr: 23, br: 29, bl: 32 }, // 54%
  { tl: 22, tr: 32, br: 32, bl: 29 }, // 63%
  { tl: 32, tr: 27, br: 19, bl: 32 }, // 72%
  { tl: 27, tr: 32, br: 32, bl: 24 }, // 81%
  { tl: 32, tr: 24, br: 24, bl: 32 }, // 90%
  { tl: 28, tr: 32, br: 24, bl: 32 }, // 100%
];

const INPUT_RANGE = MORPH_FRAMES.map((_, i) => i / (MORPH_FRAMES.length - 1));

export default function ContinueButton({
  eyebrow,
  levelName,
  subLabel = 'Next Level',
  accent = '#ff9824',
  onPress,
}) {
  // Hooks must be at the top level — before any conditional return.
  const spin = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(morph, { toValue: 1, duration: 7000, useNativeDriver: false })
    ).start();
  }, [spin, morph]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrap}>
        <div className="trophic-continue">
          {!!eyebrow && (
            <div>
              <div className="ctx-eyebrow" style={{ color: accent }}>{eyebrow}</div>
              {!!levelName && <div className="ctx-level-name">{levelName}</div>}
            </div>
          )}
          <div className="cloud-outer">
            <button type="button" className="cloud-btn" onClick={onPress}>
              <span className="cloud-inner">
                <span className="cloud-sub" style={{ color: accent }}>{subLabel}</span>
                <span className="cloud-label">Continue →</span>
              </span>
            </button>
          </div>
        </div>
      </View>
    );
  }

  // ── Native — spinning rainbow border + morphing blob shape ───────────────
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const corner = (key) =>
    morph.interpolate({
      inputRange: INPUT_RANGE,
      outputRange: MORPH_FRAMES.map((f) => f[key]),
    });

  const tlR = corner('tl');
  const trR = corner('tr');
  const brR = corner('br');
  const blR = corner('bl');

  const PILL_H = 64;
  const PILL_W = 280;
  const BORDER = 2.5;
  const GRADIENT_SIZE = Math.sqrt(PILL_W * PILL_W + PILL_H * PILL_H) + 8;

  return (
    <View style={styles.nativeWrap}>
      {!!eyebrow && (
        <>
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          {!!levelName && <Text style={styles.levelName}>{levelName}</Text>}
        </>
      )}

      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {/* Morphing clip container */}
        <Animated.View
          style={[
            styles.clip,
            {
              width: PILL_W,
              height: PILL_H,
              borderTopLeftRadius: tlR,
              borderTopRightRadius: trR,
              borderBottomRightRadius: brR,
              borderBottomLeftRadius: blR,
            },
          ]}
        >
          {/* Spinning rainbow gradient square */}
          <Animated.View
            style={{
              position: 'absolute',
              width: GRADIENT_SIZE,
              height: GRADIENT_SIZE,
              top: (PILL_H - GRADIENT_SIZE) / 2,
              left: (PILL_W - GRADIENT_SIZE) / 2,
              transform: [{ rotate }],
            }}
          >
            <LinearGradient
              colors={['#ff0000', '#ff9900', '#ffff00', '#00e676', '#00ccff', '#9900ff', '#ff0066', '#ff0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </Animated.View>

          {/* Dark inner pill, inset by border width, same morph shape */}
          <Animated.View
            style={[
              styles.btnInner,
              {
                position: 'absolute',
                top: BORDER,
                left: BORDER,
                right: BORDER,
                bottom: BORDER,
                borderTopLeftRadius: tlR,
                borderTopRightRadius: trR,
                borderBottomRightRadius: brR,
                borderBottomLeftRadius: blR,
              },
            ]}
          >
            <Text style={[styles.sub, { color: accent }]}>{subLabel}</Text>
            <Text style={styles.label}>CONTINUE →</Text>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: { paddingHorizontal: 16, marginBottom: 20, alignItems: 'center' },

  nativeWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 5,
    textTransform: 'uppercase',
    fontWeight: '700',
    opacity: 0.65,
  },
  levelName: {
    marginTop: 6,
    fontSize: 20,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 2,
    fontWeight: '700',
  },
  clip: {
    overflow: 'hidden',
    shadowColor: '#aaffaa',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  btnInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#0a130a',
  },
  sub: {
    fontSize: 9,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
});
