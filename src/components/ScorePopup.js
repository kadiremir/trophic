import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

// A floating "+N" that drifts upward and fades out over ~1s.
// Positioned over a grid cell; geometry is supplied by the parent (Grid).
export default function ScorePopup({ pts, x, y, cellSize, color = '#ffd700' }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -cellSize * 0.9],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0.5, 1.15, 1],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  // Bigger eats read as bigger pops.
  const fontSize = pts >= 20 ? 26 : pts >= 8 ? 22 : 18;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          left: x,
          top: y,
          width: cellSize,
          height: cellSize,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={[styles.text, { color, fontSize, textShadowColor: `${color}aa` }]}>
        +{pts}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 'bold',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
