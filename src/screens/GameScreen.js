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
    setDisplayGrid(next);
    setCrunch({ r: tr, c: tc, color: PAL[ev.pred]?.glow || '#fff' });
    addPopup(tr, tc, ev.pts, PAL[ev.prey]?.glow || '#ffd700');
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
        cloneGrid(choice.workingGrid)
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

  const statsNode = useMemo(() => (
    <View style={[styles.statsRow, { paddingHorizontal: sz(32), paddingBottom: sz(6), gap: sz(8) }]}>
      <StatBox label="Score" value={score} color="#e8d9a8" scale={scale} />
      <StatBox label="Moves" value={moves} color={moves <= 2 ? '#e07a6a' : '#e8d9a8'} scale={scale} />
      <StatBox label="Combo" value={maxCombo > 0 ? `x${maxCombo}` : '-'} color="#d4af37" scale={scale} />
    </View>
  ), [score, moves, maxCombo, sz, scale]);

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

  const overlays = (
    <>
      {phase === 'win' && (
        <ResultOverlay>
          <View style={styles.overlayCard}>
            <WinBurst />
            <Text style={styles.overlayTitle}>Level Complete!</Text>
            <Text style={[styles.overlayScore, { color: '#3a6b1f' }]}>{score} pts</Text>
            {maxCombo >= 2 && (
              <Text style={styles.overlayCombo}>Best chain: x{maxCombo}</Text>
            )}
            <View style={styles.overlayBtns}>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#8fe06f' }]} onPress={onComplete}>
                <Text style={styles.overlayBtnText}>Next Level</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#ffd98a' }]} onPress={reset}>
                <Text style={styles.overlayBtnText}>Replay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#efe3cb' }]} onPress={onBack}>
                <Text style={styles.overlayBtnText}>Level Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ResultOverlay>
      )}
      {phase === 'lose' && (
        <ResultOverlay>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>Stop</Text>
            <Text style={styles.overlayTitle}>Out of Moves</Text>
            <Text style={[styles.overlayScore, { color: PAPER.inkSoft }]}>{score} / {level.objective.target || '?'}</Text>
            <View style={styles.overlayBtns}>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#ff9a9a' }]} onPress={reset}>
                <Text style={styles.overlayBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#efe3cb' }]} onPress={onBack}>
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

function WinBurst() {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }], opacity, width: 80, height: 80, borderRadius: 40, backgroundColor: '#4caf50', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
      <Text style={{ fontSize: 40, lineHeight: 48 }}>✓</Text>
    </Animated.View>
  );
}

function ProgressBar({ pct, color }) {
  const fill = useRef(new Animated.Value(pct / 100)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const prevPct = useRef(pct);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: pct / 100,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (pct > prevPct.current) {
      glow.setValue(0);
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]).start();
    }
    prevPct.current = pct;
  }, [pct, fill, glow]);

  const widthPct = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: widthPct, backgroundColor: color },
        ]}
      >
        <Animated.View
          style={[
            styles.progressGlow,
            { backgroundColor: '#ffffff', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
          ]}
        />
      </Animated.View>
    </View>
  );
}

function ResultOverlay({ children }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      speed: 12,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const cardScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: anim }]}>
      <Animated.View style={{ opacity: anim, transform: [{ scale: cardScale }] }}>
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#6a5224',
  },
  progressFill: { height: '100%', borderRadius: 999, overflow: 'hidden' },
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
    backgroundColor: 'rgba(90,74,58,0.55)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  overlayCard: {
    backgroundColor: PAPER.card, borderColor: '#ffffff', borderWidth: 5,
    borderRadius: 24, padding: 32, alignItems: 'center', width: '85%', maxWidth: 300,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 16,
  },
  overlayEmoji: { fontSize: 30, fontWeight: 'bold', color: PAPER.ink },
  overlayTitle: { fontSize: 24, fontWeight: 'bold', color: PAPER.ink, marginTop: 10, marginBottom: 4 },
  overlayScore: { fontSize: 20, marginBottom: 4, fontWeight: 'bold' },
  overlayCombo: { fontSize: 14, color: '#c98a2e', marginBottom: 8 },
  overlayBtns: { width: '100%', gap: 8, marginTop: 18 },
  overlayBtn: {
    borderRadius: 14, paddingVertical: 11, alignItems: 'center',
    borderWidth: 3, borderColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  overlayBtnText: { color: '#5a4a3a', fontSize: 14, fontWeight: 'bold' },
});
