/**
 * Effect 8 — ScreenFlash
 * A white radial flash expands from the eat point (hit-stop feel),
 * then immediately contracts while the score number drops in from above with a bounce.
 * Punchy, arcade-style "hit" feedback.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withSpring,
  Easing, runOnJS,
} from 'react-native-reanimated';

export function ScreenFlash({ x, y, score, onDone }) {
  const flashSc = useSharedValue(0);
  const flashOp = useSharedValue(0);
  const scoreTy = useSharedValue(-50);
  const scoreSc = useSharedValue(0);
  const scoreOp = useSharedValue(0);

  useEffect(() => {
    // Flash expands then collapses
    flashSc.value = withSequence(
      withTiming(2.2, { duration: 100, easing: Easing.out(Easing.cubic) }),
      withTiming(0,   { duration: 300, easing: Easing.in(Easing.quad) }),
    );
    flashOp.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) }),
    );

    // Score drops in from above
    scoreTy.value = withDelay(80, withSpring(0, { damping: 8, stiffness: 200 }));
    scoreSc.value = withDelay(80, withSpring(1, { damping: 7, stiffness: 260 }));
    scoreOp.value = withDelay(80, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 480 }),
      withTiming(0, { duration: 280 },
        (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    ));
  }, []);

  const flashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flashSc.value }],
    opacity: flashOp.value,
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scoreTy.value }, { scale: scoreSc.value }],
    opacity: scoreOp.value,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Animated.View style={[styles.flash, flashStyle]} />
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
  flash: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#4040FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
});
