import React, { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

export default function LottieAnimation({ source, loop = false, autoPlay = true, style }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay: autoPlay,
      animationData: source,
    });
    return () => anim.destroy();
  }, []);

  return <div ref={containerRef} style={style} />;
}
