import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AmbientBackground from './src/components/AmbientBackground';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';
import AuthButton from './src/components/AuthButton';
import { onAuthChange, loadProgress, saveProgress } from './src/firebase';
import { LEVELS } from './src/game/levels';

const STORAGE_KEY = 'trophic_progress';

export default function App() {
  const [screen, setScreen]       = useState('menu');
  const [levelIndex, setLvlIdx]   = useState(0);
  const [unlocked, setUnlocked]   = useState(1);
  const [completed, setCompleted] = useState(new Set());
  const [user, setUser]           = useState(undefined); // undefined = loading

  // ── Load progress from AsyncStorage (always, for offline support) ──────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          setUnlocked(u => Math.max(u, data.unlocked ?? 1));
          setCompleted(new Set(data.completed ?? []));
        }
      } catch (e) {
        console.warn('Failed to load local progress', e);
      }
    })();
  }, []);

  // ── Firebase auth listener + cloud progress sync ───────────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (!firebaseUser) return;

      try {
        const cloud = await loadProgress(firebaseUser.uid);
        if (cloud) {
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

  // ── Persist progress locally + to cloud ───────────────────────────────────
  const persist = async (newUnlocked, newCompleted) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ unlocked: newUnlocked, completed: [...newCompleted] })
      );
    } catch (e) {
      console.warn('Failed to save local progress', e);
    }
    if (user) {
      try {
        await saveProgress(user.uid, newUnlocked, newCompleted);
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
      <View style={styles.authBar}>
        <AuthButton user={user ?? null} />
      </View>
      <View style={styles.screenLayer}>
        {screen === 'menu' && (
          <MenuScreen
            unlocked={unlocked}
            completed={completed}
            onSelect={handleSelect}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            levelIndex={levelIndex}
            onBack={() => setScreen('menu')}
            onComplete={handleComplete}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#040d09' },
  authBar:     { position: 'absolute', top: 16, right: 16, zIndex: 100 },
  screenLayer: { flex: 1 },
});
