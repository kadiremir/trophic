import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { PIECE_IMAGES } from '../game/constants';

export default function PieceIcon({ token, size, style, imageStyle }) {
  const source = PIECE_IMAGES[token];

  if (!source) return null;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Image
        source={source}
        style={[styles.image, { width: size, height: size }, imageStyle]}
        resizeMode="contain"
      />
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
