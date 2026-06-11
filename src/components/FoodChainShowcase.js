import React from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import heroBearAnimation from '../../assets/hero_bear.json';
import heroRabbitAnimation from '../../assets/hero_rabbit.json';
import heroGrassAnimation from '../../assets/hero_grass.json';
import heroFoxAnimation from '../../assets/hero_fox.json';
import heroWolfAnimation from '../../assets/hero_wolf.json';
import heroDinoAnimation from '../../assets/hero_dino_1.json';
import LottieAnimation from './LottieAnimation';
import PieceIcon from './PieceIcon';

const ENTRIES = [
  { token: 'G', label: 'Grass', accent: '#8ff08c', lat: -0.62, lon: 0.16, size: 0.8 },
  { token: 'R', label: 'Rabbit', accent: '#ffd7ef', lat: 0.02, lon: 1.14, size: 0.94 },
  { token: 'F', label: 'Fox', accent: '#ffad57', lat: -0.2, lon: 2.42, size: 1.12 },
  { token: 'W', label: 'Wolf', accent: '#b9d1ff', lat: 0.04, lon: 3.5, size: 1.04 },
  { token: 'B', label: 'Bear', accent: '#d6b081', lat: 0.56, lon: 4.6, size: 0.92 },
  { token: 'D', label: 'Dinosaur', accent: '#a8f1dc', lat: 0.24, lon: 5.62, size: 0.86 },
];

const COMET_STREAKS = [
  { length: 1.2, thickness: 0.04, offset: -0.4, drift: -8, opacity: 0.16 },
  { length: 1.36, thickness: 0.03, offset: 0.5, drift: 9, opacity: 0.14 },
  { length: 1.55, thickness: 0.022, offset: 0, drift: 0, opacity: 0.12 },
];

const ORBIT_RINGS = [
  { scale: 1.18, height: 0.74, opacity: 0.34, color: 'rgba(178, 236, 226, 0.34)', spin: 0.18, offset: 2 },
  { scale: 1.36, height: 0.9, opacity: 0.2, color: 'rgba(255, 213, 111, 0.28)', spin: -0.14, offset: -18 },
  { scale: 1.54, height: 1.04, opacity: 0.16, color: 'rgba(134, 219, 255, 0.24)', spin: 0.1, offset: 32 },
];

const ORBIT_SPARKS = [
  { radius: 1.22, size: 6, phase: 0.18, color: '#fff1b8' },
  { radius: 1.5, size: 4, phase: 2.36, color: '#b9fff4' },
  { radius: 1.34, size: 3, phase: 4.44, color: '#fff8df' },
];

const GLASS_SPARKLES = [
  { left: '27%', top: '20%', size: 2, opacity: 0.48 },
  { left: '68%', top: '28%', size: 1.5, opacity: 0.32 },
  { left: '76%', top: '58%', size: 2, opacity: 0.24 },
  { left: '34%', top: '72%', size: 1.5, opacity: 0.26 },
];

function colorWithAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function projectPoint(entry, angle, tilt, radiusX, radiusY) {
  const lon = entry.lon + angle;
  const x = Math.cos(entry.lat) * Math.cos(lon);
  const z = Math.cos(entry.lat) * Math.sin(lon);
  const y = Math.sin(entry.lat);

  const yTilted = y * Math.cos(tilt) - z * Math.sin(tilt);
  const zTilted = y * Math.sin(tilt) + z * Math.cos(tilt);
  const depth = (zTilted + 1) / 2;
  const perspective = 0.82 + depth * 0.28;

  return {
    x: x * radiusX * perspective,
    y: yTilted * radiusY * perspective + depth * radiusY * 0.18,
    depth,
    rawX: x,
    rawY: yTilted,
    rawZ: zTilted,
  };
}

