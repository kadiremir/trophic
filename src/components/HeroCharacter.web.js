import React from 'react';
import { View } from 'react-native';

export default function HeroCharacter({ style }) {
  return (
    <View style={[{ width: '100%', height: '100%' }, style]}>
      <img
        src="/dino.svg"
        alt=""
        style={{ width: '140%', height: '140%', objectFit: 'contain', display: 'block', transform: 'translate(-14%, -32%)' }}
      />
    </View>
  );
}
