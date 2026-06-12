/**
 * Effect 6 — ComboStacker
 * Score flies in from the left, a "COMBO!" banner slides in from the right,
 * they collide at center and the combined display bounces once.
 * (Works for any score — the "combo" framing is always the flavour.)
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withSpring,
  Easing, runOnJS,
} from 'react-native-reanimated';

export function ComboStacker({ x, y, score, onDone }) {
  // Score slides in from left
  const txScore = useSharedValue(-80);
  const opScore = useSharedValue(0);

  // COMBO! slides from right
  const txCombo = useSharedValue(80);
  const opCombo = useSharedValue(0);

  // Center merged display
  const scMerge = useSharedValue(0);
  const opMerge = useSharedValue(0);
  const tyMerge = useSharedValue(0);

  useEffect(() => {
    // Both slide in together
    txScore.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    txCombo.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    opScore.value = withTiming(1, { duration: 200 });
    opCombo.value = withTiming(1, { duration: 200 });

    // After collision — hide both, show merged
    opScore.value = withSequence(
      withTiming(1, { duration: 280 }),
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 80 }),
    );
    opCombo.value = withSequence(
      withTiming(1, { duration: 280 }),
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 80 }),
    );

    scMerge.value = withDelay(340, withSpring(1, { damping: 5, stiffness: 260 }));
    opMerge.value = withDelay(340, withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 220 },
        (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    ));
    tyMerge.value = withDelay(340, withTiming(-45, {
      duration: 720, easing: Easing.out(Easing.cubic),
    }));
  }, []);

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: txScore.value }, { translateY: -22 }],
    opacity: opScore.value,
  }));
  const comboStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: txCombo.value }, { translateY: 16 }],
    opacity: opCombo.value,
  }));
  const mergeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scMerge.value }, { translateY: tyMerge.value }],
    opacity: opMerge.value,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Animated.View style={[styles.row, scoreStyle]}>
          <Text style={styles.scoreText}>{score}</Text>
        </Animated.View>
        <Animated.View style={[styles.row, comboStyle]}>
          <Text style={styles.comboText}>COMBO!</Text>
        </Animated.View>
        <Animated.View style={[styles.mergeWrap, mergeStyle]}>
          <Text style={styles.mergeScore}>{score}</Text>
          <View style={styles.comboBadge}>
            <Text style={styles.comboBadgeText}>✦ COMBO ✦</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  comboText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FF6040',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  mergeWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  mergeScore: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFE040',
    textShadowColor: '#FF6000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  comboBadge: {
    backgroundColor: '#FF4020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: -6,
  },
  comboBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
