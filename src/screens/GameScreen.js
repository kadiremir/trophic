import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import LottieAnimation from '../components/LottieAnimation';
import completedAnimation from '../../assets/completed.json';
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
import PieceIcon from '../components/PieceIcon';
import { PAL, PIECE_LABELS, TIER_COLORS, PREY_POINTS } from '../game/constants';

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
  const [blinkOn, setBlinkOn] = useState(true);
  const [history, setHistory] = useState([]);
  const [dangerCells, setDanger] = useState(new Set());
  const [jumpingFrom, setJumpFrom] = useState(null);
  const [crunchCell, setCrunch] = useState(null);
  const [scorePopups, setPopups] = useState([]);
  const [flashMsg, setFlashMsg] = useState(null);
  const [showHint, setShowHint] = useState(false);

  const popId = useRef(0);
  const flashTimer = useRef(null);
  const selectedRef = useRef(null);
  const mountedRef = useRef(true);
  const tierColor = TIER_COLORS[level.tier] || '#4fd04f';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'choosing') {
      setBlinkOn(true);
      return;
    }
    const id = setInterval(() => setBlinkOn((b) => !b), 380);
    return () => clearInterval(id);
  }, [phase]);

  const showFlash = (msg, color = '#ffd700') => {
    setFlashMsg({ msg, color });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashMsg(null), 1700);
  };

  const addPopup = (r, c, pts) => {
    const id = ++popId.current;
    setPopups((p) => [...p, { id, r, c, pts }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1000);
  };

  const reset = () => {
    setDisplayGrid(cloneGrid(level.grid));
    setScore(0);
    setMoves(level.moves);
    setMaxCombo(0);
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPhase('play');
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
    if (!history.length || phase !== 'play') return;
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
    setPhase('play');
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
    addPopup(tr, tc, ev.pts);
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
    setPhase('play');

    if (checkWin(level.objective, ns, nmc, finalGrid)) {
      setTimeout(() => setPhase('win'), 300);
      return;
    }
    if (nm <= 0 || !hasAnyMove(finalGrid)) {
      setTimeout(() => setPhase('lose'), 300);
    }
  }, [level]);

  const handleChoiceSelect = useCallback((option) => {
    if (phase !== 'choosing' || !pendingChoice) return;

    const choice = pendingChoice;
    selectedRef.current = null;
    setSel(null);
    setHoveredCell(null);
    setPendingChoice(null);
    setPhase('animating');

    (async () => {
      showFlash(
        `${PIECE_LABELS[option.pred]} resolves first: ${cellLabel(option.from)} -> ${cellLabel(option.to)}`,
        PAL[option.pred]?.glow || '#ffd700'
      );

      let current = await animateJump(
        { ...option, kind: 'choose', pts: PREY_POINTS[option.prey] || 0 },
        cloneGrid(choice.workingGrid)
      );
      if (!mountedRef.current) return;

      const chosen = applyForcedChoice(choice.workingGrid, option);
      const afterAuto = resolveJumps(chosen.grid);
      let newAccPts = choice.accPts + chosen.pts + afterAuto.pts;
      let newAccEventCount = choice.accEventCount + 1 + afterAuto.events.length;

      for (const ev of afterAuto.events) {
        current = await animateJump(ev, current);
        if (!mountedRef.current) return;
      }
      current = afterAuto.grid;

      const nextChoice = getForcedChoice(current);
      if (nextChoice) {
        setPendingChoice({
          options: nextChoice,
          accPts: newAccPts,
          accEventCount: newAccEventCount,
          workingGrid: current,
        });
        setPhase('choosing');
        return;
      }

      finalizeTurn(current, newAccPts, newAccEventCount, score, moves, maxCombo);
    })();
  }, [finalizeTurn, maxCombo, moves, pendingChoice, phase, score]);

  const handleChoiceTap = useCallback((r, c) => {
    if (phase !== 'choosing' || !pendingChoice) return;
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
    setPhase('animating');

    const afterMove = cloneGrid(displayGrid);
    afterMove[tr][tc] = afterMove[sr][sc];
    afterMove[sr][sc] = null;
    setDisplayGrid(afterMove);

    if (res.events.length > 1) {
      showFlash(`Chain x${res.events.length}! +${res.pts}`, '#ffd700');
    } else if (res.events.length === 1) {
      const e = res.events[0];
      showFlash(`${PIECE_LABELS[e.pred]} eats ${PIECE_LABELS[e.prey]}! +${res.pts}`, PAL[e.prey]?.glow || '#fff');
    }

    (async () => {
      let current = cloneGrid(afterMove);
      for (const ev of res.events) {
        current = await animateJump(ev, current);
        if (!mountedRef.current) return;
      }
      current = res.grid;

      if (!mountedRef.current) return;
      const choice = getForcedChoice(current);
      if (choice) {
        setPendingChoice({
          options: choice,
          accPts: res.pts,
          accEventCount: res.events.length,
          workingGrid: current,
        });
        setPhase('choosing');
        showFlash('Choose which same-tier eat resolves first.', '#ffcc00');
        return;
      }

      finalizeTurn(current, res.pts, res.events.length, score, moves, maxCombo);
    })();
  }, [displayGrid, finalizeTurn, maxCombo, moves, score]);

  const handleDragStart = useCallback((r, c) => {
    if (phase === 'play') {
      const cell = displayGrid[r]?.[c];
      if (!cell || cell === 'G') return false;
      selectedRef.current = [r, c];
      setSel([r, c]);
      setHoveredCell([r, c]);
      return true;
    }

    if (phase !== 'choosing' || !pendingChoice) return false;
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
    if (phase !== 'play' && phase !== 'choosing') return;
    setHoveredCell(r == null || c == null ? null : [r, c]);
  }, [phase]);

  const handleDragEnd = useCallback((r, c) => {
    const dragSource = selectedRef.current || selected;

    if ((phase !== 'play' && phase !== 'choosing') || !dragSource) {
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

    if (phase === 'choosing') {
      const option = findChoiceOption(sr, sc, r, c);
      if (option) {
        handleChoiceSelect(option);
      }
      return;
    }

    const targets = getLegalTargets(displayGrid, sr, sc);
    if (!targets.has(cellKey(r, c))) return;

    runMove(sr, sc, r, c);
  }, [displayGrid, findChoiceOption, handleChoiceSelect, phase, runMove, selected]);

  const targets =
    selected && phase === 'play'
      ? getLegalTargets(displayGrid, selected[0], selected[1])
      : selected && phase === 'choosing' && pendingChoice
      ? new Set(
          pendingChoice.options
            .filter((option) => isSameCell(option.from, selected))
            .map((option) => cellKey(option.to[0], option.to[1]))
        )
      : new Set();

  const choiceCells =
    phase === 'choosing' && pendingChoice
      ? new Set(pendingChoice.options.map((option) => cellKey(option.to[0], option.to[1])))
      : new Set();

  const choicePredators =
    phase === 'choosing' && pendingChoice && blinkOn
      ? new Set(pendingChoice.options.map((option) => cellKey(option.from[0], option.from[1])))
      : new Set();

  const pct = Math.min(100, Math.round((score / (level.objective.target || 1)) * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#070b06" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.tierTag, { color: tierColor }]}>
              {TIER_META[level.tier]?.label || ''}
            </Text>
            <Text style={styles.levelName}>Lv {level.id} · {level.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowHint((h) => !h)}
            style={[styles.backBtn, showHint && { borderColor: '#ffd700' }]}
          >
            <Text style={[styles.backText, showHint && { color: '#ffd700' }]}>i</Text>
          </TouchableOpacity>
        </View>

        {showHint && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{level.hint}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <StatBox label="Score" value={score} color="#4fd04f" />
          <StatBox label="Moves" value={moves} color={moves <= 2 ? '#ff5555' : '#86c8ff'} />
          <StatBox label="Combo" value={maxCombo > 0 ? `x${maxCombo}` : '-'} color="#ffd700" />
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalEyebrow}>Target Score</Text>
            <Text style={[styles.goalPct, { color: tierColor }]}>{pct}%</Text>
          </View>
          <View style={styles.goalValueRow}>
            <Text style={styles.goalNow}>{score}</Text>
            <Text style={styles.goalDivider}>/</Text>
            <Text style={styles.goalTarget}>{level.objective.target || '?'}</Text>
            <Text style={styles.goalUnit}>pts</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tierColor }]} />
          </View>
          <Text style={styles.goalCaption}>{level.objective.label}</Text>
        </View>

        {flashMsg && (
          <View style={[styles.flash, { borderColor: `${flashMsg.color}55` }]}>
            <Text style={[styles.flashText, { color: flashMsg.color }]}>{flashMsg.msg}</Text>
          </View>
        )}

        <Text style={styles.instr}>
          {phase === 'animating'
            ? 'Watch the chain resolve.'
            : phase === 'choosing'
            ? 'Drag a blinking predator onto the highlighted prey, or tap a blinking predator to choose it.'
            : selected
            ? 'Keep dragging to a highlighted cell, or drag back to cancel.'
            : 'Drag an animal to an empty cell or directly onto its prey.'}
        </Text>

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
        />

        {phase === 'choosing' && pendingChoice && (
          <View style={styles.choiceBox}>
            <Text style={styles.choiceTitle}>Choose the next forced eat</Text>
            {pendingChoice.options.map((option, index) => (
              <TouchableOpacity
                key={`${option.from.join(',')}->${option.to.join(',')}`}
                onPress={() => handleChoiceSelect(option)}
                style={styles.choiceBtn}
              >
                <Text style={styles.choiceBtnText}>
                  {index + 1}. {PIECE_LABELS[option.pred]} {cellLabel(option.from)} -> {PIECE_LABELS[option.prey]} {cellLabel(option.to)} (+{option.pts})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.chainRow}>
          {['G', 'R', 'F', 'W', 'B', 'D'].slice(0, level.tier + 2).map((token, i, arr) => (
            <View key={token} style={styles.chainItem}>
              <View style={[styles.chainBadge, { backgroundColor: PAL[token].bg, borderColor: PAL[token].border }]}>
                <PieceIcon token={token} size={26} />
              </View>
              {i < arr.length - 1 && <Text style={styles.chainArrow}>{'->'}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.ctrlRow}>
          <TouchableOpacity
            onPress={undo}
            disabled={!history.length || phase !== 'play'}
            style={[styles.ctrlBtn, (!history.length || phase !== 'play') && { opacity: 0.3 }]}
          >
            <Text style={styles.ctrlText}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={styles.ctrlBtn}>
            <Text style={styles.ctrlText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {phase === 'win' && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <LottieAnimation
                source={completedAnimation}
                autoPlay={true}
                loop={false}
                style={styles.winLottie}
              />
              <Text style={styles.overlayTitle}>Level Complete!</Text>
              <Text style={[styles.overlayScore, { color: '#4fd04f' }]}>{score} pts</Text>
              {maxCombo >= 2 && (
                <Text style={styles.overlayCombo}>Best chain: x{maxCombo}</Text>
              )}
              <View style={styles.overlayBtns}>
                <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#256b25' }]} onPress={onComplete}>
                  <Text style={styles.overlayBtnText}>Next Level</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#1a2a1a' }]} onPress={reset}>
                  <Text style={styles.overlayBtnText}>Replay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#222' }]} onPress={onBack}>
                  <Text style={styles.overlayBtnText}>Level Select</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {phase === 'lose' && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>Stop</Text>
              <Text style={styles.overlayTitle}>Out of Moves</Text>
              <Text style={[styles.overlayScore, { color: '#888' }]}>{score} / {level.objective.target || '?'}</Text>
              <View style={styles.overlayBtns}>
                <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#6e1a1a' }]} onPress={reset}>
                  <Text style={styles.overlayBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#222' }]} onPress={onBack}>
                  <Text style={styles.overlayBtnText}>Level Select</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  backText: { color: '#888', fontSize: 15 },
  tierTag: { fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' },
  levelName: { fontSize: 16, color: '#e8dfc0', fontWeight: 'bold', marginTop: 2 },
  hintBox: {
    backgroundColor: 'rgba(255,215,0,0.06)', borderColor: 'rgba(255,215,0,0.22)',
    borderWidth: 1, borderRadius: 10, padding: 10, marginHorizontal: 16, marginBottom: 6,
  },
  hintText: { fontSize: 12, color: '#e8d080', lineHeight: 18 },
  statsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6,
  },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1,
    borderRadius: 10, paddingVertical: 7, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 9, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  goalCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderRadius: 14,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalEyebrow: {
    fontSize: 10,
    color: '#7d836f',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  goalPct: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  goalNow: {
    fontSize: 30,
    lineHeight: 32,
    color: '#f5f0dd',
    fontWeight: 'bold',
  },
  goalDivider: {
    fontSize: 20,
    lineHeight: 24,
    color: '#6e735f',
    marginHorizontal: 6,
    marginBottom: 3,
  },
  goalTarget: {
    fontSize: 24,
    lineHeight: 28,
    color: '#b8b29a',
    fontWeight: '700',
    marginBottom: 1,
  },
  goalUnit: {
    fontSize: 12,
    color: '#7d836f',
    marginLeft: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  goalCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca18f',
  },
  flash: {
    alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.9)',
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 9, marginBottom: 4,
  },
  flashText: { fontSize: 14, fontWeight: 'bold' },
  instr: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 4, minHeight: 18 },
  choiceBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderColor: 'rgba(255,204,0,0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  choiceTitle: {
    color: '#ffe08a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  choiceBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceBtnText: {
    color: '#f2ead0',
    fontSize: 12,
  },
  chainRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 8, opacity: 0.75, flexWrap: 'wrap', paddingHorizontal: 16,
  },
  chainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chainBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainArrow: {
    marginHorizontal: 8,
    color: '#ccc',
    fontSize: 16,
    fontWeight: '700',
  },
  ctrlRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8,
  },
  ctrlBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
  },
  ctrlText: { color: '#999', fontSize: 13 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  overlayCard: {
    backgroundColor: '#0a0f08', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderRadius: 20, padding: 32, alignItems: 'center', width: '85%', maxWidth: 300,
  },
  overlayEmoji: { fontSize: 30, fontWeight: 'bold', color: '#e8dfc0' },
  winLottie: { width: 120, height: 120, marginBottom: -8 },
  overlayTitle: { fontSize: 24, fontWeight: 'bold', color: '#e8dfc0', marginTop: 10, marginBottom: 4 },
  overlayScore: { fontSize: 20, marginBottom: 4 },
  overlayCombo: { fontSize: 14, color: '#ffd700', marginBottom: 8 },
  overlayBtns: { width: '100%', gap: 8, marginTop: 18 },
  overlayBtn: { borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  overlayBtnText: { color: '#fff', fontSize: 14 },
});
