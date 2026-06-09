import React from 'react';
import LottieView from 'lottie-react-native';

export default function LottieAnimation({ source, loop = false, autoPlay = true, style }) {
  return (
    <LottieView
      source={source}
      loop={loop}
      autoPlay={autoPlay}
      style={style}
    />
  );
}
