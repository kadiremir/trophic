import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withDelay,
  Easing, runOnJS,
} from 'react-native-reanimated';

const GRID = 4;
const CHUNK_DP = 6;
const GRAVITY = 0.18;
const FRICTION = 0.97;
const FRAMES = 40;
const DURATION = 667;

function makeParticles(cx, cy) {
  return Array.from({ length: GRID * GRID }, (_, i) => {
    const row = Math.floor(i / GRID), col = i % GRID;
    const ox = (col - GRID / 2 + 0.5) * CHUNK_DP;
    const oy = (row - GRID / 2 + 0.5) * CHUNK_DP;

    const angle = Math.atan2(oy, ox) + (Math.random() - 0.5) * 1.8;
    const speed = 1.5 + Math.random() * 3.2;
    const vx0 = Math.cos(angle) * speed;
    const vy0 = Math.sin(angle) * speed - (0.5 + Math.random() * 1.5);

    const tx = vx0 * (1 - Math.pow(FRICTION, FRAMES)) / (1 - FRICTION);
    const apexFrame = Math.max(0, -vy0 / GRAVITY);
    let apexY = 0, finalY = 0, v = vy0;
    for (let f = 0; f < FRAMES; f++) {
      v += GRAVITY; finalY += v;
      if (f < apexFrame) apexY = finalY;
    }

    return {
      startX: cx + ox,
      startY: cy + oy,
      tx, ty: finalY,
      apexY, apexFraction: apexFrame / FRAMES,
      vrot: (Math.random() - 0.5) * 14,
      color: `hsl(${28 + Math.random() * 24}, 88%, ${44 + Math.random() * 14}%)`,
    };
  });
}

function PixelChunk({ p, isLast, onDone }) {
  const tX = useSharedValue(0);
  const tY = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    const doneCb = isLast && onDone
      ? (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }
      : undefined;

    tX.value = withTiming(p.tx, {
      duration: DURATION, easing: Easing.out(Easing.cubic),
    });

    tY.value = p.apexFraction > 0.02
      ? withSequence(
          withTiming(p.apexY, {
            duration: DURATION * p.apexFraction,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(p.ty, {
            duration: DURATION * (1 - p.apexFraction),
            easing: Easing.in(Easing.quad),
          })
        )
      : withTiming(p.ty, { duration: DURATION, easing: Easing.in(Easing.quad) });

    rot.value = withTiming(p.vrot * FRAMES, {
      duration: DURATION, easing: Easing.linear,
    });

    opacity.value = withDelay(
      DURATION * 0.35,
      withTiming(0, { duration: DURATION * 0.65, easing: Easing.linear }, doneCb)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tX.value },
      { translateY: tY.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: p.startX - CHUNK_DP / 2,
      top: p.startY - CHUNK_DP / 2,
      width: CHUNK_DP,
      height: CHUNK_DP,
      backgroundColor: p.color,
    }, style]} />
  );
}

export function PixelDisintegrate({ x, y, onDone }) {
  const particles = useMemo(() => makeParticles(x, y), [x, y]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <PixelChunk
          key={i}
          p={p}
          isLast={i === particles.length - 1}
          onDone={onDone}
        />
      ))}
    </View>
  );
}
