import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Animated, Easing,
} from 'react-native';
import { useLayout } from '../hooks/useLayout';
import Grid from '../components/Grid';
import { LEVELS, TIER_META } from '../game/levels';
import {
  cloneGrid,
  getLegalTargets,
  executeMove,
  resolveJumps,
  hasAnyMove,
  checkWin,
  cellKey,
  getForcedChoice,
  applyForcedChoice,
} from '../game/engine';
import { PAL, PAPER, PIECE_LABELS, PREY_POINTS } from '../game/constants';
import { OrbToScore } from '../effects/OrbToScore';
import { ScoreFlyout } from '../effects/ScoreFlyout';
import Reanimated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, Easing as REasing,
} from 'react-native-reanimated';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const cellLabel = ([r, c]) => `${String.fromCharCode(65 + c)}${r + 1}`;
const isSameCell = (a, b) => a[0] === b[0] && a[1] === b[1];

export default function GameScreen({ levelIndex, onBack, onComplete }) {
  const level = LEVELS[levelIndex];

  const [displayGrid, setDisplayGrid] = useState(cloneGrid(level.grid));
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(level.moves);
  const [maxCombo, setMaxCombo] = useState(0);
  const [selected, setSel] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [phase, setPhase] = useState('play');
  const [pendingChoice, setPendingChoice] = useState(null);
  const [history, setHistory] = useState([]);
  const [dangerCells, setDanger] = useState(new Set());
  const [jumpingFrom, setJumpFrom] = useState(null);
  const [crunchCell, setCrunch] = useState(null);
  const [scorePopups, setPopups] = useState([]);
  const [flashMsg, setFlashMsg] = useState(null);
  const [showHint, setShowHint] = useState(false);

  const { isWide, scale, contentWidth, width: viewportWidth } = useLayout();
  const sz = useCallback((n) => Math.round(n * scale), [scale]);
  const gridContainerWidth = Math.min(contentWidth, viewportWidth);
  const [gridPanelWidth, setGridPanelWidth] = useState(0);

  const [orbFX, setOrbFX] = useState([]);
  const orbFXId = useRef(0);
  const [defeatFX, setDefeatFX] = useState([]);
  const defeatFXId = useRef(0);
  const gridRef = useRef(null);
  const scoreBounceRef = useRef(null);
  const scoreBoxRef = useRef(null);
  const [scorePos, setScorePos] = useState({ x: 0, y: 0 });

  const popId = useRef(0);
  const popTimers = useRef([]);
  const flashTimer = useRef(null);
  const selectedRef = useRef(null);
  const mountedRef = useRef(true);
  const phaseRef = useRef('play');
  const tierColor = TIER_META[level.tier]?.color || '#4fd04f';

  const setPhaseSync = (p) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(flashTimer.current);
      popTimers.current.forEach(clearTimeout);
      popTimers.current = [];
    };
  }, []);

  const flashKey = useRef(0);
  const showFlash = (msg, color = '#ffd700') => {
    setFlashMsg({ msg, color, key: ++flashKey.current });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashMsg(null), 1700);
  };

  const addPopup = (r, c, pts, color = '#ffd700') => {
    const id = ++popId.current;
    setPopups((p) => [...p, { id, r, c, pts, color }]);
    const t = setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1000);
    popTimers.current.push(t);
  };

  const reset = () => {
    setDisplayGrid(cloneGrid(level.grid));
    setScore(0);
    setMoves(level.moves);
    setMaxCombo(0);
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPhaseSync('play');
    setHistory([]);
    setDanger(new Set());
    setJumpFrom(null);
    setCrunch(null);
    setPopups([]);
    setFlashMsg(null);
    setShowHint(false);
    setPendingChoice(null);
    setDefeatFX([]);
  };

  const undo = () => {
    if (!history.length || phaseRef.current !== 'play') return;
    const prev = history[history.length - 1];
    setPendingChoice(null);
    setDisplayGrid(cloneGrid(prev.grid));
    setScore(prev.score);
    setMoves(prev.moves);
    setMaxCombo(prev.maxCombo);
    setHistory((h) => h.slice(0, -1));
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPhaseSync('play');
  };

  const animateJump = async (ev, currentDisplay) => {
    const [fr, fc] = ev.from;
    const [tr, tc] = ev.to;

    if (!mountedRef.current) return currentDisplay;
    setDanger(new Set([cellKey(tr, tc)]));
    await delay(600);
    if (!mountedRef.current) return currentDisplay;
    setDanger(new Set());
    await delay(50);

    if (!mountedRef.current) return currentDisplay;
    setJumpFrom({ r: fr, c: fc, toR: tr, toC: tc, pred: ev.pred });
    await delay(380);
    if (!mountedRef.current) return currentDisplay;
    setJumpFrom(null);

    const next = cloneGrid(currentDisplay);
    next[tr][tc] = ev.pred;
    next[fr][fc] = null;

    // Score popup above predator cell + orb flying to score card
    const pts = ev.pts || 0;
    addPopup(tr, tc, pts);
    gridRef.current?.measureCell(tr, tc).then(({ x, y }) => {
      const id = `orb-${++orbFXId.current}`;
      const arcSide = Math.random() < 0.5 ? 1 : -1;
      setOrbFX((prev) => [...prev, { id, sx: x, sy: y, arcSide }]);
    });

    setDisplayGrid(next);
    setCrunch({ r: tr, c: tc, color: PAL[ev.pred]?.glow || '#fff' });
    await delay(300);
    if (!mountedRef.current) return next;
    setCrunch(null);

    return next;
  };

  const finalizeTurn = useCallback((finalGrid, accPts, accEventCount, currentScore, currentMoves, currentMaxCombo) => {
    setDisplayGrid(cloneGrid(finalGrid));
    const ns = currentScore + accPts;
    const nm = currentMoves - 1;
    const nmc = Math.max(currentMaxCombo, accEventCount);
    setScore(ns);
    setMoves(nm);
    setMaxCombo(nmc);
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPhaseSync('play');

    if (checkWin(level.objective, ns, nmc, finalGrid)) {
      setTimeout(() => setPhaseSync('win'), 300);
      return;
    }
    if (nm <= 0 || !hasAnyMove(finalGrid)) {
      setTimeout(() => setPhaseSync('lose'), 300);
    }
  }, [level]);

  const handleChoiceSelect = useCallback((option) => {
    if (phaseRef.current !== 'choosing' || !pendingChoice) return;

    const choice = pendingChoice;
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPendingChoice(null);
    setPhaseSync('animating');

    (async () => {
      let current = await animateJump(
        { ...option, kind: 'choose', pts: PREY_POINTS[option.prey] || 0 },
        cloneGrid(choice.workingGrid),
      );
      if (!mountedRef.current) return;
      showFlash(
        `${PIECE_LABELS[option.pred]} eats ${PIECE_LABELS[option.prey]}! +${PREY_POINTS[option.prey] || 0}`,
        PAL[option.prey]?.glow || '#fff'
      );
      await delay(1100);
      if (!mountedRef.current) return;

      const chosen = applyForcedChoice(choice.workingGrid, option);
      const afterAuto = resolveJumps(chosen.grid);
      let newAccPts = choice.accPts + chosen.pts + afterAuto.pts;
      let newAccEventCount = choice.accEventCount + 1 + afterAuto.events.length;

      for (const ev of afterAuto.events) {
        current = await animateJump(ev, current);
        if (!mountedRef.current) return;
        showFlash(`${PIECE_LABELS[ev.pred]} eats ${PIECE_LABELS[ev.prey]}! +${PREY_POINTS[ev.prey] || 0}`, PAL[ev.prey]?.glow || '#fff');
        await delay(1100);
        if (!mountedRef.current) return;
      }
      current = afterAuto.grid;

      const nextChoice = getForcedChoice(current);
      if (nextChoice) {
        await delay(900);
        if (!mountedRef.current) return;
        setPendingChoice({
          options: nextChoice,
          accPts: newAccPts,
          accEventCount: newAccEventCount,
          workingGrid: current,
        });
        setPhaseSync('choosing');
        return;
      }

      if (newAccEventCount > 1) {
        showFlash(`Chain x${newAccEventCount}! 🔥 +${newAccPts}`, '#ffd700');
        await delay(1400);
        if (!mountedRef.current) return;
      }
      finalizeTurn(current, newAccPts, newAccEventCount, score, moves, maxCombo);
    })();
  }, [finalizeTurn, maxCombo, moves, pendingChoice, phase, score]);

  const handleChoiceTap = useCallback((r, c) => {
    if (phaseRef.current !== 'choosing' || !pendingChoice) return;
    const matches = pendingChoice.options.filter(
      (option) =>
        (option.from[0] === r && option.from[1] === c) ||
        (option.to[0] === r && option.to[1] === c)
    );
    if (matches.length === 1) {
      handleChoiceSelect(matches[0]);
    }
  }, [handleChoiceSelect, pendingChoice, phase]);

  const findChoiceOption = useCallback((sr, sc, tr, tc) => {
    if (!pendingChoice) return null;
    return (
      pendingChoice.options.find(
        (option) =>
          option.from[0] === sr &&
          option.from[1] === sc &&
          option.to[0] === tr &&
          option.to[1] === tc
      ) || null
    );
  }, [pendingChoice]);

  const runMove = useCallback((sr, sc, tr, tc) => {
    const res = executeMove(displayGrid, sr, sc, tr, tc);
    if (!res) return;

    setHistory((h) => [...h, { grid: cloneGrid(displayGrid), score, moves, maxCombo }]);
    setPhaseSync('animating');

    const afterMove = cloneGrid(displayGrid);
    afterMove[tr][tc] = afterMove[sr][sc];
    afterMove[sr][sc] = null;
    setDisplayGrid(afterMove);

    (async () => {
      let current = cloneGrid(afterMove);
      for (const ev of res.events) {
        current = await animateJump(ev, current);
        if (!mountedRef.current) return;
        showFlash(`${PIECE_LABELS[ev.pred]} eats ${PIECE_LABELS[ev.prey]}! +${PREY_POINTS[ev.prey] || 0}`, PAL[ev.prey]?.glow || '#fff');
        await delay(1100);
        if (!mountedRef.current) return;
      }
      current = res.grid;

      if (!mountedRef.current) return;
      const choice = getForcedChoice(current);
      if (choice) {
        await delay(900);
        if (!mountedRef.current) return;
        setPendingChoice({
          options: choice,
          accPts: res.pts,
          accEventCount: res.events.length,
          workingGrid: current,
        });
        setPhaseSync('choosing');
        return;
      }

      if (res.events.length > 1) {
        showFlash(`Chain x${res.events.length}! 🔥 +${res.pts}`, '#ffd700');
        await delay(1400);
        if (!mountedRef.current) return;
      }
      finalizeTurn(current, res.pts, res.events.length, score, moves, maxCombo);
    })();
  }, [displayGrid, finalizeTurn, maxCombo, moves, score]);

  const handleDragStart = useCallback((r, c) => {
    if (phaseRef.current === 'play') {
      const cell = displayGrid[r]?.[c];
      if (!cell || cell === 'G') return false;
      selectedRef.current = [r, c];
      setSel([r, c]);
      setHoveredCell([r, c]);
      return true;
    }

    if (phaseRef.current !== 'choosing' || !pendingChoice) return false;
    const matches = pendingChoice.options.filter(
      (option) => option.from[0] === r && option.from[1] === c
    );
    if (!matches.length) return false;
    selectedRef.current = [r, c];
    setSel([r, c]);
    setHoveredCell([r, c]);
    return true;
  }, [displayGrid, pendingChoice, phase]);

  const handleDragHover = useCallback((r, c) => {
    if (phaseRef.current !== 'play' && phaseRef.current !== 'choosing') return;
    setHoveredCell((prev) => {
      if (r == null || c == null) return prev == null ? prev : null;
      if (prev != null && prev[0] === r && prev[1] === c) return prev;
      return [r, c];
    });
  }, []);

  const handleDragEnd = useCallback((r, c) => {
    const dragSource = selectedRef.current || selected;

    if ((phaseRef.current !== 'play' && phaseRef.current !== 'choosing') || !dragSource) {
      selectedRef.current = null;
      setSel(null);
      setHoveredCell(null);
      return;
    }

    const [sr, sc] = dragSource;
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);

    if (r == null || c == null) return;
    if (sr === r && sc === c) return;

    if (phaseRef.current === 'choosing') {
      const option = findChoiceOption(sr, sc, r, c);
      if (option) {
        handleChoiceSelect(option);
      }
      return;
    }

    if (!targetsRef.current.has(cellKey(r, c))) return;

    runMove(sr, sc, r, c);
  }, [findChoiceOption, handleChoiceSelect, runMove, selected]);

  const targetsRef = useRef(new Set());

  const targets = useMemo(() => {
    if (selected && phase === 'play')
      return getLegalTargets(displayGrid, selected[0], selected[1]);

    if (selected && phase === 'choosing' && pendingChoice)
      return new Set(
        pendingChoice.options
          .filter((option) => isSameCell(option.from, selected))
          .map((option) => cellKey(option.to[0], option.to[1]))
      );
    return new Set();
  }, [selected, phase, pendingChoice, displayGrid]);

  const choiceCells = useMemo(() =>
    phase === 'choosing' && pendingChoice
      ? new Set(pendingChoice.options.map((option) => cellKey(option.to[0], option.to[1])))
      : new Set(),
  [phase, pendingChoice]);

  const choicePredators = useMemo(() =>
    phase === 'choosing' && pendingChoice
      ? new Set(pendingChoice.options.map((option) => cellKey(option.from[0], option.from[1])))
      : new Set(),
  [phase, pendingChoice]);

  targetsRef.current = targets;

  const pct = Math.min(100, Math.round((score / (level.objective.target || 1)) * 100));

  // ── Shared sub-sections ────────────────────────────────────────────────────
  const headerNode = useMemo(() => (
    <View style={[styles.header, { paddingHorizontal: sz(32), paddingTop: sz(14), paddingBottom: sz(6) }]}>
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { width: sz(44), height: sz(44), borderRadius: sz(17) }]}>
        <View style={[styles.backChevron, { width: sz(13), height: sz(13) }]} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.tierTag, { color: tierColor, fontSize: sz(9) }]}>
          {TIER_META[level.tier]?.label || ''}
        </Text>
        <Text style={[styles.levelName, { fontSize: sz(16) }]}>Lv {level.id} · {level.name}</Text>
      </View>
      <TouchableOpacity
        onPress={() => setShowHint((h) => !h)}
        style={[styles.backBtn, { width: sz(44), height: sz(44), borderRadius: sz(17) }, showHint && styles.backBtnActive]}
      >
        <Text style={[styles.backText, { fontSize: sz(16) }, showHint && { color: '#1a1422' }]}>i</Text>
      </TouchableOpacity>
    </View>
  ), [onBack, sz, tierColor, level, showHint]);

  const hintNode = useMemo(() => showHint ? (
    <View style={[styles.hintBox, { padding: sz(10), marginHorizontal: sz(32) }]}>
      <Text style={[styles.hintText, { fontSize: sz(12), lineHeight: sz(18) }]}>{level.hint}</Text>
    </View>
  ) : null, [showHint, sz, level]);

  const statsNode = (
    <View style={[styles.statsRow, { paddingHorizontal: sz(32), paddingBottom: sz(6), gap: sz(8) }]}>
      <ScoreStatBox
        ref={scoreBounceRef}
        boxRef={scoreBoxRef}
        value={score}
        scale={scale}
        onMeasure={setScorePos}
      />
      <StatBox label="Moves" value={moves} color={moves <= 2 ? '#e07a6a' : '#e8d9a8'} scale={scale} />
      <StatBox label="Combo" value={maxCombo > 0 ? `x${maxCombo}` : '-'} color="#d4af37" scale={scale} />
    </View>
  );

  const goalNode = useMemo(() => (
    <View style={[styles.goalCard, { marginHorizontal: sz(32), paddingHorizontal: sz(14), paddingVertical: sz(12) }]}>
      <View style={styles.goalHeader}>
        <Text style={[styles.goalEyebrow, { fontSize: sz(10) }]}>Target Score</Text>
        <Text style={[styles.goalPct, { fontSize: sz(13) }]}>{pct}%</Text>
      </View>
      <View style={styles.goalValueRow}>
        <Text style={[styles.goalNow, { fontSize: sz(30), lineHeight: sz(32) }]}>{score}</Text>
        <Text style={[styles.goalDivider, { fontSize: sz(20), lineHeight: sz(24) }]}>/</Text>
        <Text style={[styles.goalTarget, { fontSize: sz(24), lineHeight: sz(28) }]}>{level.objective.target || '?'}</Text>
        <Text style={[styles.goalUnit, { fontSize: sz(12) }]}>pts</Text>
      </View>
      <ProgressBar pct={pct} color="#d4af37" />
      <View style={styles.goalFlashSlot}>
        {phase === 'choosing' && pendingChoice ? (
          <FlashCard
            msg="Choose the next forced eat"
            color="#ffcc00"
            style={[styles.flash, { borderColor: '#ffcc0055', paddingHorizontal: sz(10), paddingVertical: sz(6) }]}
          />
        ) : flashMsg ? (
          <FlashCard
            key={flashMsg.key}
            msg={flashMsg.msg}
            color={flashMsg.color}
            style={[styles.flash, { borderColor: `${flashMsg.color}55`, paddingHorizontal: sz(10), paddingVertical: sz(6) }]}
          />
        ) : null}
      </View>
    </View>
  ), [score, pct, sz, level, flashMsg, phase, pendingChoice, handleChoiceSelect]);

  const instrText = phase === 'animating'
    ? 'Watch the chain resolve.'
    : phase === 'choosing'
    ? 'Drag a blinking predator onto the highlighted prey, or tap a blinking predator to choose it.'
    : selected
    ? 'Keep dragging to a highlighted cell, or drag back to cancel.'
    : 'Drag an animal to an empty cell or directly onto its prey.';

  const statusNode = useMemo(() => (
    <Text style={[styles.instr, { fontSize: sz(11) }]}>{instrText}</Text>
  ), [instrText, sz]);

  const flashNode = null;
  const instrNode = null;

  const choiceNode = useMemo(() => phase === 'choosing' && pendingChoice ? (
    <View style={[styles.choiceBox, { marginHorizontal: sz(32) }]}>
      <Text style={[styles.choiceTitle, { fontSize: sz(13) }]}>Choose the next forced eat</Text>
      {pendingChoice.options.map((option, index) => (
        <TouchableOpacity
          key={`${option.from.join(',')}->${option.to.join(',')}`}
          onPress={() => handleChoiceSelect(option)}
          style={styles.choiceBtn}
        >
          <Text style={[styles.choiceBtnText, { fontSize: sz(12) }]}>
            {index + 1}. {PIECE_LABELS[option.pred]} {cellLabel(option.from)} -> {PIECE_LABELS[option.prey]} {cellLabel(option.to)} (+{option.pts})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null, [phase, pendingChoice, handleChoiceSelect, sz]);

  const ctrlNode = useMemo(() => (
    <View style={[styles.ctrlRow, { paddingHorizontal: sz(32), paddingTop: sz(24), gap: sz(8) }]}>
      <TouchableOpacity
        onPress={undo}
        disabled={!history.length || phase !== 'play'}
        style={[styles.ctrlBtn, { paddingVertical: sz(11) }, (!history.length || phase !== 'play') && { opacity: 0.3 }]}
      >
        <Text style={[styles.ctrlText, { fontSize: sz(13) }]}>Undo</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={reset} style={[styles.ctrlBtn, { paddingVertical: sz(11) }]}>
        <Text style={[styles.ctrlText, { fontSize: sz(13) }]}>Reset</Text>
      </TouchableOpacity>
    </View>
  ), [history, phase, undo, reset, sz]);

  const gridNode = (
    <Grid
      ref={gridRef}
      grid={displayGrid}
      onCellPress={phase === 'choosing' ? handleChoiceTap : undefined}
      onDragStart={handleDragStart}
      onDragHover={handleDragHover}
      onDragEnd={handleDragEnd}
      dragEnabled={phase === 'play' || phase === 'choosing'}
      selected={selected}
      hoveredCell={hoveredCell}
      legalTargets={targets}
      dangerCells={dangerCells}
      choiceCells={choiceCells}
      choicePredators={choicePredators}
      jumpingFrom={jumpingFrom}
      crunchCell={crunchCell}
      scorePopups={scorePopups}
      containerWidth={gridContainerWidth - sz(32) * 2}
    />
  );

  const orbFXLayer = orbFX.map((fx) => (
    <OrbToScore
      key={fx.id}
      sx={fx.sx}
      sy={fx.sy}
      tx={scorePos.x}
      ty={scorePos.y}
      arcSide={fx.arcSide}
      onLand={() => {
        scoreBounceRef.current?.triggerBounce();
        setOrbFX((prev) => prev.filter((e) => e.id !== fx.id));
      }}
    />
  ));

  const defeatFXLayer = defeatFX.map((fx) => (
    <ScoreFlyout
      key={fx.id}
      x={fx.x}
      y={fx.y}
      score={fx.score}
      onDone={() => setDefeatFX((prev) => prev.filter((e) => e.id !== fx.id))}
    />
  ));

  const overlays = (
    <>
      {orbFXLayer}
      {defeatFXLayer}
      {phase === 'win' && (
        <ResultOverlay variant="win">
          <View style={styles.overlayCard}>
            <Text style={styles.overlayLevelTag}>LEVEL {level.id}</Text>
            <WinBurst score={score} />
            <Text style={[styles.overlayTitle, styles.overlayTitleWin]}>Level Complete!</Text>
            <Text style={styles.overlaySubtitle}>{level.name}</Text>
            <Text style={styles.overlayMoves}>
              <Text style={styles.overlayMovesStrong}>{moves} move{moves !== 1 ? 's' : ''}</Text>
              {' remaining'}
            </Text>
            {maxCombo >= 2 && (
              <Text style={styles.overlayCombo}>Best chain: x{maxCombo}</Text>
            )}
            <View style={styles.overlayBtns}>
              <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnPrimaryWin]} onPress={onComplete}>
                <Text style={[styles.overlayBtnText, styles.overlayBtnTextDark]}>Next Level</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={onBack}>
                <Text style={styles.overlayBtnText}>Level Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ResultOverlay>
      )}
      {phase === 'lose' && (
        <ResultOverlay variant="lose">
          <View style={styles.overlayCard}>
            <Text style={styles.overlayLevelTag}>LEVEL {level.id}</Text>
            <FailBadge score={score} />
            <Text style={[styles.overlayTitle, styles.overlayTitleFail]}>Out of Moves</Text>
            <Text style={styles.overlaySubtitle}>{level.name}</Text>
            <Text style={styles.overlayMoves}>
              {'Used '}
              <Text style={styles.overlayMovesStrong}>{level.moves - moves} of {level.moves}</Text>
              {' moves'}
            </Text>
            <View style={styles.overlayBtns}>
              <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnPrimaryFail]} onPress={reset}>
                <Text style={[styles.overlayBtnText, styles.overlayBtnTextDark]}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={onBack}>
                <Text style={styles.overlayBtnText}>Level Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ResultOverlay>
      )}
    </>
  );

  // ── Wide (desktop/tablet) layout ─────────────────────────────────────────
  if (isWide) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#070b06" />
        <View style={styles.wideRow}>
          <View style={styles.wideLeftPanel}>
            <ScrollView
              style={styles.wideLeftScroll}
              contentContainerStyle={styles.wideLeftContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {headerNode}
              {hintNode}
              {statsNode}
              {goalNode}
              {statusNode}
              {ctrlNode}
            </ScrollView>
          </View>

          <View
            style={styles.wideRightPanel}
            onLayout={(e) => setGridPanelWidth(e.nativeEvent.layout.width)}
          >
            {gridNode}
          </View>
        </View>
        {overlays}
      </SafeAreaView>
    );
  }

  // ── Mobile layout (unchanged) ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#070b06" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { maxWidth: contentWidth }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {headerNode}
        {hintNode}
        {statsNode}
        {goalNode}
        {statusNode}
        {gridNode}
        {ctrlNode}

      </ScrollView>

      {overlays}
    </SafeAreaView>
  );
}

