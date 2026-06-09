import React from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PieceIcon from './PieceIcon';

const ENTRIES = [
  { token: 'G', label: 'Grass', accent: '#8ff08c', lat: -0.52, lon: 0.2 },
  { token: 'R', label: 'Rabbit', accent: '#ffd7ef', lat: 0.08, lon: 1.72 },
  { token: 'F', label: 'Fox', accent: '#ffad57', lat: -0.14, lon: 3.44 },
  { token: 'B', label: 'Bear', accent: '#d6b081', lat: 0.62, lon: 4.72 },
  { token: 'D', label: 'Wildfire', accent: '#ffd56f', lat: 0.18, lon: 5.86 },
];

const LED_RING_LAYERS = [
  {
    rotate: '0deg',
    opacity: 0.42,
    top: 'rgba(88, 255, 229, 0.44)',
    right: 'rgba(97, 168, 255, 0.3)',
    bottom: 'rgba(255, 79, 194, 0.26)',
    left: 'rgba(255, 205, 82, 0.5)',
  },
  {
    rotate: '58deg',
    opacity: 0.3,
    top: 'rgba(186, 255, 95, 0.28)',
    right: 'rgba(75, 255, 209, 0.38)',
    bottom: 'rgba(255, 150, 88, 0.24)',
    left: 'rgba(255, 95, 163, 0.3)',
  },
  {
    rotate: '122deg',
    opacity: 0.24,
    top: 'rgba(255, 214, 116, 0.24)',
    right: 'rgba(173, 124, 255, 0.24)',
    bottom: 'rgba(67, 238, 255, 0.22)',
    left: 'rgba(114, 255, 141, 0.26)',
  },
];

function projectPoint(entry, angle, tilt, radiusX, radiusY) {
  const lon = entry.lon + angle;
  const x = Math.cos(entry.lat) * Math.cos(lon);
  const z = Math.cos(entry.lat) * Math.sin(lon);
  const y = Math.sin(entry.lat);

  const yTilted = y * Math.cos(tilt) - z * Math.sin(tilt);
  const zTilted = y * Math.sin(tilt) + z * Math.cos(tilt);

  return {
    x: x * radiusX,
    y: yTilted * radiusY,
    depth: (zTilted + 1) / 2,
  };
}

