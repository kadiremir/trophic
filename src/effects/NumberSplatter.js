/**
 * Effect 9 — NumberSplatter
 * Each character of the score string (" +", "8" etc.) launches in a different
 * direction, spins, then all spring back to center and merge into the full score
 * which floats upward.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withSpring,
  Easing, runOnJS,
} from 'react-native-reanimated';

const SHARD_COLORS = ['#FFD700', '#FF6040', '#40E0FF', '#A0FF60', '#FF40E0'];

const Shard = ({ char, launchX, launchY, rotation, color, returnDelay, isLast, onDone }) => {
  const tx  = useSharedValue(0);
  const ty  = useSharedValue(0);
  const rot = useSharedValue(0);
  const op  = useSharedValue(0);
  const sc  = useSharedValue(1.3);

  useEffect(() => {
    // Phase 1: explode outward
    tx.value = withSequence(
      withTiming(launchX, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(80, withSpring(0, { damping: 12, stiffness: 180 })),
    );
    ty.value = withSequence(
      withTiming(launchY, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(80, withSpring(0, { damping: 12, stiffness: 180 })),
    );
    rot.value = withSequence(
      withTiming(rotation, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(80, withSpring(0, { damping: 10, stiffness: 200 })),
    );
    sc.value = withSequence(
      withTiming(1.3, { duration: 60 }),
      withTiming(0.9, { duration: 160 }),
      withDelay(80, withSpring(1, { damping: 10, stiffness: 220 })),
    );
    op.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 560 }),
      withTiming(0, { duration: 250 },
        isLast
          ? (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }
          : undefined),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
      { scale: sc.value },
    ],
    opacity: op.value,
  }));

  return (
    <Animated.View style={[styles.shard, style]}>
      <Text style={[styles.charText, { color }]}>{char}</Text>
    </Animated.View>
  );
};

export function NumberSplatter({ x, y, score, onDone }) {
  const chars = useMemo(() => {
    const arr = score.split('');
    const count = arr.length;
    return arr.map((char, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const dist  = 48 + Math.random() * 28;
      return {
        char,
        launchX: Math.cos(angle) * dist,
        launchY: Math.sin(angle) * dist,
        rotation: (Math.random() - 0.5) * 80,
        color: SHARD_COLORS[i % SHARD_COLORS.length],
      };
    });
  }, [score]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {chars.map((c, i) => (
          <Shard
            key={i}
            char={c.char}
            launchX={c.launchX}
            launchY={c.launchY}
            rotation={c.rotation}
            color={c.color}
            isLast={i === chars.length - 1}
            onDone={onDone}
          />
        ))}
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
  shard: {
    position: 'absolute',
    alignItems: 'center',
  },
  charText: {
    fontSize: 50,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
