import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import AmbientBackground from './src/components/AmbientBackground';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';
import AuthButton from './src/components/AuthButton';
import { onAuthChange, loadProgress, saveProgress } from './src/firebase';
import { LEVELS } from './src/game/levels';
import { useLayout } from './src/hooks/useLayout';
import { EatScoreEffectGallery } from './src/screens/EatScoreEffectGallery';

// Bump this whenever levels change to reset all users' cloud progress.
const PROGRESS_VERSION = 3;

export default function App() {
  const [fontsLoaded] = useFonts(
    Platform.OS !== 'web'
      ? { 'CinzelDecorative-Black': require('./assets/cinzel-decorative-900.ttf') }
      : {}
  );
  const { isWide, contentWidth } = useLayout();
  const [screen, setScreen]       = useState('menu');
  const [levelIndex, setLvlIdx]   = useState(0);
  const [unlocked, setUnlocked]   = useState(1);
  const [completed, setCompleted] = useState(new Set());
  const [user, setUser]           = useState(undefined); // undefined = loading

  // ── Firebase auth listener + cloud progress sync ───────────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (!firebaseUser) {
        // Reset to default when signed out
        setUnlocked(1);
        setCompleted(new Set());
        return;
      }

      try {
        const cloud = await loadProgress(firebaseUser.uid);
        if (cloud && cloud.version === PROGRESS_VERSION) {
          setUnlocked(u => Math.max(u, cloud.unlocked ?? 1));
          setCompleted(prev => {
            const merged = new Set([...prev, ...(cloud.completed ?? [])]);
            return merged;
          });
        }
      } catch (e) {
        console.warn('Failed to load cloud progress', e);
      }
    });
    return unsub;
  }, []);

  // ── Persist progress to cloud only ────────────────────────────────────────
  const persist = async (newUnlocked, newCompleted) => {
    if (user) {
      try {
        await saveProgress(user.uid, newUnlocked, newCompleted, PROGRESS_VERSION);
      } catch (e) {
        console.warn('Failed to save cloud progress', e);
      }
    }
  };

  // ── Select level ───────────────────────────────────────────────────────────
  const handleSelect = (idx) => {
    setLvlIdx(idx);
    setScreen('game');
  };

  // ── Level complete ─────────────────────────────────────────────────────────
  const handleComplete = () => {
    const newCompleted = new Set(completed);
    newCompleted.add(levelIndex);
    const nextUnlocked = Math.max(unlocked, levelIndex + 2);
    setCompleted(newCompleted);
    setUnlocked(nextUnlocked);
    persist(nextUnlocked, newCompleted);

    if (levelIndex + 1 < LEVELS.length) {
      setLvlIdx(levelIndex + 1);
    } else {
      setScreen('menu');
    }
  };

  if (Platform.OS !== 'web' && !fontsLoaded) return null;

  if (screen === 'gallery') {
    return (
      <View style={styles.root}>
        <EatScoreEffectGallery onBack={() => setScreen('menu')} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <View style={[styles.appShell, { maxWidth: contentWidth }]}>
        <View style={styles.screenLayer}>
          <View style={screen !== 'menu' ? styles.hidden : styles.fill} pointerEvents={screen !== 'menu' ? 'none' : 'auto'}>
            <MenuScreen
              unlocked={unlocked}
              completed={completed}
              onSelect={handleSelect}
              active={screen === 'menu'}
              authButton={<AuthButton user={user ?? null} />}
              onOpenGallery={() => setScreen('gallery')}
            />
          </View>
          {screen === 'game' && (
            <GameScreen
              key={levelIndex}
              levelIndex={levelIndex}
              onBack={() => setScreen('menu')}
              onComplete={handleComplete}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040d09' },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  appShellWide: {
    maxWidth: '100%',
  },
  screenLayer: { flex: 1, width: '100%' },
  fill: { flex: 1, width: '100%' },
  hidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
});
