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
  const panelHeight = 215;
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
            left: panelWidth / 2 - radiusX,
            top: panelHeight * 0.48 - radiusY,
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
              left: panelWidth / 2 - (radiusX * (2.05 + ringIndex * 0.16)) / 2,
              top: panelHeight * 0.48 - (radiusY * (1.2 + ringIndex * 0.11)) / 2,
            },
            ringRotation(ringIndex * 55),
          ]}
        />
      ))}

      {positioned.map((entry) => {
        const size = 42 + entry.point.depth * 16;
        const left = panelWidth / 2 + entry.point.x - size / 2;
        const top = panelHeight * 0.48 + entry.point.y - size / 2;
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
    borderWidth: 1.1,
    borderColor: 'rgba(138, 243, 228, 0.14)',
    borderLeftColor: 'rgba(255, 203, 93, 0.46)',
    borderRightColor: 'rgba(138, 243, 228, 0.08)',
  },
  marker: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
  },
});
