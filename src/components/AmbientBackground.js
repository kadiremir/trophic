import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const STAR_SPECS = Array.from({ length: 40 }, (_, index) => ({
  key: `star-${index}`,
  left: `${(index * 37 + 13) % 100}%`,
  top: `${(index * 23 + 7) % 45}%`,
  size: index % 3 === 0 ? 2 : 1,
  opacity: 0.2 + (index % 5) * 0.1,
}));

const FIREFLY_SPECS = Array.from({ length: 14 }, (_, index) => ({
  key: `firefly-${index}`,
  left: `${(index * 17 + 11) % 100}%`,
  top: `${(index * 29 + 9) % 100}%`,
  size: 2 + (index % 3),
  duration: 4200 + index * 280,
  delay: index * 190,
  x1: (index % 2 === 0 ? 1 : -1) * (18 + index * 2),
  y1: -22 - (index % 4) * 6,
  x2: (index % 2 === 0 ? -1 : 1) * (10 + index),
  y2: 16 + (index % 3) * 6,
}));

const LEAF_SPECS = Array.from({ length: 6 }, (_, index) => ({
  key: `leaf-${index}`,
  left: `${(index * 17 + 10) % 100}%`,
  width: 8 + (index % 3) * 4,
  height: 8 + (index % 3) * 4,
  duration: 8200 + index * 1400,
  delay: index * 900,
  drift: (index % 2 === 0 ? 1 : -1) * (20 + index * 10),
  spin: 180 + index * 60,
  tint: index % 2 === 0 ? 'rgba(45, 211, 111, 0.28)' : 'rgba(139, 100, 60, 0.28)',
}));

function Firefly({ spec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [progress, spec.delay, spec.duration]);

  return (
    <Animated.View
      style={[
        styles.firefly,
        {
          left: spec.left,
          top: spec.top,
          width: spec.size,
          height: spec.size,
          shadowRadius: spec.size * 3,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, spec.x1, spec.x2],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, spec.y1, spec.y2],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.7, 1.15, 0.8],
              }),
            },
          ],
          opacity: progress.interpolate({
            inputRange: [0, 0.15, 0.5, 0.85, 1],
            outputRange: [0, 0.8, 0.4, 0.7, 0],
          }),
        },
      ]}
    />
  );
}

function FloatingLeaf({ spec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [progress, spec.delay, spec.duration]);

  return (
    <Animated.View
      style={[
        styles.leaf,
        {
          left: spec.left,
          width: spec.width,
          height: spec.height,
          backgroundColor: spec.tint,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spec.drift],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-24, 860],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${spec.spin}deg`],
              }),
            },
          ],
          opacity: progress.interpolate({
            inputRange: [0, 0.08, 0.85, 1],
            outputRange: [0, 0.7, 0.6, 0],
          }),
        },
      ]}
    />
  );
}

export default function AmbientBackground() {
  const fireflies = useMemo(() => FIREFLY_SPECS, []);
  const leaves = useMemo(() => LEAF_SPECS, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#020810', '#051520', '#071a18', '#040d09']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.starLayer}>
        {STAR_SPECS.map((star) => (
          <View
            key={star.key}
            style={[
              styles.star,
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.mountainRange} />
      <View style={styles.midTreeBand}>
        {Array.from({ length: 20 }, (_, index) => {
          const height = 60 + (index % 4) * 25;
          return (
            <View
              key={`tree-mid-${index}`}
              style={[
                styles.midTree,
                {
                  left: index * 42 + (index % 3) * 10,
                  borderLeftWidth: 8,
                  borderRightWidth: 8,
                  borderBottomWidth: height,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.foregroundTreeBand}>
        {Array.from({ length: 18 }, (_, index) => {
          const height = 78 + (index % 5) * 18;
          return (
            <View
              key={`tree-front-${index}`}
              style={[
                styles.foregroundTree,
                {
                  left: `${index * 5.8}%`,
                  height,
                },
              ]}
            />
          );
        })}
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,229,195,0.03)']}
        style={styles.groundFog}
      />

      <View style={styles.fireflyLayer}>
        {fireflies.map((spec) => (
          <Firefly key={spec.key} spec={spec} />
        ))}
      </View>

      <View style={styles.leafLayer}>
        {leaves.map((spec) => (
          <FloatingLeaf key={spec.key} spec={spec} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  mountainRange: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    bottom: '30%',
    height: '28%',
    backgroundColor: 'rgba(10, 26, 20, 0.88)',
    borderTopLeftRadius: 220,
    borderTopRightRadius: 320,
    transform: [{ skewY: '-5deg' }],
  },
  midTreeBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '14%',
    height: '34%',
    opacity: 0.52,
  },
  midTree: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#081a10',
  },
  foregroundTreeBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '28%',
    opacity: 0.74,
  },
  foregroundTree: {
    position: 'absolute',
    bottom: -12,
    width: 18,
    backgroundColor: '#061210',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    transform: [{ rotate: '8deg' }],
  },
  groundFog: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '18%',
  },
  fireflyLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  firefly: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#00e5c3',
    shadowColor: '#00e5c3',
    shadowOpacity: 0.9,
  },
  leafLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  leaf: {
    position: 'absolute',
    top: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    borderBottomLeftRadius: 999,
  },
});
