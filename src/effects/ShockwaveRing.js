/**
 * Effect 2 — ShockwaveRing
 * Two concentric rings expand outward from the eat point.
 * Score text fades in and drifts up.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

const Ring = ({ delay, color, maxRadius, thickness }) => {
  const r  = useSharedValue(10);
  const op = useSharedValue(0.9);
  useEffect(() => {
    r.value  = withDelay(delay, withTiming(maxRadius, { duration: 500, easing: Easing.out(Easing.cubic) }));
    op.value = withDelay(delay, withSequence(
      withTiming(0.9, { duration: 60 }),
      withTiming(0, { duration: 440, easing: Easing.in(Easing.quad) }),
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    width:  r.value * 2,
    height: r.value * 2,
    borderRadius: r.value,
    borderWidth: thickness,
    borderColor: color,
    opacity: op.value,
    marginLeft: -r.value,
    marginTop:  -r.value,
  }));
  return <Animated.View style={[styles.ring, style]} />;
};

const ScoreTag = ({ score, onDone }) => {
  const ty = useSharedValue(8);
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(1, { duration: 450 }),
      withTiming(0, { duration: 250 }, (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }),
    );
    ty.value = withTiming(-55, { duration: 800, easing: Easing.out(Easing.cubic) });
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

export function ShockwaveRing({ x, y, score, onDone }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.anchor, { left: x, top: y }]}>
        <Ring delay={0}   color="#FFD700" maxRadius={55} thickness={4} />
        <Ring delay={120} color="#FF9020" maxRadius={75} thickness={2.5} />
        <Ring delay={240} color="#FF4020" maxRadius={90} thickness={1.5} />
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
  ring: {
    position: 'absolute',
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