function GlassOrb({ entry, size, phase }) {
  const depth = entry.point.depth;
  const yaw = -entry.point.rawX * 18 + Math.sin(phase * Math.PI * 2 + entry.lon) * 6;
  const pitch = entry.point.rawY * 10 - 4;
  const characterSize = size * (entry.token === 'G' ? 0.56 : 0.72);
  const floorWidth = size * 0.7;
  const floorHeight = size * 0.18;

  return (
    <View
      style={[
        styles.sphere,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colorWithAlpha(entry.accent, 0.44 + depth * 0.3),
          backgroundColor: colorWithAlpha(entry.accent, 0.04 + depth * 0.04),
          shadowColor: entry.accent,
          shadowOpacity: 0.22 + depth * 0.34,
          shadowRadius: 14 + depth * 15,
          transform: [
            { perspective: 900 },
            { rotateY: `${yaw}deg` },
            { rotateX: `${pitch}deg` },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.38)',
          colorWithAlpha(entry.accent, 0.18),
          'rgba(105, 194, 211, 0.1)',
          'rgba(6, 19, 20, 0.34)',
        ]}
        locations={[0, 0.18, 0.58, 1]}
        start={{ x: 0.14, y: 0.04 }}
        end={{ x: 0.86, y: 0.96 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2 }]}
      />

      <View
        style={[
          styles.innerShadow,
          {
            borderRadius: size / 2,
            borderColor: colorWithAlpha(entry.accent, 0.2 + depth * 0.14),
          },
        ]}
      />

      <LinearGradient
        colors={[
          colorWithAlpha(entry.accent, 0),
          colorWithAlpha(entry.accent, 0.38),
          'rgba(255,255,255,0.38)',
          colorWithAlpha(entry.accent, 0),
        ]}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.orbFloor,
          {
            width: floorWidth,
            height: floorHeight,
            left: (size - floorWidth) / 2,
            bottom: size * 0.13,
            borderRadius: floorHeight,
          },
        ]}
      />

      <View
        style={[
          styles.characterPlate,
          {
            width: characterSize * 1.12,
            height: characterSize * 1.12,
            left: (size - characterSize * 1.12) / 2,
            bottom: size * 0.08,
            shadowColor: entry.accent,
            transform: [
              { perspective: 900 },
              { rotateY: `${-yaw * 0.55}deg` },
              { translateY: depth * -2 },
            ],
          },
        ]}
      >
        {entry.token === 'B' ? (
          <LottieAnimation
            source={heroBearAnimation}
            autoPlay={true}
            loop={true}
            style={styles.bearAnimation}
          />
        ) : entry.token === 'R' ? (
          <LottieAnimation
            source={heroRabbitAnimation}
            autoPlay={true}
            loop={true}
            style={styles.bearAnimation}
          />
        ) : entry.token === 'G' ? (
          <LottieAnimation
            source={heroGrassAnimation}
            autoPlay={true}
            loop={true}
            style={styles.grassAnimation}
          />
        ) : entry.token === 'F' ? (
          <LottieAnimation
            source={heroFoxAnimation}
            autoPlay={true}
            loop={true}
            style={styles.bearAnimation}
          />
        ) : entry.token === 'W' ? (
          <LottieAnimation
            source={heroWolfAnimation}
            autoPlay={true}
            loop={true}
            style={styles.wolfAnimation}
          />
        ) : entry.token === 'D' ? (
          <LottieAnimation
            source={heroDinoAnimation}
            autoPlay={true}
            loop={true}
            style={styles.dinoAnimation}
          />
        ) : (
          <PieceIcon token={entry.token} size={characterSize} />
        )}
      </View>

      {GLASS_SPARKLES.map((sparkle, index) => (
        <View
          key={index}
          style={[
            styles.glassSparkle,
            {
              left: sparkle.left,
              top: sparkle.top,
              width: sparkle.size,
              height: sparkle.size,
              opacity: sparkle.opacity + depth * 0.16,
            },
          ]}
        />
      ))}

      <LinearGradient
        colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.mainHighlight,
          {
            width: size * 0.5,
            height: size * 0.22,
            borderRadius: size * 0.25,
            left: size * 0.14,
            top: size * 0.1,
          },
        ]}
      />

      <View
        style={[
          styles.arcHighlight,
          {
            width: size * 0.6,
            height: size * 0.38,
            left: size * 0.08,
            top: size * 0.06,
            borderTopColor: 'rgba(255,255,255,0.62)',
            borderLeftColor: 'rgba(255,255,255,0.22)',
          },
        ]}
      />

      <View
        style={[
          styles.rim,
          {
            borderRadius: size / 2,
            borderColor: 'rgba(245, 255, 252, 0.34)',
          },
        ]}
      />
      <View
        style={[
          styles.lowerRim,
          {
            left: size * 0.16,
            right: size * 0.16,
            bottom: size * 0.12,
            height: size * 0.18,
            borderBottomColor: colorWithAlpha(entry.accent, 0.44 + depth * 0.24),
          },
        ]}
      />
    </View>
  );
}

