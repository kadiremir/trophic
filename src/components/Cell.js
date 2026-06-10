import React, { useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { STICKER, PAPER } from '../game/constants';
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

  const sk = STICKER[cell || 'E'];
  const isEmpty = !cell;
  // Stickers are slapped down at playful angles; lifted ones straighten out.
  const lifted = isSelected || isHovered || isCrunch || isChoiceTarget;
  const restAngle = (row + col) % 2 === 0 ? -4 : 4;

  const getFill = () => {
    if (isDanger) return '#ff6b6b';
    if (isChoiceTarget) return PAPER.gold;
    if (isEmpty) return isTarget ? 'rgba(212,175,55,0.18)' : 'transparent';
    return sk.fill;
  };

  const getBorder = () => {
    if (isDanger) return { borderColor: '#fff', borderWidth: 4, borderStyle: 'solid' };
    if (isChoiceTarget) return { borderColor: '#fff', borderWidth: 4, borderStyle: 'solid' };
    if (isSelected || isHovered) return { borderColor: PAPER.gold, borderWidth: 4, borderStyle: 'solid' };
    if (isHuntTarget) return { borderColor: '#ff5d7a', borderWidth: 4, borderStyle: 'dashed' };
    if (isEmpty) {
      return isTarget
        ? { borderColor: '#d4af37', borderWidth: 3, borderStyle: 'dashed' }
        : { borderColor: '#5a4a2a', borderWidth: 2, borderStyle: 'dashed' };
    }
    return { borderColor: '#fff', borderWidth: 4, borderStyle: 'solid' };
  };

  const getShadow = () => {
    if (isEmpty && !isTarget) return {};
    if (isCrunch) {
      return { shadowColor: crunchColor || '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 12 };
    }
    if (lifted || isHuntTarget) {
      return { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 8 };
    }
    return { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 };
  };

  const getEmojiScale = () => {
    if (isCrunch) return 1.35;
    if (isSelected || isHovered) return 1.08;
    if (isDanger) return 0.85;
    if (isChoiceTarget) return 1.1;
    return 1;
  };

  const tileScale = lifted ? 1.07 : 1;
  const tileAngle = lifted || (isEmpty && !isTarget) ? 0 : restAngle;

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
          size={size * 0.86 * (cell === 'R' || cell === 'F' ? 1.5 : cell === 'G' ? 0.9 : 1)}
          style={{ transform: [{ scale: getEmojiScale() }] }}
        />
      )}

      {isGhosted && (
        <View style={styles.ghostMarker} />
      )}

      {isCrunch && (
        <View style={[styles.crunchRing, { borderColor: crunchColor || PAPER.gold }]} />
      )}

      {isHuntTarget && !cell && (
        <Text style={styles.crosshair}>+</Text>
      )}
    </>
  );

  const sharedStyle = [
    styles.cell,
    {
      width: size,
      height: size,
      backgroundColor: getFill(),
      transform: [{ rotate: `${tileAngle}deg` }, { scale: tileScale }],
    },
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
      activeOpacity={0.8}
      style={sharedStyle}
    >
      {content}
    </TouchableOpacity>
  );
}

export default React.memo(Cell);

const styles = StyleSheet.create({
  cell: {
    borderRadius: 16,
    margin: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ghostedCell: {
    opacity: 0.4,
    borderStyle: 'dashed',
  },
  ghostMarker: {
    width: '34%',
    height: '34%',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
  },
  skull: {
    position: 'absolute',
    top: 1,
    right: 4,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8a1414',
    zIndex: 2,
  },
  choiceArrow: {
    position: 'absolute',
    top: 1,
    right: 5,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8a5a00',
    zIndex: 2,
  },
  crunchRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 18,
    borderWidth: 3,
    borderStyle: 'dashed',
    opacity: 0.95,
  },
  crosshair: {
    fontSize: 16,
    color: '#ff5d7a',
    fontWeight: 'bold',
    opacity: 0.7,
  },
});
