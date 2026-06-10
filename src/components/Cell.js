import React, { useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { PAL } from '../game/constants';
import PieceIcon from './PieceIcon';

function Cell({
  cell,
  row,
  col,
  onCellPress,
  isSelected,
  isHovered,
  isTarget,
  isHuntTarget,
  isDanger,
  isChoiceTarget,
  isJumpSrc,
  isGhosted,
  isCrunch,
  crunchColor,
  size,
}) {
  const handlePress = useCallback(() => {
    if (onCellPress) onCellPress(row, col);
  }, [onCellPress, row, col]);
  const pal = PAL[cell || 'E'];

  const getBg = () => {
    if (isDanger) return '#3a0000';
    if (isChoiceTarget) return '#2a1a00';
    if (isHovered) return cell ? '#321000' : 'rgba(255, 90, 70, 0.14)';
    if (isSelected) return pal.bg;
    if (isHuntTarget) return '#2a0800';
    if (isTarget) return 'rgba(255,255,255,0.07)';
    return pal.bg;
  };

  const getBorder = () => {
    if (isDanger) return { borderColor: '#ff3030', borderWidth: 2 };
    if (isChoiceTarget) return { borderColor: '#ffcc00', borderWidth: 2 };
    if (isHovered) return { borderColor: '#ff5a46', borderWidth: 2 };
    if (isSelected) return { borderColor: '#ffd700', borderWidth: 1.5 };
    if (isHuntTarget) return { borderColor: '#ff6050', borderWidth: 2 };
    if (isTarget) return { borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1.5, borderStyle: 'dashed' };
    return { borderColor: pal.border, borderWidth: 1.5 };
  };

  const getShadow = () => {
    if (isDanger) return { shadowColor: '#ff3030', shadowOpacity: 0.9, shadowRadius: 10, elevation: 8 };
    if (isChoiceTarget) return { shadowColor: '#ffcc00', shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 };
    if (isHovered) return { shadowColor: '#ff5a46', shadowOpacity: 0.65, shadowRadius: 10, elevation: 8 };
    if (isSelected) return { shadowColor: '#ffd700', shadowOpacity: 0.8, shadowRadius: 8, elevation: 6 };
    if (isCrunch) return { shadowColor: crunchColor || '#fff', shadowOpacity: 1, shadowRadius: 16, elevation: 12 };
    return {};
  };

  const getEmojiScale = () => {
    if (isCrunch) return 1.35;
    if (isSelected || isHovered) return 1.08;
    if (isDanger) return 0.85;
    if (isChoiceTarget) return 1.1;
    return 1;
  };

  const content = (
    <>
      {isDanger && (
        <Text style={styles.skull}>X</Text>
      )}

      {isChoiceTarget && (
        <Text style={styles.choiceArrow}>?</Text>
      )}

      {cell && !isJumpSrc && !isGhosted && (
        <PieceIcon
          token={cell}
          size={size * 0.86}
          style={{ transform: [{ scale: getEmojiScale() }] }}
        />
      )}

      {isGhosted && (
        <View style={styles.ghostMarker} />
      )}

      {isCrunch && (
        <View style={[styles.crunchRing, { borderColor: crunchColor || '#fff' }]} />
      )}

      {isHuntTarget && !cell && (
        <Text style={styles.crosshair}>+</Text>
      )}
    </>
  );

  const sharedStyle = [
    styles.cell,
    { width: size, height: size, backgroundColor: getBg() },
    isGhosted && styles.ghostedCell,
    getBorder(),
    getShadow(),
  ];

  if (!onCellPress) {
    return <View style={sharedStyle}>{content}</View>;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={sharedStyle}
    >
      {content}
    </TouchableOpacity>
  );
}

export default React.memo(Cell);

const styles = StyleSheet.create({
  cell: {
    borderRadius: 12,
    margin: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ghostedCell: {
    opacity: 0.42,
    borderStyle: 'dashed',
  },
  ghostMarker: {
    width: '34%',
    height: '34%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  skull: {
    position: 'absolute',
    top: 2,
    right: 4,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffd8d8',
    opacity: 0.9,
  },
  choiceArrow: {
    position: 'absolute',
    top: 2,
    right: 4,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffe999',
  },
  crunchRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 14,
    borderWidth: 3,
    opacity: 0.9,
  },
  crosshair: {
    fontSize: 14,
    color: '#ff6050',
    opacity: 0.6,
  },
});
