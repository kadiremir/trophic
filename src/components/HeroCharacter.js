import React from 'react';
import { Image, View } from 'react-native';

export default function HeroCharacter({ style }) {
  return (
    <View style={[{ width: '100%', height: '100%' }, style]}>
      <Image
        source={require('../../public/dino.svg')}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </View>
  );
}
