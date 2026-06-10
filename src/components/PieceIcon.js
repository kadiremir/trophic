import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { EMOJI, PIECE_IMAGES } from '../game/constants';

// Grass renders as PNG; all other species render as emoji (matches PieceBadge behavior)
export default function PieceIcon({ token, size, style, imageStyle }) {
  if (!token) return null;

  if (token === 'G') {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <Image
          source={PIECE_IMAGES.G}
          style={[styles.image, { width: size, height: size }, imageStyle]}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.6, userSelect: 'none' }}>
        {EMOJI[token]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
});
