/**
 * Effect 1 — ComicChomp
 * "CHOMP!" word-art pops in with rotation overshoot + 6 comic impact lines.
 * Score number floats up above it.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withSpring,
  Easing, runOnJS,
} from 'react-native-reanimated';

const LINES = [0, 45, 90, 135, 180, 225, 270, 315];

const ImpactLine = ({ angle, delay }) => {
  const sc = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    sc.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1.4, { duration: 200 }),
      withTiming(0, { duration: 180 }),
    ));
    op.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 280 }),
      withTiming(0, { duration: 180 }),
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { rotate: `${angle}deg` },
      { scaleX: sc.value },
    ],
  }));
  return (
    <Animated.View style={[styles.line, style]} />
  );
};

const ChompWord = ({ onDone }) => {
  const sc  = useSharedValue(0);
  const rot = useSharedValue(-20);
  const op  = useSharedValue(1);
  useEffect(() => {
    sc.value = withSpring(1, { damping: 6, stiffness: 280 });
    rot.value = withSpring(0, { damping: 7, stiffness: 300 });
    op.value = withDelay(620, withSequence(
      withTiming(1, { duration: 160 }),
      withTiming(0, { duration: 200 }, (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: sc.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));
  return (
    <Animated.View style={[styles.chompWrap, style]}>
      <Text style={styles.chomp}>CHOMP!</Text>
    </Animated.View>
  );
};

const ScoreTag = ({ score }) => {
  const ty = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    ty.value = withDelay(80, withTiming(-60, { duration: 500, easing: Easing.out(Easing.cubic) }));
    op.value = withDelay(80, withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 280 }),
      withTiming(0, { duration: 200 }),
    ));
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

export function ComicChomp({ x, y, score, onDone }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        {LINES.map((angle) => (
          <ImpactLine key={angle} angle={angle} delay={0} />
        ))}
        <ChompWord onDone={onDone} />
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
  line: {
    position: 'absolute',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFD700',
    left: -24,
    top: -2.5,
  },
  chompWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chomp: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF4040',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    letterSpacing: 1,
  },
  scoreWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
