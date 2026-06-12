import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence,
  Easing, runOnJS,
} from 'react-native-reanimated';

function sampleBezier(sx, sy, ctX, ctY, ex, ey, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * ctX + t * t * ex,
    y: mt * mt * sy + 2 * mt * t * ctY + t * t * ey,
  };
}

const FlyChunk = ({ item, sx, sy, isLast, onDone }) => {
  const tx = useSharedValue(sx);
  const ty = useSharedValue(sy);
  const sc = useSharedValue(0);
  const op = useSharedValue(1);

  const ctX = sx + item.ctXOffset;
  const ctY = sy + item.ctYOffset;
  const ex  = sx + item.exOffset;
  const ey  = sy + item.eyOffset;

  React.useEffect(() => {
    const N = 40;
    const frameDur = item.duration / N;

    const xSteps = Array.from({ length: N }, (_, i) => {
      const { x } = sampleBezier(sx, sy, ctX, ctY, ex, ey, (i + 1) / N);
      return withTiming(x, { duration: frameDur, easing: Easing.linear });
    });
    const ySteps = Array.from({ length: N }, (_, i) => {
      const { y } = sampleBezier(sx, sy, ctX, ctY, ex, ey, (i + 1) / N);
      return withTiming(y, { duration: frameDur, easing: Easing.linear });
    });

    tx.value = withDelay(item.delayMs, withSequence(...xSteps));
    ty.value = withDelay(item.delayMs, withSequence(...ySteps));

    if (item.scaleOvershoot) {
      const t1 = item.duration * 0.15;
      const t2 = item.duration * 0.17;
      sc.value = withDelay(item.delayMs, withSequence(
        withTiming(1.55, { duration: t1, easing: Easing.out(Easing.quad) }),
        withTiming(1.0,  { duration: t2, easing: Easing.inOut(Easing.quad) }),
      ));
    } else {
      sc.value = withDelay(item.delayMs,
        withTiming(1, { duration: item.duration * 0.1, easing: Easing.out(Easing.quad) })
      );
    }

    const holdDur = item.duration * item.fadeStart;
    const fadeDur = item.duration * (1 - item.fadeStart);
    const doneCb  = isLast && onDone
      ? (ok) => { 'worklet'; if (ok !== false) runOnJS(onDone)(); }
      : undefined;

    op.value = withDelay(item.delayMs, withSequence(
      withTiming(1, { duration: holdDur, easing: Easing.linear }),
      withTiming(0, { duration: fadeDur, easing: Easing.linear }, doneCb),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value - sx },
      { translateY: ty.value - sy },
      { scale: sc.value },
    ],
    opacity: op.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: sx, top: sy }, style]}>
      <Text style={{
        fontSize:         item.fontSize,
        fontWeight:       item.fontWeight,
        color:            item.color,
        textShadowColor:  item.color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: item.fontSize * 0.35,
      }}>
        {item.text}
      </Text>
    </Animated.View>
  );
};

export function ScoreFlyout({ x, y, score, onDone }) {
  const items = useMemo(() => [
    { text: score, fontSize: 62, fontWeight: '900', color: '#FFD700',
      ctXOffset: 20, ctYOffset: -220, exOffset: 10, eyOffset: -370,
      duration: 1150, delayMs: 0, fadeStart: 0.68, scaleOvershoot: true },
  ], [score]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((item, i) => (
        <FlyChunk
          key={i}
          item={item}
          sx={x}
          sy={y}
          isLast={i === items.length - 1}
          onDone={onDone}
        />
      ))}
    </View>
  );
}
