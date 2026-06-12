/**
 * Effect 5 — SquashGulp
 * The score text performs a cartoony "gulp" sequence:
 * tall-and-thin squeeze → overshoot wide-and-short → snap to normal → shrink to nothing
 * like something being swallowed. Score shows briefly at end then flies up.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

export function SquashGulp({ x, y, score, onDone }) {
  // We show a "bite" circle that squashes/stretches, plus score that pops after
  const scX = useSharedValue(0.4);
  const scY = useSharedValue(2.2);
  const scCircle = useSharedValue(0);
  const opCircle = useSharedValue(0);
  const opScore  = useSharedValue(0);
  const tyScore  = useSharedValue(10);

  useEffect(() => {
    // Squeeze cycle: narrow→wide→normal→gulp
    scX.value = withSequence(
      withTiming(0.4, { duration: 1 }),
      withTiming(1.8, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1.0, { duration: 100, easing: Easing.inOut(Easing.quad) }),
      withTiming(1.3, { duration: 80 }),
      withTiming(0,   { duration: 200, easing: Easing.in(Easing.cubic) }),
    );
    scY.value = withSequence(
      withTiming(2.2, { duration: 1 }),
      withTiming(0.5, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1.0, { duration: 100, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.7, { duration: 80 }),
      withTiming(0,   { duration: 200, easing: Easing.in(Easing.cubic) }),
    );

    // Background circle pops
    scCircle.value = withSequence(
      withTiming(0, { duration: 1 }),
      withTiming(1.4, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withTiming(1.1, { duration: 80 }),
      withTiming(0,   { duration: 280 }),
    );
    opCircle.value = withSequence(
      withTiming(0.6, { duration: 160 }),
      withTiming(0.6, { duration: 80 }),
      withTiming(0,   { duration: 280 }),
    );

    // Score fades in after gulp
    opScore.value = withDelay(380, withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 200 },
        (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    ));
    tyScore.value = withDelay(380, withTiming(-55, {
      duration: 620, easing: Easing.out(Easing.cubic),
    }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scCircle.value }],
    opacity: opCircle.value,
  }));
  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scX.value }, { scaleY: scY.value }],
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tyScore.value }],
    opacity: opScore.value,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Animated.View style={[styles.circle, circleStyle]} />
        <Animated.View style={[styles.emojiWrap, emojiStyle]}>
          <Text style={styles.emoji}>💥</Text>
        </Animated.View>
        <Animated.View style={[styles.scoreWrap, scoreStyle]}>
          <Text style={styles.scoreText}>{score}</Text>
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
  circle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF8020',
  },
  emojiWrap: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 44,
    lineHeight: 50,
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
