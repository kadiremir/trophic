import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
} from 'react-native-reanimated';
import HeroCharacter from './HeroCharacter';
import PieceIcon from './PieceIcon';

const ENTRIES = [
  { token: 'G', label: 'Grass',    accent: '#8ff08c', lat: -0.62, lon: 0.16, size: 0.8  },
  { token: 'R', label: 'Rabbit',   accent: '#ffd7ef', lat:  0.02, lon: 1.14, size: 0.94 },
  { token: 'F', label: 'Fox',      accent: '#ffad57', lat: -0.2,  lon: 2.42, size: 1.12 },
  { token: 'W', label: 'Wolf',     accent: '#b9d1ff', lat:  0.04, lon: 3.5,  size: 1.04 },
  { token: 'B', label: 'Bear',     accent: '#d6b081', lat:  0.56, lon: 4.6,  size: 0.92 },
  { token: 'D', label: 'Dinosaur', accent: '#a8f1dc', lat:  0.24, lon: 5.62, size: 0.86 },
];

const COMET_STREAKS = [
  { length: 1.2,  thickness: 0.04,  offset: -0.4, drift: -8, opacity: 0.16 },
  { length: 1.36, thickness: 0.03,  offset:  0.5, drift:  9, opacity: 0.14 },
  { length: 1.55, thickness: 0.022, offset:  0,   drift:  0, opacity: 0.12 },
];

const ORBIT_RINGS = [
  { scale: 1.18, height: 0.74, opacity: 0.34, color: 'rgba(178, 236, 226, 0.34)', spin:  0.18, offset:   2 },
  { scale: 1.36, height: 0.9,  opacity: 0.2,  color: 'rgba(255, 213, 111, 0.28)', spin: -0.14, offset: -18 },
  { scale: 1.54, height: 1.04, opacity: 0.16, color: 'rgba(134, 219, 255, 0.24)', spin:  0.1,  offset:  32 },
];

const ORBIT_SPARKS = [
  { radius: 1.22, size: 6, phase: 0.18, speedMult: 0.90, color: '#fff1b8' },
  { radius: 1.5,  size: 4, phase: 2.36, speedMult: 1.06, color: '#b9fff4' },
  { radius: 1.34, size: 3, phase: 4.44, speedMult: 1.22, color: '#fff8df' },
];

const GLASS_SPARKLES = [
  { left: '27%', top: '20%', size: 2,   opacity: 0.48 },
  { left: '68%', top: '28%', size: 1.5, opacity: 0.32 },
  { left: '76%', top: '58%', size: 2,   opacity: 0.24 },
  { left: '34%', top: '72%', size: 1.5, opacity: 0.26 },
];

function colorWithAlpha(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const a = typeof alpha === 'number' ? alpha.toFixed(3) : alpha;
  return `rgba(${r},${g},${b},${a})`;
}

const ENTRY_COLORS = {};
ENTRIES.forEach((e) => {
  ENTRY_COLORS[e.token] = {
    a0:  colorWithAlpha(e.accent, 0),
    a18: colorWithAlpha(e.accent, 0.18),
    a38: colorWithAlpha(e.accent, 0.38),
    a7:  colorWithAlpha(e.accent, 0.7),
  };
});

const ENTRY_RGB = {};
ENTRIES.forEach((e) => {
  const v = e.accent.replace('#', '');
  ENTRY_RGB[e.token] = `${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)}`;
});

function projectPoint(lat, lon, angle, tilt, radiusX, radiusY) {
  'worklet';
  const l = lon + angle;
  const x = Math.cos(lat) * Math.cos(l);
  const z = Math.cos(lat) * Math.sin(l);
  const y = Math.sin(lat);
  const yT = y * Math.cos(tilt) - z * Math.sin(tilt);
  const zT = y * Math.sin(tilt) + z * Math.cos(tilt);
  const depth = (zT + 1) / 2;
  const p = 0.82 + depth * 0.28;
  return { x: x * radiusX * p, y: yT * radiusY * p + depth * radiusY * 0.18, depth, rawX: x, rawY: yT };
}

