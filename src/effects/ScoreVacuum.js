/**
 * Effect 4 — ScoreVacuum
 * Score number starts full-size, then gets rapidly "sucked away" upward:
 * shrinks to nothing while accelerating upward, leaving 3 ghost trails behind.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

const Ghost = ({ delay, offsetY, scaleStart, opacity }) => {
  const ty = useSharedValue(offsetY);
  const op = useSharedValue(0);
  const sc = useSharedValue(scaleStart);
  useEffect(() => {
    op.value = withDelay(delay, withSequence(
      withTiming(opacity, { duration: 80 }),
      withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) }),
    ));
    ty.value = withDelay(delay, withTiming(offsetY - 120, {
      duration: 400, easing: Easing.in(Easing.cubic),
    }));
    sc.value = withDelay(delay, withTiming(0, {
      duration: 400, easing: Easing.in(Easing.cubic),
    }));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }));
  return (
    <Animated.View style={[styles.ghostWrap, style]}>
      <Text style={styles.ghostText}>+</Text>
    </Animated.View>
  );
};

const MainScore = ({ score, onDone }) => {
  const ty = useSharedValue(0);
  const sc = useSharedValue(1.2);
  const op = useSharedValue(0);
  useEffect(() => {
    // Pop in
    sc.value = withSequence(
      withTiming(1.2, { duration: 1 }),
      withTiming(1.0, { duration: 120, easing: Easing.out(Easing.back(2)) }),
      withTiming(1.0, { duration: 200 }),
      withTiming(0,   { duration: 350, easing: Easing.in(Easing.cubic) }),
    );
    op.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 320 }),
      withTiming(0, { duration: 350, easing: Easing.in(Easing.cubic) },
        (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    );
    ty.value = withSequence(
      withTiming(0, { duration: 400 }),
      withTiming(-160, { duration: 350, easing: Easing.in(Easing.cubic) }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }));
  return (
    <Animated.View style={[styles.scoreWrap, style]}>
      <Text style={styles.scoreText}>{score}</Text>
    </Animated.View>
  );
};

export function ScoreVacuum({ x, y, score, onDone }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Ghost delay={320} offsetY={20}  scaleStart={0.7} opacity={0.45} />
        <Ghost delay={440} offsetY={40}  scaleStart={0.45} opacity={0.25} />
        <Ghost delay={560} offsetY={60}  scaleStart={0.2} opacity={0.12} />
        <MainScore score={score} onDone={onDone} />
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
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 54,
    fontWeight: '900',
    color: '#80FFFF',
    textShadowColor: '#00AAFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  ghostWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  ghostText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#80FFFF',
    opacity: 0.5,
  },
});