export default function FoodChainShowcase() {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width - 40, 370);
  const panelHeight = Math.min(268, Math.max(232, Math.round(panelWidth * 0.68)));
  const centerX = panelWidth / 2;
  const centerY = panelHeight * 0.52;
  const radiusX = Math.min(panelWidth * 0.28, 98);
  const radiusY = radiusX * 0.82;
  const [phase, setPhase] = React.useState(0);
  const whirl = React.useRef(new Animated.Value(0)).current;
  const glow = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setPhase(elapsed * 0.24);
    }, 50);

    const whirlLoop = Animated.loop(
      Animated.timing(whirl, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    whirlLoop.start();
    glowLoop.start();

    return () => {
      clearInterval(interval);
      whirlLoop.stop();
      glowLoop.stop();
    };
  }, [glow, whirl]);

  const angle = phase * Math.PI * 2;
  const tilt = -0.42 + Math.sin(phase * 0.7) * 0.08;
  const positioned = ENTRIES.map((entry) => ({
    ...entry,
    point: projectPoint(entry, angle, tilt, radiusX, radiusY),
  })).sort((a, b) => a.point.depth - b.point.depth);

  const ringRotation = (offset) => ({
    transform: [
      {
        rotate: whirl.interpolate({
          inputRange: [0, 1],
          outputRange: [`${offset}deg`, `${offset + 360}deg`],
        }),
      },
    ],
  });

  return (
    <View style={[styles.shell, { width: panelWidth, height: panelHeight }]}>
      <View
        style={[
          styles.globe,
          {
            width: radiusX * 2,
            height: radiusY * 2,
            left: centerX - radiusX,
            top: centerY - radiusY,
          },
        ]}
      >
        <View style={styles.latitudeWide} />
        <View style={styles.latitudeMid} />
        <View style={styles.longitude} />
        <View style={styles.arcTop} />
        <View style={styles.arcBottom} />
      </View>

      {[0, 1, 2].map((ringIndex) => (
        <Animated.View
          key={ringIndex}
          style={[
            styles.whirlRing,
            {
              width: radiusX * (2.05 + ringIndex * 0.16),
              height: radiusY * (1.2 + ringIndex * 0.11),
              left: centerX - (radiusX * (2.05 + ringIndex * 0.16)) / 2,
              top: centerY - (radiusY * (1.2 + ringIndex * 0.11)) / 2,
            },
            ringRotation(ringIndex * 55),
          ]}
        >
          {LED_RING_LAYERS.map((layer, layerIndex) => (
            <View
              key={layerIndex}
              style={[
                styles.whirlRingLayer,
                {
                  opacity: layer.opacity,
                  transform: [{ rotate: layer.rotate }],
                  borderTopColor: layer.top,
                  borderRightColor: layer.right,
                  borderBottomColor: layer.bottom,
                  borderLeftColor: layer.left,
                },
              ]}
            />
          ))}
          <View
            style={[
              styles.whirlRingPulse,
              styles.whirlRingPulsePrimary,
              {
                left: `${20 + ringIndex * 18}%`,
                top: -3 - ringIndex,
              },
            ]}
          />
          <View
            style={[
              styles.whirlRingPulse,
              styles.whirlRingPulseSecondary,
              {
                right: `${16 + ringIndex * 14}%`,
                bottom: -2,
              },
            ]}
          />
        </Animated.View>
      ))}

      {positioned.map((entry) => {
        const size = 42 + entry.point.depth * 16;
        const left = centerX + entry.point.x - size / 2;
        const top = centerY + entry.point.y - size / 2;
        const glowStrength = 0.25 + entry.point.depth * 0.45;

        return (
          <View
            key={entry.token}
            style={[
              styles.marker,
              {
                width: size,
                height: size,
                left,
                top,
                opacity: 0.35 + entry.point.depth * 0.7,
                borderColor: entry.accent,
                backgroundColor: `rgba(248, 251, 246, ${0.42 + entry.point.depth * 0.28})`,
                shadowColor: entry.accent,
                shadowOpacity: glowStrength,
                shadowRadius: 10 + entry.point.depth * 8,
              },
            ]}
          >
            <PieceIcon token={entry.token} size={size * 0.7} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 8,
    marginBottom: 18,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  globe: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(142, 200, 194, 0.42)',
  },
  latitudeWide: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    top: '31%',
    bottom: '31%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(158, 201, 193, 0.22)',
  },
  latitudeMid: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: '4%',
    bottom: '4%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(158, 201, 193, 0.16)',
  },
  longitude: {
    position: 'absolute',
    left: '26%',
    right: '26%',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(158, 201, 193, 0.18)',
  },
  arcTop: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '15%',
    height: '36%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(158, 201, 193, 0.15)',
  },
  arcBottom: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: '15%',
    height: '36%',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(158, 201, 193, 0.12)',
  },
  whirlRing: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whirlRingLayer: {
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
    borderWidth: 1.1,
    borderTopColor: 'rgba(88, 255, 229, 0.44)',
    borderRightColor: 'rgba(97, 168, 255, 0.3)',
    borderBottomColor: 'rgba(255, 79, 194, 0.26)',
    borderLeftColor: 'rgba(255, 205, 82, 0.5)',
  },
  whirlRingPulse: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  whirlRingPulsePrimary: {
    backgroundColor: 'rgba(118, 255, 230, 0.95)',
    shadowColor: '#6dffe8',
    shadowOpacity: 0.8,
    shadowRadius: 9,
  },
  whirlRingPulseSecondary: {
    width: 7,
    height: 7,
    backgroundColor: 'rgba(255, 194, 92, 0.9)',
    shadowColor: '#ffd37a',
    shadowOpacity: 0.75,
    shadowRadius: 7,
  },
  marker: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
  },
});
