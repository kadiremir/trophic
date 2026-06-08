import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AmbientBackground from './src/components/AmbientBackground';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';
import { LEVELS } from './src/game/levels';

const STORAGE_KEY = 'trophic_progress';

export default function App() {
  const [screen, setScreen]       = useState('menu'); // menu | game
  const [levelIndex, setLvlIdx]   = useState(0);
  const [unlocked, setUnlocked]   = useState(LEVELS.length); // keep all levels open for testing
  const [completed, setCompleted] = useState(new Set());

  // ── Load progress from storage ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          setUnlocked(Math.max(data.unlocked ?? 1, LEVELS.length));
          setCompleted(new Set(data.completed ?? []));
        }
      } catch (e) {
        console.warn('Failed to load progress', e);
      }
    })();
  }, []);

  // ── Save progress ──────────────────────────────────────────────────────────
  const saveProgress = async (newUnlocked, newCompleted) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ unlocked: newUnlocked, completed: [...newCompleted] })
      );
    } catch (e) {
      console.warn('Failed to save progress', e);
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
    saveProgress(nextUnlocked, newCompleted);

    // advance to next level or go back to menu
    if (levelIndex + 1 < LEVELS.length) {
      setLvlIdx(levelIndex + 1);
    } else {
      setScreen('menu');
    }
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
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
  root: { flex: 1, backgroundColor: '#040d09' },
  screenLayer: { flex: 1 },
});