// Static orb visual rendered at a fixed size; the animated wrapper scales it.
function GlassOrb({ entry, size }) {
  const { lat, lon, accent, token } = entry;
  const pt = projectPoint(lat, lon, 0, -0.48, 128, 76);
  const depth = pt.depth;
  const ec = ENTRY_COLORS[token];
  const charSize = size * (token === 'G' ? 0.56 : 0.72);
  const floorW = size * 0.7;
  const floorH = size * 0.18;

  return (
    <View
      style={[
        styles.sphere,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colorWithAlpha(accent, 0.44 + depth * 0.3),
          backgroundColor: colorWithAlpha(accent, 0.04 + depth * 0.04),
          shadowColor: accent,
          shadowOpacity: 0.22 + depth * 0.34,
          shadowRadius: 14 + depth * 15,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.38)', ec.a18, 'rgba(105,194,211,0.1)', 'rgba(6,19,20,0.34)']}
        locations={[0, 0.18, 0.58, 1]}
        start={{ x: 0.14, y: 0.04 }}
        end={{ x: 0.86, y: 0.96 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2 }]}
      />
      <View style={[styles.innerShadow, { borderRadius: size / 2, borderColor: colorWithAlpha(accent, 0.2 + depth * 0.14) }]} />
      <LinearGradient
        colors={[ec.a0, ec.a38, 'rgba(255,255,255,0.38)', ec.a0]}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.orbFloor, { width: floorW, height: floorH, left: (size - floorW) / 2, bottom: size * 0.13, borderRadius: floorH }]}
      />
      <View
        style={[
          styles.characterPlate,
          { width: charSize * 1.12, height: charSize * 1.12, left: (size - charSize * 1.12) / 2, bottom: size * 0.08, shadowColor: accent },
        ]}
      >
        {token === 'D' ? <HeroCharacter style={styles.dinoAnimation} /> : <PieceIcon token={token} size={charSize} />}
      </View>
      {GLASS_SPARKLES.map((sp, i) => (
        <View key={i} style={[styles.glassSparkle, { left: sp.left, top: sp.top, width: sp.size, height: sp.size, opacity: sp.opacity + depth * 0.16 }]} />
      ))}
      <LinearGradient
        colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mainHighlight, { width: size * 0.5, height: size * 0.22, borderRadius: size * 0.25, left: size * 0.14, top: size * 0.1 }]}
      />
      <View
        style={[
          styles.arcHighlight,
          { width: size * 0.6, height: size * 0.38, left: size * 0.08, top: size * 0.06, borderTopColor: 'rgba(255,255,255,0.62)', borderLeftColor: 'rgba(255,255,255,0.22)' },
        ]}
      />
      <View style={[styles.rim, { borderRadius: size / 2, borderColor: 'rgba(245,255,252,0.34)' }]} />
      <View style={[styles.lowerRim, { left: size * 0.16, right: size * 0.16, bottom: size * 0.12, height: size * 0.18, borderBottomColor: colorWithAlpha(accent, 0.44 + depth * 0.24) }]} />
    </View>
  );
}

// Computes the streak animated style for a single streak spec.
// Called as a custom hook — always called unconditionally in the same order.
function useStreakStyle(phase, layoutShared, lat, lon, entrySz, streak) {
  const sLen = streak.length;
  const sThk = streak.thickness;
  const sOff = streak.offset;
  const sDrift = streak.drift;
  const sOpacity = streak.opacity;
  return useAnimatedStyle(() => {
    'worklet';
    const { centerX, centerY, radiusX, radiusY } = layoutShared.value;
    const angle = phase.value * Math.PI * 2;
    const tilt = -0.48 + Math.sin(phase.value * 1.2) * 0.06;
    const pt   = projectPoint(lat, lon, angle,        tilt, radiusX, radiusY);
    const ptT  = projectPoint(lat, lon, angle - 0.34, tilt, radiusX, radiusY);
    const ptTl = projectPoint(lat, lon, angle - 0.66, tilt, radiusX, radiusY);
    const sz = (52 + pt.depth * 44) * entrySz;
    const headX = centerX + pt.x;
    const headY = centerY + pt.y;
    const dx = pt.x - ptT.x;
    const dy = pt.y - ptT.y;
    const tdx = pt.x - ptTl.x;
    const tdy = pt.y - ptTl.y;
    const dirLen = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const trailAngle = Math.atan2(dy / dirLen, dx / dirLen) * (180 / Math.PI);
    const baseLen = Math.max(sz * 1.6, Math.sqrt(tdx * tdx + tdy * tdy) * 2.1);
    const tLen = baseLen * sLen;
    const tThk = Math.max(1, sz * sThk);
    const off = sz * sOff * 0.5;
    const sAngle = trailAngle + sDrift;
    const sRad = (sAngle * Math.PI) / 180;
    const cx = headX - Math.cos(sRad) * tLen * 0.5 + (-Math.sin(sRad)) * off;
    const cy = headY - Math.sin(sRad) * tLen * 0.5 + Math.cos(sRad) * off;
    const depthOp = 0.24 + pt.depth * 0.76;
    return {
      width: tLen,
      height: tThk,
      transform: [{ translateX: cx - tLen / 2 }, { translateY: cy - tThk / 2 }, { rotate: `${sAngle}deg` }],
      opacity: sOpacity * depthOp,
      zIndex: Math.round(pt.depth * 100) + 9,
    };
  });
}

