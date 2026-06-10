import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';

export default function HowToPlayButton({ onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });
  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] });

  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Animated.View style={[styles.bloom, { opacity, transform: [{ scale }] }]} />
      <Text style={styles.label}>How to Play</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    overflow: 'hidden',
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(3,28,33,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.28)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 170,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#00E5C3',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 4,
  },
  bloom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,229,195,0.55)',
    top: '50%',
    left: '50%',
    marginTop: -110,
    marginLeft: -110,
  },
  label: {
    color: '#bff5ec',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
