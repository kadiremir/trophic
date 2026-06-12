import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  useFrameCallback, runOnJS,
} from 'react-native-reanimated';

const DURATION_MS  = 950;
const ROTATIONS    = 2.8;
const MAX_RADIUS   = 30;
const ORB_SIZE     = 22;
const TOTAL_FRAMES = Math.ceil((DURATION_MS / 1000) * 60); // ~57 @ 60fps

export function OrbToScore({ sx, sy, tx, ty, arcSide, onLand }) {
  const len = Math.hypot(tx - sx, ty - sy);
  const ctX = sx + (tx - sx) * 0.4 + arcSide * len * 0.22;
  const ctY = sy + (ty - sy) * 0.4 - len * 0.08;

  const orbX   = useSharedValue(sx);
  const orbY   = useSharedValue(sy);
  const orbSc  = useSharedValue(1);
  const glowR  = useSharedValue(14);
  const glowA  = useSharedValue(0.65);
  const frame  = useSharedValue(0);
  const landed = useSharedValue(false);

  useFrameCallback(() => {
    'worklet';
    if (frame.value >= TOTAL_FRAMES) return;
    frame.value += 1;

    const raw = frame.value / TOTAL_FRAMES;
    const e   = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;

    const mt = 1 - e;
    const bx = mt * mt * sx  + 2 * mt * e * ctX + e * e * tx;
    const by = mt * mt * sy  + 2 * mt * e * ctY + e * e * ty;

    const r   = MAX_RADIUS * Math.pow(1 - raw, 1.5);
    const ang = -raw * Math.PI * 2 * ROTATIONS;
    orbX.value  = bx + Math.cos(ang) * r;
    orbY.value  = by + Math.sin(ang) * r;
    orbSc.value = 1 - raw * 0.42;

    if (raw > 0.75) {
      const g = (raw - 0.75) / 0.25;
      glowR.value = 14 + g * 80;
      glowA.value = Math.min(1, 0.65 + g * 1.4);
    }

    if (frame.value >= TOTAL_FRAMES && !landed.value) {
      landed.value = true;
      if (onLand) runOnJS(onLand)();
    }
  });

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: orbX.value - sx },
      { translateY: orbY.value - sy },
      { scale: orbSc.value },
    ],
    shadowRadius: glowR.value,
    shadowOpacity: glowA.value,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{
        position: 'absolute',
        left: sx - ORB_SIZE / 2,
        top:  sy - ORB_SIZE / 2,
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: ORB_SIZE / 2,
        backgroundColor: '#D06800',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }, orbStyle]}>
        {/* Highlight dot for radial-gradient approximation */}
        <View style={styles.orbHighlight} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbHighlight: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,230,120,0.75)',
  },
});
