/**
 * Effect 3 — ParticleBurst
 * 12 colored dots scatter in all directions with parabolic arcs (simulated gravity).
 * Score number sits at center briefly then rises.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

const COLORS = ['#FFD700','#FF6040','#60E060','#40C0FF','#E060FF','#FF40A0'];

function buildParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 60 + Math.random() * 50;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 40, // initial upward bias
      gravity: 80 + Math.random() * 60,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 5,
      duration: 700 + Math.random() * 200,
      delay: Math.random() * 60,
    };
  });
}

const Particle = ({ p, isLast, onDone }) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const op = useSharedValue(1);
  const sc = useSharedValue(1);

  useEffect(() => {
    const N = 30;
    const dur = p.duration / N;

    // Approximate parabola: x linear, y = dy*t + 0.5*gravity*t^2
    const xSteps = Array.from({ length: N }, (_, i) =>
      withTiming(p.dx * ((i + 1) / N), { duration: dur, easing: Easing.linear })
    );
    const ySteps = Array.from({ length: N }, (_, i) => {
      const t = (i + 1) / N;
      return withTiming(p.dy * t + 0.5 * p.gravity * t * t * p.duration / 100, {
        duration: dur, easing: Easing.linear,
      });
    });

    tx.value = withDelay(p.delay, withSequence(...xSteps));
    ty.value = withDelay(p.delay, withSequence(...ySteps));
    sc.value = withDelay(p.delay, withSequence(
      withTiming(1.3, { duration: 80 }),
      withTiming(0.3, { duration: p.duration - 80, easing: Easing.in(Easing.quad) }),
    ));
    const doneCb = isLast && onDone
      ? (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }
      : undefined;
    op.value = withDelay(p.delay, withSequence(
      withTiming(1, { duration: p.duration * 0.5 }),
      withTiming(0, { duration: p.duration * 0.5, easing: Easing.in(Easing.quad) }, doneCb),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }));

  return (
    <Animated.View style={[
      styles.dot,
      { width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.color },
      style,
    ]} />
  );
};

const ScoreTag = ({ score }) => {
  const ty = useSharedValue(0);
  const op = useSharedValue(1);
  useEffect(() => {
    ty.value = withTiming(-50, { duration: 700, easing: Easing.out(Easing.cubic) });
    op.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 200 }),
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

export function ParticleBurst({ x, y, score, onDone }) {
  const particles = useMemo(() => buildParticles(12), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {particles.map((p, i) => (
          <Particle key={i} p={p} isLast={i === particles.length - 1} onDone={onDone} />
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
  dot: {
    position: 'absolute',
  },
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