function FlashCard({ msg, color, style }) {
  const punch = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    punch.setValue(0);
    Animated.sequence([
      Animated.timing(punch, { toValue: 1.55, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(punch, { toValue: 0.85, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.spring(punch, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
    ]).start();
  }, [msg]);

  return (
    <Animated.View style={[style, { transform: [{ scale: punch }] }]}>
      <Text style={{ color, fontSize: 13, fontWeight: 'bold' }}>{msg}</Text>
    </Animated.View>
  );
}

function NeonBadge({ score, accentColor, bgColor, emoji, label, pulseMs = 900 }) {
  const scale = useRef(new Animated.Value(0)).current;
  const glow  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: pulseMs, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: pulseMs, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
      {/* outer glow ring */}
      <Animated.View style={{
        position: 'absolute', width: 152, height: 152, borderRadius: 76,
        borderWidth: 2.5, borderColor: accentColor, opacity: glowOpacity,
        shadowColor: accentColor, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
      }} />
      {/* dashed inner ring */}
      <View style={{
        position: 'absolute', width: 136, height: 136, borderRadius: 68,
        borderWidth: 1.5, borderColor: accentColor, borderStyle: 'dashed', opacity: 0.35,
      }} />
      {/* badge circle */}
      <View style={{
        width: 124, height: 124, borderRadius: 62,
        backgroundColor: bgColor, borderWidth: 2, borderColor: accentColor,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: accentColor, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
      }}>
        <Text style={{ fontSize: 32, lineHeight: 36 }}>{emoji}</Text>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: accentColor, marginTop: 1 }}>{label}</Text>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 2, letterSpacing: -0.5 }}>{score} pts</Text>
      </View>
    </Animated.View>
  );
}

