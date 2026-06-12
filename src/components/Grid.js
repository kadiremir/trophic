import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, PanResponder, Animated, Easing, Platform } from 'react-native';
import Cell from './Cell';
import JumpSprite from './JumpSprite';
import ScorePopup from './ScorePopup';
import PieceIcon from './PieceIcon';
import { GRID_SIZE, STICKER } from '../game/constants';
import { cellKey } from '../game/engine';

const GRID_PADDING = 12;
const CELL_GAP = 5;
const BOARD_INSET = 10;

const getCellFromPoint = (x, y, cellSize) => {
  const cellSpan = cellSize + CELL_GAP;
  const col = Math.floor(x / cellSpan);
  const row = Math.floor(y / cellSpan);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
  return [row, col];
};

const getCellOrigin = (row, col, cellSize, boardOffsetX) => ({
  x: GRID_PADDING + boardOffsetX + col * (cellSize + CELL_GAP) + CELL_GAP / 2,
  y: GRID_PADDING + row * (cellSize + CELL_GAP) + CELL_GAP / 2,
});

const Grid = React.memo(React.forwardRef(function Grid({
  grid,
  onCellPress,
  onDragStart,
  onDragHover,
  onDragEnd,
  dragEnabled = false,
  selected,
  hoveredCell,
  legalTargets,
  dangerCells,
  choiceCells,
  choicePredators,
  jumpingFrom,
  crunchCell,
  scorePopups = [],
  containerWidth,
}, ref) {
  const { width } = useWindowDimensions();
  // containerWidth is passed by the desktop layout so we size relative to the
  // panel rather than the full window. Cap at 540 on desktop, 460 on mobile.
  const gridWidth = containerWidth
    ? containerWidth - GRID_PADDING * 2
    : Math.min(width - GRID_PADDING * 2, 460 - GRID_PADDING * 2);
  const cellSize = Math.floor((gridWidth - CELL_GAP * (GRID_SIZE + 1)) / GRID_SIZE);
  const boardSize = GRID_SIZE * (cellSize + CELL_GAP);
  const boardOffsetX = Math.max(0, (gridWidth - boardSize) / 2);
  const boardRef = useRef(null);
  const containerRef = useRef(null);
  const cellSizeRef = useRef(cellSize);
  const boardOffsetXRef = useRef(boardOffsetX);
  cellSizeRef.current = cellSize;
  boardOffsetXRef.current = boardOffsetX;

  useImperativeHandle(ref, () => ({
    // Measure cell center in window-space by using the container's measureInWindow
    // plus the same getCellOrigin geometry. More reliable on web than measuring
    // the inner board ref (whose alignSelf:center can mislead on some platforms).
    measureCell: (r, c) => new Promise((resolve) => {
      const cs = cellSizeRef.current;
      const offsetX = boardOffsetXRef.current;
      containerRef.current?.measureInWindow((cLeft, cTop) => {
        resolve({
          x: cLeft + GRID_PADDING + offsetX + c * (cs + CELL_GAP) + CELL_GAP / 2 + cs / 2,
          y: cTop  + GRID_PADDING + r * (cs + CELL_GAP) + CELL_GAP / 2 + cs / 2,
        });
      });
    }),
  }), []);

  const dragStartPoint = useRef(null);
  const dragging = useRef(false);
  const dragSourceRef = useRef(null);
  const activePointerId = useRef(null);
  const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragLift = useRef(new Animated.Value(0)).current;
  const dragPulse = useRef(new Animated.Value(0)).current;
  const [dragSprite, setDragSprite] = useState(null);

  useEffect(() => {
    if (!dragSprite) {
      dragPulse.stopAnimation();
      dragPulse.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dragPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dragPulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      dragPulse.setValue(0);
    };
  }, [dragPulse, dragSprite]);

  const finishDrag = useCallback(() => {
    dragging.current = false;
    dragStartPoint.current = null;
    dragSourceRef.current = null;
    activePointerId.current = null;
    setDragSprite(null);
  }, []);

  const startDragAtPoint = useCallback((x, y) => {
    if (!dragEnabled) return false;

    const cell = getCellFromPoint(x, y, cellSize);
    dragStartPoint.current = { x, y };
    if (!cell) {
      dragging.current = false;
      return false;
    }

    dragging.current = onDragStart ? onDragStart(cell[0], cell[1]) !== false : false;
    if (!dragging.current) return false;

    const piece = grid[cell[0]]?.[cell[1]];
    const origin = getCellOrigin(cell[0], cell[1], cellSize, boardOffsetX);
    dragSourceRef.current = cell;
    dragTranslate.setValue(origin);
    dragLift.setValue(0);
    setDragSprite({ piece, from: cell });
    Animated.spring(dragLift, {
      toValue: 1,
      speed: 18,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
    if (onDragHover) onDragHover(cell[0], cell[1]);
    return true;
  }, [boardOffsetX, cellSize, dragEnabled, dragLift, dragTranslate, grid, onDragHover, onDragStart]);

  const moveDragToPoint = useCallback((x, y) => {
    if (!dragEnabled || !dragging.current || !dragStartPoint.current || !onDragHover) return;

    const dx = x - dragStartPoint.current.x;
    const dy = y - dragStartPoint.current.y;
    if (dragSourceRef.current) {
      const origin = getCellOrigin(dragSourceRef.current[0], dragSourceRef.current[1], cellSize, boardOffsetX);
      dragTranslate.setValue({
        x: origin.x + dx,
        y: origin.y + dy,
      });
    }

    const cell = getCellFromPoint(x, y, cellSize);
    if (!cell) {
      onDragHover(null, null);
      return;
    }
    onDragHover(cell[0], cell[1]);
  }, [boardOffsetX, cellSize, dragEnabled, dragTranslate, onDragHover]);

  const endDragAtPoint = useCallback((x, y) => {
    if (!dragEnabled || !dragging.current || !onDragEnd || !dragStartPoint.current) {
      finishDrag();
      return;
    }

    const cell = getCellFromPoint(x, y, cellSize);
    onDragEnd(cell ? cell[0] : null, cell ? cell[1] : null);
    finishDrag();
  }, [cellSize, dragEnabled, finishDrag, onDragEnd]);

  const getBoardPointFromPointer = useCallback((nativeEvent) => {
    const rect = boardRef.current?.getBoundingClientRect?.();
    if (!rect || nativeEvent.clientX == null || nativeEvent.clientY == null) return null;
    return {
      x: nativeEvent.clientX - rect.left,
      y: nativeEvent.clientY - rect.top,
    };
  }, []);

  // Keep a ref to the latest drag callbacks so PanResponder/pointer handlers
  // never need to be recreated when the callbacks change — only when dragEnabled changes.
  const dragCbRef = useRef(null);
  dragCbRef.current = { startDragAtPoint, moveDragToPoint, endDragAtPoint, finishDrag, onDragEnd, getBoardPointFromPointer };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => dragEnabled,
        onMoveShouldSetPanResponder: () => dragEnabled,
        onStartShouldSetPanResponderCapture: () => dragEnabled,
        onMoveShouldSetPanResponderCapture: () => dragEnabled,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          dragCbRef.current.startDragAtPoint(locationX, locationY);
        },
        onPanResponderMove: (_, gestureState) => {
          const x = dragStartPoint.current.x + gestureState.dx;
          const y = dragStartPoint.current.y + gestureState.dy;
          dragCbRef.current.moveDragToPoint(x, y);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!dragStartPoint.current) {
            dragCbRef.current.finishDrag();
            return;
          }
          const x = dragStartPoint.current.x + gestureState.dx;
          const y = dragStartPoint.current.y + gestureState.dy;
          dragCbRef.current.endDragAtPoint(x, y);
        },
        onPanResponderTerminate: () => {
          if (dragging.current && dragCbRef.current.onDragEnd) dragCbRef.current.onDragEnd(null, null);
          dragCbRef.current.finishDrag();
        },
      }),
    [dragEnabled]
  );

  const webPointerHandlers = useMemo(() => Platform.OS !== 'web' || !dragEnabled ? null : ({
        onPointerDown: (event) => {
          const nativeEvent = event.nativeEvent;
          const point = dragCbRef.current.getBoardPointFromPointer(nativeEvent);
          if (!point) return;

          nativeEvent.preventDefault?.();
          nativeEvent.stopPropagation?.();
          if (!dragCbRef.current.startDragAtPoint(point.x, point.y)) return;

          activePointerId.current = nativeEvent.pointerId;
          nativeEvent.target?.setPointerCapture?.(nativeEvent.pointerId);
        },
        onPointerMove: (event) => {
          const nativeEvent = event.nativeEvent;
          if (!dragging.current || nativeEvent.pointerId !== activePointerId.current) return;
          const point = dragCbRef.current.getBoardPointFromPointer(nativeEvent);
          if (!point) return;

          nativeEvent.preventDefault?.();
          dragCbRef.current.moveDragToPoint(point.x, point.y);
        },
        onPointerUp: (event) => {
          const nativeEvent = event.nativeEvent;
          if (nativeEvent.pointerId !== activePointerId.current) return;
          const point = dragCbRef.current.getBoardPointFromPointer(nativeEvent);

          nativeEvent.preventDefault?.();
          nativeEvent.target?.releasePointerCapture?.(nativeEvent.pointerId);
          if (point) {
            dragCbRef.current.endDragAtPoint(point.x, point.y);
          } else {
            dragCbRef.current.finishDrag();
          }
        },
        onPointerCancel: (event) => {
          const nativeEvent = event.nativeEvent;
          if (nativeEvent.pointerId !== activePointerId.current) return;
          nativeEvent.target?.releasePointerCapture?.(nativeEvent.pointerId);
          if (dragging.current && dragCbRef.current.onDragEnd) dragCbRef.current.onDragEnd(null, null);
          dragCbRef.current.finishDrag();
        },
  }), [dragEnabled]);

  const dragGlowScale = dragPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  const dragGlowOpacity = dragPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View ref={containerRef} style={[styles.container, { padding: GRID_PADDING }, containerWidth ? { width: containerWidth } : null]}>
      <View
        pointerEvents="none"
        style={[
          styles.boardPanel,
          containerWidth ? {
            left: 0,
            top: GRID_PADDING - BOARD_INSET,
            width: containerWidth,
            height: boardSize + BOARD_INSET * 2,
          } : {
            left: GRID_PADDING + boardOffsetX - BOARD_INSET,
            top: GRID_PADDING - BOARD_INSET,
            width: boardSize + BOARD_INSET * 2,
            height: boardSize + BOARD_INSET * 2,
          },
        ]}
      />

      {dragSprite?.piece && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragSpriteWrap,
            {
              width: cellSize,
              height: cellSize,
              transform: [
                { translateX: dragTranslate.x },
                { translateY: dragTranslate.y },
                {
                  translateY: dragLift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12],
                  }),
                },
                {
                  rotate: dragLift.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-5deg'],
                  }),
                },
                {
                  scale: dragLift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.12],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.dragGlow,
              {
                backgroundColor: 'rgba(244,183,64,0.18)',
                borderColor: 'rgba(244,183,64,0.55)',
                opacity: dragGlowOpacity,
                transform: [{ scale: dragGlowScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dragSprite,
              {
                backgroundColor: (STICKER[dragSprite.piece] || STICKER.E).fill,
                borderColor: '#ffffff',
                shadowColor: '#000000',
                transform: [
                  {
                    scale: dragLift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.04],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.dragHighlight} />
            <PieceIcon token={dragSprite.piece} size={cellSize * 0.92} />
          </Animated.View>
        </Animated.View>
      )}

      {jumpingFrom && (
        <JumpSprite
          pred={jumpingFrom.pred}
          fromR={jumpingFrom.r}
          fromC={jumpingFrom.c}
          toR={jumpingFrom.toR}
          toC={jumpingFrom.toC}
          cellSize={cellSize}
          gridPadding={GRID_PADDING}
          boardOffsetX={boardOffsetX}
        />
      )}

      {scorePopups.map((p) => {
        const origin = getCellOrigin(p.r, p.c, cellSize, boardOffsetX);
        return (
          <ScorePopup
            key={p.id}
            pts={p.pts}
            x={origin.x - CELL_GAP / 2}
            y={origin.y - CELL_GAP / 2}
            cellSize={cellSize}
            color={p.color}
          />
        );
      })}

      <View
        ref={boardRef}
        style={[styles.board, { width: boardSize, height: boardSize }]}
        {...(Platform.OS === 'web' ? webPointerHandlers : dragEnabled ? panResponder.panHandlers : {})}
      >
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const k = cellKey(r, c);
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isTgt = legalTargets.has(k);
              const isHunt = isTgt && cell !== null;
              const isDanger = dangerCells.has(k);
              const isChoice = choiceCells?.has(k);
              const isChoicePred = choicePredators?.has(k);
              const isJumpSrc = jumpingFrom?.r === r && jumpingFrom?.c === c;
              const isCrunch = crunchCell?.r === r && crunchCell?.c === c;
              const isHover = hoveredCell?.[0] === r && hoveredCell?.[1] === c;
              const isDragSource = dragSprite?.from?.[0] === r && dragSprite?.from?.[1] === c;

              return (
                <Cell
                  key={c}
                  cell={cell}
                  row={r}
                  col={c}
                  size={cellSize}
                  onCellPress={onCellPress}
                  isSelected={isSel}
                  isChoicePred={isChoicePred}
                  isHovered={isHover}
                  isTarget={isTgt && !isHunt}
                  isHuntTarget={isHunt}
                  isDanger={isDanger}
                  isChoiceTarget={isChoice}
                  isJumpSrc={isJumpSrc}
                  isGhosted={isDragSource}
                  isCrunch={isCrunch}
                  crunchColor={crunchCell?.color}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}));

export default Grid;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
  },
  boardPanel: {
    position: 'absolute',
    backgroundColor: '#1c1426',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#6a5224',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dragSpriteWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 30,
  },
  dragGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 18,
    borderWidth: 2,
  },
  dragSprite: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  dragHighlight: {
    position: 'absolute',
    top: 3,
    left: 5,
    right: 5,
    height: '38%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  board: {
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? {
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }
      : null),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
