import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BACKGROUND_IMAGE_PORTRAIT = require('../../assets/backgrounds/forest-night.png');
const BACKGROUND_IMAGE_LANDSCAPE = require('../../assets/backgrounds/forest-night-desktop.png');

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
  const { width, height } = useWindowDimensions();
  const fireflies = useMemo(() => FIREFLY_SPECS, []);
  const leaves = useMemo(() => LEAF_SPECS, []);
  const useLandscapeBackground = width >= 960 && width > height;
  const backgroundImage = useLandscapeBackground ? BACKGROUND_IMAGE_LANDSCAPE : BACKGROUND_IMAGE_PORTRAIT;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={backgroundImage} style={styles.backgroundImage} resizeMode="cover" />

      <LinearGradient
        colors={['rgba(1, 6, 10, 0.52)', 'rgba(3, 16, 22, 0.24)', 'rgba(2, 12, 13, 0.38)', 'rgba(2, 8, 8, 0.58)']}
        locations={[0, 0.28, 0.62, 1]}
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

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,229,195,0.06)']}
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
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
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
