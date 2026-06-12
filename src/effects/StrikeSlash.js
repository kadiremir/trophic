/**
 * Effect 7 — StrikeSlash
 * Two crossing diagonal slash marks sweep across the cell (like a sword strike),
 * then the score number drops in and bounces.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withSpring,
  Easing, runOnJS,
} from 'react-native-reanimated';

const Slash = ({ rotation, delay, color }) => {
  const sc  = useSharedValue(0);
  const op  = useSharedValue(0);
  useEffect(() => {
    sc.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180 }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
    ));
    op.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(0.8, { duration: 260 }),
      withTiming(0, { duration: 200 }),
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ rotate: rotation }, { scaleX: sc.value }],
  }));
  return (
    <Animated.View style={[styles.slash, { backgroundColor: color }, style]} />
  );
};

const ScoreTag = ({ score, onDone }) => {
  const ty = useSharedValue(-30);
  const sc = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    sc.value = withDelay(140, withSpring(1, { damping: 7, stiffness: 280 }));
    ty.value = withDelay(140, withSpring(0, { damping: 8, stiffness: 250 }));
    op.value = withDelay(140, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 220 },
        (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    ));
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

export function StrikeSlash({ x, y, score, onDone }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Slash rotation="45deg"  delay={0}   color="#FFD700" />
        <Slash rotation="-45deg" delay={60}  color="#FF8040" />
        <ScoreTag score={score} onDone={onDone} />
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
  slash: {
    position: 'absolute',
    width: 90,
    height: 8,
    borderRadius: 4,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: '#FF4000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
