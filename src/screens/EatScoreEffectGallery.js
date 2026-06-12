/**
 * Dev-only Juice Gallery — preview all eat effects side by side.
 * Shows 11 buttons (original + 10 new). Tap one to fire it at center.
 * Tap "Set as Active" to write ACTIVE_EFFECT (manual step — shows instruction).
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, Alert,
} from 'react-native';

import { ScoreFlyout }    from '../effects/ScoreFlyout';
import { ComicChomp }     from '../effects/ComicChomp';
import { ShockwaveRing }  from '../effects/ShockwaveRing';
import { ParticleBurst }  from '../effects/ParticleBurst';
import { ScoreVacuum }    from '../effects/ScoreVacuum';
import { SquashGulp }     from '../effects/SquashGulp';
import { ComboStacker }   from '../effects/ComboStacker';
import { StrikeSlash }    from '../effects/StrikeSlash';
import { ScreenFlash }    from '../effects/ScreenFlash';
import { NumberSplatter } from '../effects/NumberSplatter';
import { ConfettiBurst }  from '../effects/ConfettiBurst';
import { ACTIVE_EFFECT }  from '../effects/activeEffect';

const EFFECTS = [
  {
    key: 'ScoreFlyout',
    label: '0 — ScoreFlyout',
    sublabel: 'Original: gold number, bezier arc',
    Component: ScoreFlyout,
    score: '+20',
  },
  {
    key: 'ComicChomp',
    label: '1 — ComicChomp',
    sublabel: '"CHOMP!" word-art + impact lines',
    Component: ComicChomp,
    score: '+8',
  },
  {
    key: 'ShockwaveRing',
    label: '2 — ShockwaveRing',
    sublabel: '3 expanding concentric rings',
    Component: ShockwaveRing,
    score: '+3',
  },
  {
    key: 'ParticleBurst',
    label: '3 — ParticleBurst',
    sublabel: '12 colored dots w/ gravity arc',
    Component: ParticleBurst,
    score: '+20',
  },
  {
    key: 'ScoreVacuum',
    label: '4 — ScoreVacuum',
    sublabel: 'Number sucked upward w/ ghost trails',
    Component: ScoreVacuum,
    score: '+8',
  },
  {
    key: 'SquashGulp',
    label: '5 — SquashGulp',
    sublabel: 'Cartoony squash–stretch gulp',
    Component: SquashGulp,
    score: '+3',
  },
  {
    key: 'ComboStacker',
    label: '6 — ComboStacker',
    sublabel: 'Left/right slide-in collision + badge',
    Component: ComboStacker,
    score: '+20',
  },
  {
    key: 'StrikeSlash',
    label: '7 — StrikeSlash',
    sublabel: 'Crossing sword-slash marks',
    Component: StrikeSlash,
    score: '+8',
  },
  {
    key: 'ScreenFlash',
    label: '8 — ScreenFlash',
    sublabel: 'White radial flash + score drops in',
    Component: ScreenFlash,
    score: '+20',
  },
  {
    key: 'NumberSplatter',
    label: '9 — NumberSplatter',
    sublabel: 'Digits explode out then snap back',
    Component: NumberSplatter,
    score: '+20',
  },
  {
    key: 'ConfettiBurst',
    label: '10 — ConfettiBurst',
    sublabel: 'Colorful confetti shower',
    Component: ConfettiBurst,
    score: '+8',
  },
];

let _fxId = 0;

export function EatScoreEffectGallery({ onBack }) {
  const { width, height } = useWindowDimensions();
  const [activeFX, setActiveFX] = useState([]);
  const [currentActive, setCurrentActive] = useState(ACTIVE_EFFECT);

  const fireEffect = useCallback((EffectComponent, score) => {
    const id = `fx-${++_fxId}`;
    const x = width / 2;
    const y = height / 2;
    setActiveFX((prev) => [...prev, { id, x, y, score, Component: EffectComponent }]);
  }, [width, height]);

  const removeFX = useCallback((id) => {
    setActiveFX((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSetActive = useCallback((key) => {
    setCurrentActive(key);
    Alert.alert(
      'Set Active Effect',
      `To use "${key}" in-game, open:\n\nsrc/effects/activeEffect.js\n\nand change:\n\nACTIVE_EFFECT = '${key}'`,
      [{ text: 'Got it' }],
    );
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🧃 Juice Gallery</Text>
        <Text style={styles.subtitle}>Active in-game: <Text style={styles.activeLabel}>{currentActive}</Text></Text>
      </View>

      {/* Effect list */}
      <ScrollView contentContainerStyle={styles.list}>
        {EFFECTS.map(({ key, label, sublabel, Component, score }) => {
          const isActive = key === currentActive;
          return (
            <View key={key} style={[styles.row, isActive && styles.rowActive]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowSub}>{sublabel}</Text>
                {isActive && <Text style={styles.activeBadge}>★ ACTIVE IN-GAME</Text>}
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => fireEffect(Component, score)}
                >
                  <Text style={styles.playBtnText}>▶ Play</Text>
                </TouchableOpacity>
                {!isActive && (
                  <TouchableOpacity
                    style={styles.setBtn}
                    onPress={() => handleSetActive(key)}
                  >
                    <Text style={styles.setBtnText}>Set Active</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Tap ▶ Play to preview. Tap Set Active to learn how to switch the in-game effect.
          </Text>
        </View>
      </ScrollView>

      {/* FX layer — after ScrollView so it paints on top */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {activeFX.map((fx) => (
          <fx.Component
            key={fx.id}
            x={fx.x}
            y={fx.y}
            score={fx.score}
            onDone={() => removeFX(fx.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e30',
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    color: '#7080FF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#6070a0',
    marginTop: 2,
  },
  activeLabel: {
    color: '#60E080',
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131f',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e1e30',
    gap: 12,
  },
  rowActive: {
    borderColor: '#60E080',
    backgroundColor: '#0e1a12',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E0E0FF',
  },
  rowSub: {
    fontSize: 12,
    color: '#5060a0',
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60E080',
    letterSpacing: 1,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  playBtn: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4040a0',
  },
  playBtnText: {
    color: '#A0B0FF',
    fontSize: 14,
    fontWeight: '700',
  },
  setBtn: {
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#30602a',
  },
  setBtnText: {
    color: '#60E080',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    color: '#404060',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
});