function AnimatedOrbEntry({ entry, phase, layoutShared }) {
  const { lat, lon, size: entrySz, token } = entry;
  const ec = ENTRY_COLORS[token];

  // Fixed render size for GlassOrb — parent scales it to match the animated depth size.
  const basePt = projectPoint(lat, lon, 0, -0.48, 128, 76);
  const baseSize = (52 + basePt.depth * 44) * entrySz;

  // Position: translate so that the element's natural center aligns with the orbit point.
  const wrapStyle = useAnimatedStyle(() => {
    'worklet';
    const { centerX, centerY, radiusX, radiusY } = layoutShared.value;
    const angle = phase.value * Math.PI * 2;
    const tilt = -0.48 + Math.sin(phase.value * 1.2) * 0.06;
    const pt = projectPoint(lat, lon, angle, tilt, radiusX, radiusY);
    return {
      transform: [{ translateX: centerX + pt.x - baseSize / 2 }, { translateY: centerY + pt.y - baseSize / 2 }],
      opacity: Math.min(1, 0.56 + pt.depth * 0.58),
      zIndex: Math.round(pt.depth * 100) + 10,
    };
  });

  // Rotate + scale: GlassOrb stays at baseSize, we scale to match current depth size.
  const orbStyle = useAnimatedStyle(() => {
    'worklet';
    const { radiusX, radiusY } = layoutShared.value;
    const angle = phase.value * Math.PI * 2;
    const tilt = -0.48 + Math.sin(phase.value * 1.2) * 0.06;
    const pt = projectPoint(lat, lon, angle, tilt, radiusX, radiusY);
    const sz = (52 + pt.depth * 44) * entrySz;
    const yaw = -pt.rawX * 18 + Math.sin(phase.value * Math.PI * 2 + lon) * 6;
    const pitch = pt.rawY * 10 - 4;
    return {
      transform: [
        { perspective: 900 },
        { rotateY: `${yaw}deg` },
        { rotateX: `${pitch}deg` },
        { scale: sz / baseSize },
      ],
    };
  });

  const floorStyle = useAnimatedStyle(() => {
    'worklet';
    const { centerX, centerY, radiusX, radiusY } = layoutShared.value;
    const angle = phase.value * Math.PI * 2;
    const tilt = -0.48 + Math.sin(phase.value * 1.2) * 0.06;
    const pt = projectPoint(lat, lon, angle, tilt, radiusX, radiusY);
    const sz = (52 + pt.depth * 44) * entrySz;
    const headX = centerX + pt.x;
    const headY = centerY + pt.y;
    const fw = sz * (0.86 + pt.depth * 0.18);
    const fh = sz * 0.18;
    return {
      width: fw, height: fh, borderRadius: fh,
      transform: [{ translateX: headX - fw / 2 }, { translateY: headY + sz * 0.36 }],
      opacity: 0.1 + pt.depth * 0.28,
      zIndex: Math.round(pt.depth * 100) + 8,
    };
  });

  const bloomStyle = useAnimatedStyle(() => {
    'worklet';
    const { centerX, centerY, radiusX, radiusY } = layoutShared.value;
    const angle = phase.value * Math.PI * 2;
    const tilt = -0.48 + Math.sin(phase.value * 1.2) * 0.06;
    const pt = projectPoint(lat, lon, angle, tilt, radiusX, radiusY);
    const sz = (52 + pt.depth * 44) * entrySz;
    const headX = centerX + pt.x;
    const headY = centerY + pt.y;
    const bsz = sz * (1.14 + pt.depth * 0.22);
    return {
      width: bsz, height: bsz, borderRadius: bsz / 2,
      transform: [{ translateX: headX - bsz / 2 }, { translateY: headY - bsz / 2 }],
      opacity: 0.08 + pt.depth * 0.28,
      zIndex: Math.round(pt.depth * 100) + 9,
    };
  });

  // 3 streak styles — useStreakStyle is a custom hook, called unconditionally in fixed order
  const s0 = useStreakStyle(phase, layoutShared, lat, lon, entrySz, COMET_STREAKS[0]);
  const s1 = useStreakStyle(phase, layoutShared, lat, lon, entrySz, COMET_STREAKS[1]);
  const s2 = useStreakStyle(phase, layoutShared, lat, lon, entrySz, COMET_STREAKS[2]);
  const streakStyles = [s0, s1, s2];

  return (
    <>
      <Animated.View style={[styles.floorShadow, floorStyle]} />
      <Animated.View style={[styles.headBloom, bloomStyle]} />
      {COMET_STREAKS.map((_, si) => (
        <Animated.View key={si} style={[styles.trailWrap, streakStyles[si]]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', ec.a0, ec.a18, ec.a7, 'rgba(255,255,255,0.92)']}
            locations={[0, 0.5, 0.72, 0.93, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.trailGradient}
          />
        </Animated.View>
      ))}
      <Animated.View style={[styles.sphereWrap, wrapStyle]}>
        <Animated.View style={orbStyle}>
          <GlassOrb entry={entry} size={baseSize} />
        </Animated.View>
      </Animated.View>
    </>
  );
}

function AnimatedOrbitRing({ ring, phase, rw, rh, left, top }) {
  const offset = ring.offset;
  const spinMult = ring.spin * 360;
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ perspective: 1000 }, { rotateX: '64deg' }, { rotateZ: `${offset + phase.value * spinMult}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.orbitRing, { width: rw, height: rh, left, top, borderColor: ring.color, opacity: ring.opacity }, animStyle]} />
  );
}

function AnimatedFrontArc({ ring, phase, rw, rh, left, top }) {
  const offset = ring.offset + 18;
  const spinMult = ring.spin * 360;
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ perspective: 1000 }, { rotateX: '64deg' }, { rotateZ: `${offset + phase.value * spinMult}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.frontOrbitArc, { width: rw, height: rh, left, top, borderBottomColor: ring.color, opacity: ring.opacity * 0.8 }, animStyle]} />
  );
}