export default function FoodChainShowcase({ active = true, containerWidth }) {
  const { width } = useWindowDimensions();
  const effectiveWidth = containerWidth || width;
  const isWide = effectiveWidth >= 720;
  const panelWidth = Math.min(effectiveWidth - 32, isWide ? 900 : 420);
  const panelHeight = Math.min(250, Math.max(210, Math.round(panelWidth * (isWide ? 0.4 : 0.52))));
  const centerX = panelWidth / 2;
  const centerY = panelHeight * 0.46;
  const radiusX = Math.min(panelWidth * (isWide ? 0.39 : 0.32), isWide ? 350 : 128);
  const radiusY = Math.min(panelHeight * 0.34, 76);
  const [phase, setPhase] = React.useState(0);
  const activeRef = React.useRef(active);
  activeRef.current = active;

  React.useEffect(() => {
    let frame;
    const start = Date.now();
    let offset = 0;
    let pauseStart = 0;
    const tick = () => {
      if (activeRef.current) {
        if (pauseStart > 0) {
          offset += Date.now() - pauseStart;
          pauseStart = 0;
        }
        const elapsed = (Date.now() - start - offset) / 1000;
        setPhase(elapsed * 0.115);
      } else if (pauseStart === 0) {
        pauseStart = Date.now();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const angle = phase * Math.PI * 2;
  const tilt = -0.48 + Math.sin(phase * 1.2) * 0.06;
  const positioned = ENTRIES.map((entry) => ({
    ...entry,
    point: projectPoint(entry, angle, tilt, radiusX, radiusY),
    trailPoint: projectPoint(entry, angle - 0.34, tilt, radiusX, radiusY),
    tailPoint: projectPoint(entry, angle - 0.66, tilt, radiusX, radiusY),
  })).sort((a, b) => a.point.depth - b.point.depth);

  return (
    <View style={[styles.shell, { width: panelWidth, height: panelHeight }]}>
      {ORBIT_RINGS.map((ring, index) => {
        const ringWidth = radiusX * 2 * ring.scale;
        const ringHeight = radiusY * 2 * ring.height;
        const rotation = ring.offset + phase * 360 * ring.spin;

        return (
          <View
            key={index}
            style={[
              styles.orbitRing,
              {
                width: ringWidth,
                height: ringHeight,
                left: centerX - ringWidth / 2,
                top: centerY - ringHeight / 2,
                borderColor: ring.color,
                opacity: ring.opacity,
                transform: [
                  { perspective: 1000 },
                  { rotateX: '64deg' },
                  { rotateZ: `${rotation}deg` },
                ],
              },
            ]}
          />
        );
      })}

      {ORBIT_SPARKS.map((spark, index) => {
        const sparkAngle = angle * (0.9 + index * 0.16) + spark.phase;
        const x = centerX + Math.cos(sparkAngle) * radiusX * spark.radius;
        const y = centerY + Math.sin(sparkAngle) * radiusY * 0.7 * spark.radius;

        return (
          <View
            key={index}
            style={[
              styles.orbitSpark,
              {
                width: spark.size,
                height: spark.size,
                left: x - spark.size / 2,
                top: y - spark.size / 2,
                backgroundColor: spark.color,
                shadowColor: spark.color,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        );
      })}

      {positioned.map((entry) => {
        const size = (52 + entry.point.depth * 44) * entry.size;
        const left = centerX + entry.point.x - size / 2;
        const top = centerY + entry.point.y - size / 2;
        const trailDx = entry.point.x - entry.trailPoint.x;
        const trailDy = entry.point.y - entry.trailPoint.y;
        const tailDx = entry.point.x - entry.tailPoint.x;
        const tailDy = entry.point.y - entry.tailPoint.y;
        const directionLength = Math.max(1, Math.hypot(trailDx, trailDy));
        const unitX = trailDx / directionLength;
        const unitY = trailDy / directionLength;
        const trailAngle = Math.atan2(unitY, unitX) * (180 / Math.PI);
        const baseLength = Math.max(size * 1.6, Math.hypot(tailDx, tailDy) * 2.1);
        const headX = centerX + entry.point.x;
        const headY = centerY + entry.point.y;
        const headBloomSize = size * (1.14 + entry.point.depth * 0.22);
        const depthOpacity = 0.24 + entry.point.depth * 0.76;
        const zIndex = Math.round(entry.point.depth * 100) + 10;
        const floorShadowWidth = size * (0.86 + entry.point.depth * 0.18);
        const floorShadowHeight = size * 0.18;

        return (
          <React.Fragment key={entry.token}>
            <View
              style={[
                styles.floorShadow,
                {
                  width: floorShadowWidth,
                  height: floorShadowHeight,
                  borderRadius: floorShadowHeight,
                  left: headX - floorShadowWidth / 2,
                  top: headY + size * 0.36,
                  opacity: 0.1 + entry.point.depth * 0.28,
                  shadowColor: entry.accent,
                  zIndex: zIndex - 2,
                },
              ]}
            />
            <View
              style={[
                styles.headBloom,
                {
                  width: headBloomSize,
                  height: headBloomSize,
                  borderRadius: headBloomSize / 2,
                  left: headX - headBloomSize / 2,
                  top: headY - headBloomSize / 2,
                  shadowColor: entry.accent,
                  opacity: 0.08 + entry.point.depth * 0.28,
                  zIndex: zIndex - 1,
                },
              ]}
            />
            {COMET_STREAKS.map((streak, streakIndex) => {
              const trailLength = baseLength * streak.length;
              const trailThickness = size * streak.thickness;
              const offset = size * streak.offset * 0.5;
              const angle = trailAngle + streak.drift;
              const driftRadians = (angle * Math.PI) / 180;
              const driftX = Math.cos(driftRadians);
              const driftY = Math.sin(driftRadians);
              const driftPerpX = -driftY;
              const driftPerpY = driftX;
              const trailCenterX = headX - driftX * trailLength * 0.5 + driftPerpX * offset;
              const trailCenterY = headY - driftY * trailLength * 0.5 + driftPerpY * offset;

              return (
                <View
                  key={streakIndex}
                  style={[
                    styles.trailWrap,
                    {
                      width: trailLength,
                      height: trailThickness,
                      left: trailCenterX - trailLength / 2,
                      top: trailCenterY - trailThickness / 2,
                      opacity: streak.opacity * depthOpacity,
                      zIndex: zIndex - 1,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      'rgba(255,255,255,0)',
                      colorWithAlpha(entry.accent, 0),
                      colorWithAlpha(entry.accent, 0.18),
                      colorWithAlpha(entry.accent, 0.7),
                      'rgba(255,255,255,0.92)',
                    ]}
                    locations={[0, 0.5, 0.72, 0.93, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.trailGradient}
                  />
                </View>
              );
            })}
            <View
              style={[
                styles.sphereWrap,
                {
                  width: size,
                  height: size,
                  left,
                  top,
                  opacity: Math.min(1, 0.56 + entry.point.depth * 0.58),
                  zIndex,
                },
              ]}
            >
              <GlassOrb entry={entry} size={size} phase={phase} />
            </View>
          </React.Fragment>
        );
      })}

      {ORBIT_RINGS.slice(0, 2).map((ring, index) => {
        const ringWidth = radiusX * 2 * (ring.scale + 0.04);
        const ringHeight = radiusY * 2 * (ring.height + 0.04);
        const rotation = ring.offset + 18 + phase * 360 * ring.spin;

        return (
          <View
            key={index}
            style={[
              styles.frontOrbitArc,
              {
                width: ringWidth,
                height: ringHeight,
                left: centerX - ringWidth / 2,
                top: centerY - ringHeight / 2,
                borderBottomColor: ring.color,
                opacity: ring.opacity * 0.8,
                transform: [
                  { perspective: 1000 },
                  { rotateX: '64deg' },
                  { rotateZ: `${rotation}deg` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: -8,
    marginBottom: -12,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1.2,
    borderRadius: 999,
    borderStyle: 'dashed',
  },
  frontOrbitArc: {
    position: 'absolute',
    borderRadius: 999,
    borderBottomWidth: 2,
  },
  orbitSpark: {
    position: 'absolute',
    borderRadius: 1,
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  floorShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  headBloom: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0.9,
    shadowRadius: 24,
  },
  trailWrap: {
    position: 'absolute',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trailGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  sphereWrap: {
    position: 'absolute',
  },
  sphere: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  innerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    opacity: 0.72,
  },
  orbFloor: {
    position: 'absolute',
    opacity: 0.64,
    transform: [{ rotate: '-2deg' }],
  },
  characterPlate: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  glassSparkle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  mainHighlight: {
    position: 'absolute',
    opacity: 0.62,
    transform: [{ rotate: '-24deg' }],
  },
  arcHighlight: {
    position: 'absolute',
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRadius: 999,
    opacity: 0.72,
    transform: [{ rotate: '-20deg' }],
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  lowerRim: {
    position: 'absolute',
    borderBottomWidth: 1.4,
    borderRadius: 999,
    opacity: 0.82,
  },
  bearAnimation: {
    width: '130%',
    height: '130%',
  },
  grassAnimation: {
    width: '310%',
    height: '310%',
  },
  wolfAnimation: {
    width: '147%',
    height: '147%',
  },
  dinoAnimation: {
    width: '97%',
    height: '97%',
  },
});
