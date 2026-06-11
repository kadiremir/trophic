import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 390, 1.0), 1.5);
  const contentWidth = Math.min(Math.max(width, 390), 680);
  return { isWide: false, width, height, scale, contentWidth };
}
