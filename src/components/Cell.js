import React, { useCallback, useRef, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Animated } from 'react-native';
import { STICKER, PAPER } from '../game/constants';
import PieceIcon from './PieceIcon';

function Cell({
  cell,
  row,
  col,
  onCellPress,
  isSelected,
  isChoicePred,
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

  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isChoicePred) {
      blinkAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); blinkAnim.setValue(1); };
  }, [isChoicePred, blinkAnim]);

  const sk = STICKER[cell || 'E'];
  const isEmpty = !cell;
  // Stickers are slapped down at playful angles; lifted ones straighten out.
  const lifted = isSelected || isChoicePred || isHovered || isCrunch || isChoiceTarget;
  const restAngle = (row + col) % 2 === 0 ? -4 : 4;

  const tileScale = lifted ? 1.07 : 1;
  const tileAngle = lifted || (isEmpty && !isTarget) ? 0 : restAngle;
  const blinkStyle = isChoicePred ? { opacity: blinkAnim } : null;

  const emojiScale = isCrunch ? 1.35 : (isSelected || isHovered) ? 1.08 : isDanger ? 0.85 : isChoiceTarget ? 1.1 : 1;

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
          style={{ transform: [{ scale: emojiScale }] }}
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
      backgroundColor: isDanger ? '#ff6b6b'
        : isChoiceTarget ? PAPER.gold
        : isEmpty ? (isTarget ? 'rgba(212,175,55,0.18)' : 'transparent')
        : sk.fill,
      transform: [{ rotate: `${tileAngle}deg` }, { scale: tileScale }],
    },
    isGhosted && styles.ghostedCell,
    isDanger || isChoiceTarget
      ? { borderColor: '#fff', borderWidth: 4, borderStyle: 'solid' }
      : (isSelected || isChoicePred || isHovered)
        ? { borderColor: PAPER.gold, borderWidth: 4, borderStyle: 'solid' }
        : isHuntTarget
          ? { borderColor: '#ff5d7a', borderWidth: 4, borderStyle: 'dashed' }
          : isEmpty
            ? (isTarget ? { borderColor: '#d4af37', borderWidth: 3, borderStyle: 'dashed' } : { borderColor: '#5a4a2a', borderWidth: 2, borderStyle: 'dashed' })
            : { borderColor: '#fff', borderWidth: 4, borderStyle: 'solid' },
    isEmpty && !isTarget ? {}
      : isCrunch
        ? { shadowColor: crunchColor || '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 12 }
        : lifted || isHuntTarget
          ? { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 8 }
          : { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  ];

  if (!onCellPress) {
    return (
      <Animated.View style={blinkStyle}>
        <View style={sharedStyle}>{content}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={blinkStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={sharedStyle}
      >
        {content}
      </TouchableOpacity>
    </Animated.View>
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