function WinBurst({ score }) {
  return <NeonBadge score={score} accentColor="#00ff9d" bgColor="#000d0a" emoji="🏆" label="CLEARED" pulseMs={900} />;
}

function FailBadge({ score }) {
  return <NeonBadge score={score} accentColor="#ff00cc" bgColor="#0d0010" emoji="💀" label="FAILED" pulseMs={800} />;
}

const SPARK_COUNT = 6;

function ProgressBar({ pct, color }) {
  const fill = useRef(new Animated.Value(pct / 100)).current;
  const prevPct = useRef(pct);
  const trackWidth = useRef(0);
  // Each spark: { anim: Animated.Value (0→1), x, vy, vx }
  const sparks = useRef([]);
  const [sparkTick, setSparkTick] = useState(0);

  useEffect(() => {
    const prev = prevPct.current;
    prevPct.current = pct;

    Animated.timing(fill, {
      toValue: pct / 100,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (pct > prev && trackWidth.current > 0) {
      // Spawn sparks timed to when the fill head arrives (~500ms travel)
      const arrivalDelay = 400;
      setTimeout(() => {
        const headX = (pct / 100) * trackWidth.current;
        sparks.current = Array.from({ length: SPARK_COUNT }, () => {
          const anim = new Animated.Value(0);
          const angle = (Math.random() - 0.5) * Math.PI * 0.9; // spread ±80°
          const speed = 18 + Math.random() * 20;
          Animated.timing(anim, { toValue: 1, duration: 480 + Math.random() * 120, useNativeDriver: false }).start();
          return {
            anim,
            startX: headX,
            vx: Math.cos(angle) * speed,
            vy: -(Math.abs(Math.sin(angle)) * speed + 8), // always launch upward
          };
        });
        setSparkTick(t => t + 1);
      }, arrivalDelay);
    }
  }, [pct, fill]);

  const widthPct = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.progressTrack}
      onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
    >
      <Animated.View style={[styles.progressFill, { width: widthPct, backgroundColor: color }]} />
      {/* sparks rendered above the track, overflow visible */}
      {sparks.current.map((s, i) => {
        // translate: x moves by vx*t, y moves by vy*t + gravity*(t^2)
        const translateX = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, s.vx] });
        const translateY = s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, s.vy + 30] }); // +30 gravity arc
        const opacity    = s.anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
        const scale      = s.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.3] });
        return (
          <Animated.View
            key={`${sparkTick}-${i}`}
            style={{
              position: 'absolute',
              left: s.startX - 2,
              top: -2,
              width: 4, height: 4,
              borderRadius: 2,
              backgroundColor: '#f5e090',
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

function ResultOverlay({ children, variant = 'win' }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      speed: 12,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const cardScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const accentColor = variant === 'win' ? '#00ff9d' : '#ff00cc';
  const cardBg = variant === 'win' ? 'rgba(0,18,10,0.97)' : 'rgba(12,0,16,0.97)';

  return (
    <Animated.View style={[styles.overlay, { opacity: anim }]}>
      <Animated.View style={[styles.overlayCard, {
        backgroundColor: cardBg,
        borderColor: accentColor,
        shadowColor: accentColor,
        transform: [{ scale: cardScale }],
      }]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const StatBox = React.memo(function StatBox({ label, value, color, scale = 1 }) {
  const sz = (n) => Math.round(n * scale);
  return (
    <View style={[styles.statBox, { paddingVertical: sz(9) }]}>
      <Text style={[styles.statValue, { color, fontSize: sz(20) }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: sz(9) }]}>{label}</Text>
    </View>
  );
});

const ScoreStatBox = React.memo(React.forwardRef(function ScoreStatBox({ value, scale = 1, boxRef, onMeasure }, ref) {
  const sz = (n) => Math.round(n * scale);
  const bounceScale = useSharedValue(1);
  const glowBorder  = useSharedValue(0);

  React.useImperativeHandle(ref, () => ({
    triggerBounce() {
      bounceScale.value = withSequence(
        withTiming(1.65, { duration: 120, easing: REasing.out(REasing.quad) }),
        withTiming(1.0,  { duration: 220, easing: REasing.out(REasing.back(2)) })
      );
      glowBorder.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 480 })
      );
    },
  }));

  const handleLayout = React.useCallback(() => {
    boxRef?.current?.measureInWindow((x, y, w, h) => {
      onMeasure?.({ x: x + w / 2, y: y + h / 2 });
    });
  }, [boxRef, onMeasure]);

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
    color: bounceScale.value > 1.1 ? '#FFD700' : '#e8d9a8',
  }));

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: glowBorder.value > 0.01
      ? `rgba(255,215,0,${(glowBorder.value * 0.75).toFixed(2)})`
      : '#6a5224',
  }));

  return (
    <Reanimated.View
      ref={boxRef}
      onLayout={handleLayout}
      style={[styles.statBox, { paddingVertical: sz(9) }, boxStyle]}
    >
      <Reanimated.Text style={[styles.statValue, { fontSize: sz(20) }, valueStyle]}>
        {value}
      </Reanimated.Text>
      <Text style={[styles.statLabel, { fontSize: sz(9) }]}>Score</Text>
    </Reanimated.View>
  );
}));

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },

  // ── Wide layout ────────────────────────────────────────────────────────────
  wideRow: { flex: 1, flexDirection: 'row' },
  wideLeftPanel: { width: 340, flexShrink: 0, borderRightWidth: 1, borderRightColor: 'rgba(212,175,55,0.15)' },
  wideLeftScroll: { flex: 1 },
  wideLeftContent: { paddingBottom: 40 },
  wideRightPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  backBtn: {
    backgroundColor: '#1c1426',
    borderColor: '#d4af37', borderWidth: 2,
    borderRadius: 17, width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  backBtnActive: { backgroundColor: '#d4af37' },
  backText: { color: '#d4af37', fontSize: 16, fontWeight: 'bold' },
  backChevron: {
    width: 13, height: 13,
    borderLeftWidth: 4, borderBottomWidth: 4,
    borderColor: '#d4af37',
    borderBottomLeftRadius: 4,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  tierTag: { fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#b86a2a', fontWeight: 'bold' },
  levelName: { fontSize: 16, color: '#f0e8d0', fontWeight: 'bold', marginTop: 2 },
  hintBox: {
    backgroundColor: '#fff7df', borderColor: '#ffffff',
    borderWidth: 3, borderRadius: 14, padding: 10, marginHorizontal: 16, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  hintText: { fontSize: 12, color: '#8a6a2a', lineHeight: 18 },
  statsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6,
  },
  statBox: {
    flex: 1, backgroundColor: '#1c1426',
    borderColor: '#6a5224', borderWidth: 1,
    borderRadius: 12, paddingVertical: 9, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 9, color: '#a8924a', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 },
  goalCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1c1426',
    borderColor: '#6a5224',
    borderWidth: 1,
    borderRadius: 14,
    position: 'relative',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalEyebrow: {
    fontSize: 10,
    color: '#c9a94a',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  goalPct: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#d4af37',
  },
  goalValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  goalFlashSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '25%',
    right: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalChoiceSlot: {
    alignItems: 'flex-end',
    gap: 4,
  },
  goalChoiceTitle: {
    fontSize: 11,
    color: '#c9a94a',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  goalChoiceBtn: {
    backgroundColor: '#fff9ec',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  goalChoiceBtnText: {
    fontSize: 11,
    color: '#5a3e1b',
    fontWeight: '600',
  },
  goalNow: {
    fontSize: 30,
    lineHeight: 32,
    color: '#f0e6c8',
    fontWeight: 'bold',
  },
  goalDivider: {
    fontSize: 20,
    lineHeight: 24,
    color: '#9a8454',
    marginHorizontal: 6,
    marginBottom: 3,
  },
  goalTarget: {
    fontSize: 24,
    lineHeight: 28,
    color: '#9a8454',
    fontWeight: '700',
    marginBottom: 1,
  },
  goalUnit: {
    fontSize: 12,
    color: '#9a8454',
    marginLeft: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  progressTrack: {
    height: 10,
    width: '100%',
    backgroundColor: '#2a2238',
    borderRadius: 999,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: '#6a5224',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 24,
  },
  goalCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#9a8454',
  },
  statusSlot: {
    alignItems: 'center', justifyContent: 'center', minHeight: 46, marginBottom: 4,
  },
  flash: {
    alignSelf: 'center', backgroundColor: PAPER.card,
    borderWidth: 3, borderColor: '#ffffff', borderRadius: 20, paddingHorizontal: 22, paddingVertical: 9, marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  flashText: { fontSize: 14, fontWeight: 'bold' },
  instr: { fontSize: 11, color: '#d8d2bd', textAlign: 'center', marginBottom: 4, minHeight: 18 },
  choiceBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#fff7df',
    borderColor: '#ffffff',
    borderWidth: 3,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  choiceTitle: {
    color: '#a8741a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  choiceBtn: {
    backgroundColor: PAPER.card,
    borderColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceBtnText: {
    color: PAPER.ink,
    fontSize: 12,
  },
  ctrlRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 24,
  },
  ctrlBtn: {
    flex: 1, backgroundColor: '#1c1426',
    borderColor: '#6a5224', borderWidth: 1,
    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
  },
  ctrlText: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', letterSpacing: 1.5 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  overlayCard: {
    borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center',
    width: '92%', maxWidth: 360,
    borderWidth: 1.5,
    shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 20,
  },
  overlayLevelTag: {
    fontSize: 10, fontWeight: '700', letterSpacing: 3, color: '#444466',
    marginBottom: 16, textTransform: 'uppercase',
  },
  overlayTitle: {
    fontSize: 26, fontWeight: '800', letterSpacing: 0,
    marginTop: 4, marginBottom: 4,
  },
  overlayTitleWin:  { color: '#00ff9d' },
  overlayTitleFail: { color: '#ff00cc' },
  overlaySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  overlayMoves: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  overlayMovesStrong: { color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  overlayCombo: { fontSize: 13, color: 'rgba(0,255,157,0.5)', marginBottom: 4, letterSpacing: 0.5 },
  overlayBtns: { width: '100%', gap: 10, marginTop: 20 },
  overlayBtn: {
    borderRadius: 50, paddingVertical: 15, alignItems: 'center',
    borderWidth: 0,
  },
  overlayBtnPrimaryWin: {
    backgroundColor: '#00ff9d',
    shadowColor: '#00ff9d', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  overlayBtnPrimaryFail: {
    backgroundColor: '#ff00cc',
    shadowColor: '#ff00cc', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  overlayBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  overlayBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  overlayBtnTextDark: { color: '#000', fontSize: 15, fontWeight: '800' },
});
