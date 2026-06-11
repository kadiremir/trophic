import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import AmbientBackground from './src/components/AmbientBackground';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';
import AuthButton from './src/components/AuthButton';
import { onAuthChange, loadProgress, saveProgress } from './src/firebase';
import { LEVELS } from './src/game/levels';
import { useLayout } from './src/hooks/useLayout';

// Bump this whenever levels change to reset all users' cloud progress.
const PROGRESS_VERSION = 3;

export default function App() {
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

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <View style={[styles.appShell, { maxWidth: contentWidth }]}>
        <View style={styles.topChrome}>
          <View style={styles.authBar}>
            <AuthButton user={user ?? null} />
          </View>
        </View>
        <View style={styles.screenLayer}>
          <View style={screen !== 'menu' ? styles.hidden : styles.fill} pointerEvents={screen !== 'menu' ? 'none' : 'auto'}>
            <MenuScreen
              unlocked={unlocked}
              completed={completed}
              onSelect={handleSelect}
              active={screen === 'menu'}
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
  topChrome: {
    width: '100%',
    minHeight: Platform.select({ web: 52, default: 48 }),
    paddingTop: Platform.select({ web: 6, default: 6 }),
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    zIndex: 100,
  },
  authBar: {
    maxWidth: '100%',
    marginTop: Platform.select({ web: 12, default: 8 }),
  },
  screenLayer: { flex: 1, width: '100%' },
  fill: { flex: 1, width: '100%' },
  hidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
});
