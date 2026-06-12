/**
 * Effect 10 — ConfettiBurst
 * 16 small colored rectangles explode outward with rotation, then fall with gravity.
 * Score text rises cleanly through the shower.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

const CONFETTI_COLORS = [
  '#FF4040','#FF9020','#FFE000','#40D040',
  '#40A0FF','#A040FF','#FF40A0','#40FFFF',
];

function buildConfetti(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 55 + Math.random() * 55;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 30,
      gravity: 120 + Math.random() * 80,
      rot: (Math.random() - 0.5) * 720,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 8 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      duration: 750 + Math.random() * 250,
      delay: Math.random() * 80,
    };
  });
}

const Piece = ({ p, isLast, onDone }) => {
  const tx  = useSharedValue(0);
  const ty  = useSharedValue(0);
  const rot = useSharedValue(0);
  const op  = useSharedValue(1);

  useEffect(() => {
    const N = 30;
    const dur = p.duration / N;

    const xSteps = Array.from({ length: N }, (_, i) =>
      withTiming(p.dx * ((i + 1) / N), { duration: dur, easing: Easing.linear })
    );
    const ySteps = Array.from({ length: N }, (_, i) => {
      const t = (i + 1) / N;
      return withTiming(p.dy * t + 0.5 * p.gravity * t * t * p.duration / 100, {
        duration: dur, easing: Easing.linear,
      });
    });
    const rotSteps = Array.from({ length: N }, (_, i) =>
      withTiming(p.rot * ((i + 1) / N), { duration: dur, easing: Easing.linear })
    );

    tx.value  = withDelay(p.delay, withSequence(...xSteps));
    ty.value  = withDelay(p.delay, withSequence(...ySteps));
    rot.value = withDelay(p.delay, withSequence(...rotSteps));
    const doneCb = isLast && onDone
      ? (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }
      : undefined;
    op.value = withDelay(p.delay, withSequence(
      withTiming(1, { duration: p.duration * 0.55 }),
      withTiming(0, { duration: p.duration * 0.45, easing: Easing.in(Easing.quad) }, doneCb),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: op.value,
  }));

  return (
    <Animated.View style={[
      styles.piece,
      { width: p.w, height: p.h, backgroundColor: p.color },
      style,
    ]} />
  );
};

const ScoreTag = ({ score }) => {
  const ty = useSharedValue(10);
  const op = useSharedValue(0);
  useEffect(() => {
    ty.value = withTiming(-60, { duration: 750, easing: Easing.out(Easing.cubic) });
    op.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 230 }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));
  return (
    <Animated.View style={[styles.scoreWrap, style]}>
      <Text style={styles.scoreText}>{score}</Text>
    </Animated.View>
  );
};

export function ConfettiBurst({ x, y, score, onDone }) {
  const pieces = useMemo(() => buildConfetti(16), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {pieces.map((p, i) => (
          <Piece key={i} p={p} isLast={i === pieces.length - 1} onDone={onDone} />
        ))}
        <ScoreTag score={score} />
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
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