function AnimatedOrbitSpark({ spark, phase, centerX, centerY, radiusX, radiusY }) {
  const { phase: sparkPhase, speedMult, radius: sparkRadius, size: sparkSize } = spark;
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const a = phase.value * Math.PI * 2 * speedMult + sparkPhase;
    const x = centerX + Math.cos(a) * radiusX * sparkRadius;
    const y = centerY + Math.sin(a) * radiusY * 0.7 * sparkRadius;
    return {
      transform: [{ translateX: x - sparkSize / 2 }, { translateY: y - sparkSize / 2 }, { rotate: '45deg' }],
    };
  });
  return (
    <Animated.View style={[styles.orbitSpark, { width: spark.size, height: spark.size, left: 0, top: 0, backgroundColor: spark.color }, animStyle]} />
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

  const phase = useSharedValue(0);
  const isActive = useSharedValue(active);
  isActive.value = active;

  const layoutShared = useSharedValue({ centerX, centerY, radiusX, radiusY });
  layoutShared.value = { centerX, centerY, radiusX, radiusY };

  useFrameCallback((info) => {
    'worklet';
    if (!isActive.value) return;
    phase.value += ((info.timeSincePreviousFrame ?? 16) / 1000) * 0.115;
  });

  return (
    <View style={[styles.shell, { width: panelWidth, height: panelHeight }]}>
      {ORBIT_RINGS.map((ring, i) => {
        const rw = radiusX * 2 * ring.scale;
        const rh = radiusY * 2 * ring.height;
        return <AnimatedOrbitRing key={i} ring={ring} phase={phase} rw={rw} rh={rh} left={centerX - rw / 2} top={centerY - rh / 2} />;
      })}

      {ORBIT_SPARKS.map((spark, i) => (
        <AnimatedOrbitSpark key={i} spark={spark} phase={phase} centerX={centerX} centerY={centerY} radiusX={radiusX} radiusY={radiusY} />
      ))}

      {ENTRIES.map((entry) => (
        <AnimatedOrbEntry key={entry.token} entry={entry} phase={phase} layoutShared={layoutShared} />
      ))}

      {ORBIT_RINGS.slice(0, 2).map((ring, i) => {
        const rw = radiusX * 2 * (ring.scale + 0.04);
        const rh = radiusY * 2 * (ring.height + 0.04);
        return <AnimatedFrontArc key={i} ring={ring} phase={phase} rw={rw} rh={rh} left={centerX - rw / 2} top={centerY - rh / 2} />;
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
  },
  floorShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headBloom: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  },
  glassSparkle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
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
  dinoAnimation: {
    width: '97%',
    height: '97%',
  },
});
