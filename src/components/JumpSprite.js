import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { PAL } from '../game/constants';
import PieceIcon from './PieceIcon';

// Renders an emoji that animates from one grid cell position to another.
// fromR/fromC and toR/toC are row/col indices. cellSize is the pixel size per cell.
export default function JumpSprite({
  pred,
  fromR,
  fromC,
  toR,
  toC,
  cellSize,
  gridPadding = 12,
  boardOffsetX = 0,
}) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;

  const CELL = cellSize + 5; // cell size + gap

  const startX = gridPadding + boardOffsetX + fromC * CELL + CELL / 2 - cellSize * 0.3;
  const startY = fromR * CELL + CELL / 2 - cellSize * 0.3;
  const endX   = gridPadding + boardOffsetX + toC * CELL + CELL / 2 - cellSize * 0.3;
  const endY   = toR * CELL + CELL / 2 - cellSize * 0.3;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animX, {
        toValue: endX - startX,
        speed: 14,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.spring(animY, {
        toValue: endY - startY,
        speed: 14,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(animScale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
        Animated.timing(animScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const pal = PAL[pred] || PAL.E;

  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          left: startX,
          top: startY,
          transform: [{ translateX: animX }, { translateY: animY }, { scale: animScale }],
          shadowColor: pal.glow,
        },
      ]}
    >
      <PieceIcon token={pred} size={cellSize * 0.9} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sprite: {
    position: 'absolute',
    zIndex: 20,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 15,
  },
});
