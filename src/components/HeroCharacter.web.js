import React from 'react';
import { Image, View } from 'react-native';

export default function HeroCharacter({ style }) {
  return (
    <View style={[{ width: '100%', height: '100%', overflow: 'visible' }, style]}>
      <Image
        source={require('../../assets/dino.svg')}
        style={{ width: '140%', height: '140%', marginLeft: '-20%', marginTop: '-45%' }}
        resizeMode="contain"
      />
    </View>
  );
}
