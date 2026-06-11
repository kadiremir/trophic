import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Pressable,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { LinearGradient } from 'expo-linear-gradient';
import { LEVELS, TIER_META } from '../game/levels';
import { PAL, PIECE_IMAGES } from '../game/constants';
import PieceIcon from '../components/PieceIcon';
import FoodChainShowcase from '../components/FoodChainShowcase';
import ContinueButton from '../components/ContinueButton';
import HowToPlayButton from '../components/HowToPlayButton';

// Derive apex species token from chain string e.g. "G->R->F->W" → 'W'
function NewBadge() {
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }], backgroundColor: '#f4a400', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>NEW</Text>
    </Animated.View>
  );
}

function apexTokenForTier(chain) {
  const tokens = chain.split('->');
  return tokens[tokens.length - 1] || 'F';
}

export default function MenuScreen({ unlocked, completed, onSelect, active = true }) {
  const { isWide, scale, contentWidth } = useLayout();
  const sz = React.useCallback((n) => Math.round(n * scale), [scale]);
  const [showHowToPlay, setShowHowToPlay] = React.useState(false);

  // First unlocked level that hasn't been completed yet
  const nextLevel = LEVELS.findIndex((_, li) => li < unlocked && !completed.has(li));

  // Only expand the tier containing the next incomplete level
  const currentTierIndex = TIER_META.findIndex((tier) => tier.levels.includes(nextLevel));
  const [expandedTiers, setExpandedTiers] = React.useState(
    () => currentTierIndex >= 0 ? new Set([currentTierIndex]) : new Set()
  );

  // Re-sync when unlocked/completed change (e.g. after Google sign-in loads progress)
  React.useEffect(() => {
    const next = LEVELS.findIndex((_, li) => li < unlocked && !completed.has(li));
    const ti = TIER_META.findIndex((tier) => tier.levels.includes(next));
    setExpandedTiers(ti >= 0 ? new Set([ti]) : new Set());
  }, [unlocked, completed]);
  const scrollRef = React.useRef(null);
  const tierYs = React.useRef({});
  const toggleLock = React.useRef(false);

  const toggleTier = (ti) => {
    if (toggleLock.current) return;
    toggleLock.current = true;
    setTimeout(() => { toggleLock.current = false; }, 400);

    setExpandedTiers((prev) => {
      const next = new Set(prev);
      const wasExpanded = next.has(ti);
      wasExpanded ? next.delete(ti) : next.add(ti);
      if (!wasExpanded) {
        setTimeout(() => {
          const y = tierYs.current[ti];
          if (y != null && scrollRef.current) {
            scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
          }
        }, 120);
      }
      return next;
    });
  };

  const tierList = React.useMemo(() => TIER_META.map((tier, ti) => {
    const isExpanded = expandedTiers.has(ti);
    const allLocked = tier.levels.every((li) => li >= unlocked);
    const completedCount = tier.levels.filter((li) => completed.has(li)).length;
    const apexToken = apexTokenForTier(tier.chain);
    return (
      <View
        key={ti}
        style={[styles.tierWrapper, { marginBottom: sz(12), paddingHorizontal: sz(32) }]}
        onLayout={(e) => { tierYs.current[ti] = e.nativeEvent.layout.y; }}
      >
        <TierCard
          tier={tier}
          levels={LEVELS}
          unlocked={unlocked}
          completed={completed}
          nextLevel={nextLevel}
          isExpanded={isExpanded}
          allLocked={allLocked}
          completedCount={completedCount}
          apexToken={apexToken}
          onToggle={() => !allLocked && toggleTier(ti)}
          onSelect={onSelect}
          scale={scale}
        />
      </View>
    );
  }), [expandedTiers, unlocked, completed, nextLevel, onSelect, scale, sz]);

  if (isWide) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#070b06" />
        <View style={styles.wideRow}>
          {/* Left column: branding + meta */}
          <View style={styles.wideLeft}>
            <ScrollView
              style={styles.wideColScroll}
              contentContainerStyle={styles.wideLeftContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.wideHero}>
                <TrophicHeroBrand wide />
                <FoodChainShowcase active={active} containerWidth={380} />
              </View>
              {nextLevel >= 0 && (
                <ContinueButton
                  subLabel={`Next Level: ${LEVELS[nextLevel].id}`}
                  accent={currentTierIndex >= 0 ? TIER_META[currentTierIndex].color : '#ff9824'}
                  onPress={() => onSelect(nextLevel)}
                />
              )}
              <ProgressSummary
                tiers={TIER_META}
                levels={LEVELS}
                unlocked={unlocked}
                completed={completed}
              />
              <HowToPlayButton onPress={() => setShowHowToPlay(true)} />
            </ScrollView>
          </View>

          {/* Divider */}
          <View style={styles.wideDivider} />

          {/* Right column: tier accordion */}
          <View style={styles.wideRight}>
            <ScrollView
              ref={scrollRef}
              style={styles.wideColScroll}
              contentContainerStyle={styles.wideRightContent}
              showsVerticalScrollIndicator={false}
            >
              {tierList}
            </ScrollView>
          </View>
        </View>

        <HowToPlayModal
          visible={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#070b06" />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { maxWidth: contentWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingBottom: sz(24), paddingHorizontal: sz(32) }]}>
          <TrophicHeroBrand scale={scale} />
          <FoodChainShowcase active={active} containerWidth={contentWidth} />
        </View>

        {nextLevel >= 0 && (
          <ContinueButton
            subLabel={`Next Level: ${LEVELS[nextLevel].id}`}
            accent={currentTierIndex >= 0 ? TIER_META[currentTierIndex].color : '#ff9824'}
            onPress={() => onSelect(nextLevel)}
          />
        )}

        <ProgressSummary
          tiers={TIER_META}
          levels={LEVELS}
          unlocked={unlocked}
          completed={completed}
          scale={scale}
        />

        {tierList}

        <HowToPlayButton onPress={() => setShowHowToPlay(true)} />
      </ScrollView>

      <HowToPlayModal
        visible={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </SafeAreaView>
  );
}

// ── ProgressSummary ──────────────────────────────────────────────────────────
const ProgressSummary = React.memo(function ProgressSummary({ tiers, levels, unlocked, completed, scale = 1 }) {
  const sz = (n) => Math.round(n * scale);
  const totalCompleted = completed.size;
  const totalLevels = levels.length;

  const activeTierIndex = tiers.findIndex((tier) =>
    tier.levels.some((li) => li < unlocked) &&
    tier.levels.some((li) => !completed.has(li))
  );

  return (
    <View style={[psStyles.card, { marginHorizontal: sz(32), marginBottom: sz(20), paddingVertical: sz(14), paddingHorizontal: sz(16), gap: sz(10) }]}>
      <View style={psStyles.headerRow}>
        <Text style={[psStyles.headerLabel, { fontSize: sz(10) }]}>OVERALL PROGRESS</Text>
        <Text style={[psStyles.headerCount, { fontSize: sz(13) }]}>{totalCompleted} / {totalLevels}</Text>
      </View>

      <View style={psStyles.segmentBar}>
        {tiers.map((tier, ti) => {
          const tierLevels = tier.levels;
          const tierTotal = tierLevels.length;
          const tierDone = tierLevels.filter((li) => completed.has(li)).length;
          const tierUnlocked = tierLevels.some((li) => li < unlocked);
          const fillRatio = tierTotal > 0 ? tierDone / tierTotal : 0;

          return (
            <View key={ti} style={[psStyles.segmentTrack, ti > 0 && { marginLeft: 3 }]}>
              <View
                style={[
                  psStyles.segmentFill,
                  {
                    width: `${fillRatio * 100}%`,
                    backgroundColor: tierUnlocked ? tier.color : 'rgba(255,255,255,0.12)',
                    ...(Platform.OS === 'web' && tierUnlocked
                      ? { boxShadow: `0 0 6px ${tier.color}88` }
                      : {}),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={psStyles.pillRow}>
        {tiers.map((tier, ti) => {
          const tierLevels = tier.levels;
          const tierDone = tierLevels.filter((li) => completed.has(li)).length;
          const tierUnlocked = tierLevels.some((li) => li < unlocked);
          const isActive = ti === activeTierIndex;
          const firstWord = tier.label.split(' ')[0];

          if (!tierUnlocked) {
            return (
              <View key={ti} style={[psStyles.pill, psStyles.pillLocked, { paddingTop: sz(6), paddingBottom: sz(5), paddingHorizontal: sz(4), gap: sz(2) }]}>
                <Text style={[psStyles.pillLockEmoji, { fontSize: sz(10) }]}>🔒</Text>
                <Text style={[psStyles.pillLabel, { color: 'rgba(255,255,255,0.28)', fontSize: sz(8) }]}>
                  {firstWord}
                </Text>
              </View>
            );
          }

          return (
            <View
              key={ti}
              style={[
                psStyles.pill,
                { paddingTop: sz(6), paddingBottom: sz(5), paddingHorizontal: sz(4), gap: sz(2) },
                isActive
                  ? { backgroundColor: `${tier.color}18`, borderColor: `${tier.color}66` }
                  : { backgroundColor: `${tier.color}0d`, borderColor: `${tier.color}28` },
              ]}
            >
              <Text style={[psStyles.pillCount, { color: tier.color, fontSize: sz(10) }]}>
                {tierDone}/{tierLevels.length}
              </Text>
              <Text style={[psStyles.pillLabel, { color: isActive ? tier.color : `${tier.color}99`, fontSize: sz(8) }]}>
                {firstWord}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const psStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(8,16,12,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  },
  headerCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8dfc0',
  },
  segmentBar: {
    flexDirection: 'row',
    height: 5,
  },
  segmentTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 999,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 5,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1,
    gap: 2,
  },
  pillLocked: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillLockEmoji: {
    fontSize: 10,
    lineHeight: 13,
  },
  pillCount: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  pillLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 11,
  },
});

// ── CometSweep ───────────────────────────────────────────────────────────────
function CometSweep({ color, visible }) {
  const x = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 2800,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [x, visible]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 900],
  });

  const gradientColors = [
    'transparent',
    `${color}66`,  // ~40% opacity
    `${color}99`,  // ~60% opacity (bright center)
    `${color}66`,
    'transparent',
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cometSweep,
        { transform: [{ translateX }, { skewX: '-20deg' }] },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── TierCard ────────────────────────────────────────────────────────────────
function TierCard({
  tier, levels, unlocked, completed, nextLevel,
  isExpanded, allLocked, completedCount, apexToken,
  onToggle, onSelect, scale = 1,
}) {
  const sz = (n) => Math.round(n * scale);
  // Both layouts stay mounted at all times — toggling display:none instead of
  // unmounting avoids animation state resets on rapid taps.
  return (
    <View>
      {/* Collapsed pill — hidden when expanded */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        style={[styles.tierPill, { borderColor: tier.color, display: isExpanded ? 'none' : 'flex', paddingVertical: sz(10), paddingLeft: sz(12), paddingRight: sz(18), gap: sz(14) }]}
      >
        {allLocked && <CometSweep color={tier.color} visible={!isExpanded} />}
        <View style={[styles.tierPillIcon, { borderColor: tier.color, backgroundColor: `${tier.color}22`, width: sz(46), height: sz(46), borderRadius: sz(23) }]}>
          {allLocked
            ? <Text style={[styles.tierPillIconText, { fontSize: sz(18) }]}>🔒</Text>
            : <PieceIcon token={apexToken} size={sz(28)} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tierPillLabel, { color: tier.color, fontSize: sz(14) }]}>{tier.label}</Text>
          <Text style={[styles.tierPillSub, { fontSize: sz(10) }]}>
            {allLocked
              ? `${tier.levels.length} levels locked`
              : `${completedCount}/${tier.levels.length} completed`}
          </Text>
        </View>
        <Text style={[styles.tierChevron, { color: `${tier.color}aa`, fontSize: sz(22) }]}>›</Text>
      </TouchableOpacity>

      {/* Expanded card — hidden when collapsed */}
      <View style={[styles.tierCardExpanded, { backgroundColor: tier.color, display: isExpanded ? 'flex' : 'none' }]}>
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.85}
          style={styles.tierCardHeader}
        >
          {allLocked
            ? <Text style={[styles.tierCardHeaderIcon, { fontSize: sz(18) }]}>🔒</Text>
            : <PieceIcon token={apexToken} size={sz(28)} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.tierCardHeaderLabel, { color: tier.color, fontSize: sz(13) }]}>{tier.label}</Text>
            <Text style={[styles.tierCardHeaderSub, { fontSize: sz(10) }]}>
              {allLocked
                ? `${tier.levels.length} levels locked`
                : `${completedCount}/${tier.levels.length} completed`}
            </Text>
          </View>
          <Text style={styles.tierCardChevronOpen}>›</Text>
        </TouchableOpacity>

        <View style={[styles.tierCardRows, { padding: sz(10), gap: sz(7) }]}>
          {tier.levels.map((li, rowIdx) => {
            const lv = levels[li];
            const locked = li >= unlocked;
            const done = completed.has(li);
            const isNew = !done && !locked && li === nextLevel;

            return (
              <TouchableOpacity
                key={lv.id}
                disabled={locked}
                onPress={() => !locked && onSelect(li)}
                activeOpacity={0.75}
                style={[
                  styles.lvRowCard,
                  { transform: [{ rotate: rowIdx % 2 === 0 ? '0.3deg' : '-0.3deg' }], paddingVertical: sz(9), paddingHorizontal: sz(12), gap: sz(10), marginBottom: sz(4) },
                  locked && styles.lvRowCardLocked,
                ]}
              >
                <View style={[
                  styles.lvRowNum,
                  {
                    backgroundColor: done ? '#1a1a1a' : locked ? '#ddd' : tier.color,
                    borderColor: '#1a1a1a',
                    width: sz(28), height: sz(28), borderRadius: sz(6),
                  },
                ]}>
                  <Text style={[styles.lvRowNumText, { color: done ? tier.color : locked ? '#aaa' : '#fff', fontSize: sz(12) }]}>
                    {done ? '✓' : lv.id}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.lvRowName, { fontSize: sz(12) }, locked && { color: '#aaa' }]}>{lv.name}</Text>
                  <Text style={[styles.lvRowObj, { fontSize: sz(10) }, locked && { color: '#ccc' }]}>{lv.objective.label}</Text>
                </View>

                {locked && (
                  <View style={styles.lvRowLockContainer}>
                    <Text style={styles.lvRowLockIcon}>🔒</Text>
                  </View>
                )}
                {isNew && (
                  <View style={styles.lvRowNewBadge}>
                    <NewBadge />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const HERO_STARS = [
  { left: '3%', top: 64, size: 1, opacity: 0.75 },
  { left: '9%', top: 28, size: 2, opacity: 0.42 },
  { left: '26%', top: 102, size: 1, opacity: 0.24 },
  { left: '70%', top: 26, size: 1, opacity: 0.58 },
  { left: '84%', top: 82, size: 2, opacity: 0.26 },
  { left: '96%', top: 42, size: 1, opacity: 0.38 },
];

function TrophicHeroBrand({ wide = false, scale = 1 }) {
  const { width: viewportWidth, contentWidth: cw } = useLayout();
  const sz = (n) => Math.round(n * scale);
  const appShellWidth = Math.min(viewportWidth, cw);
  const titleAvailableWidth = appShellWidth - sz(32) * 2 - sz(16) * 2;
  const titleFontSize = Math.min(sz(64), Math.floor((titleAvailableWidth - 24) / 6.5));

  const dropAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'trophic-rainbow-style';
      let el = document.getElementById(styleId);
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = `
        @keyframes trophic-flow {
          0%   { background-position: 200% 50%; }
          100% { background-position: 0% 50%; }
        }
        #trophic-title {
          background: linear-gradient(90deg,
            hsl(0,95%,65%), hsl(51,95%,65%), hsl(102,95%,65%),
            hsl(153,95%,65%), hsl(204,95%,65%), hsl(255,95%,65%),
            hsl(306,95%,65%), hsl(0,95%,65%));
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: trophic-flow 4s linear infinite;
          transform: translateZ(0);
          will-change: background-position;
        }
      `;
    }

    Animated.parallel([
      Animated.spring(dropAnim, {
        toValue: 1,
        speed: 10,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const translateY = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-titleFontSize * 1.5, 0],
  });

  return (
    <View style={[styles.heroBrand, wide && styles.heroBrandWide, { height: sz(140), paddingHorizontal: sz(16), paddingTop: sz(8), marginBottom: sz(10) }]}>
      {HERO_STARS.map((star, index) => (
        <View
          key={index}
          style={[
            styles.heroStar,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
      <Animated.Text
        nativeID="trophic-title"
        numberOfLines={1}
        style={[
          styles.title,
          wide && styles.titleWide,
          {
            fontSize: titleFontSize,
            lineHeight: Math.round(titleFontSize * 1.19),
            opacity: opacityAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        TROPHIC
      </Animated.Text>
      <Text style={[styles.subtitle, wide && styles.subtitleWide, { fontSize: Math.round(titleFontSize * 0.2), marginTop: sz(10) }]}>CHAIN OF NATURE</Text>
    </View>
  );
}

function HowToPlayModal({ visible, onClose }) {
  const [step, setStep] = React.useState(0);
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const prevStep = React.useRef(0);

  React.useEffect(() => {
    if (!visible) setStep(0);
  }, [visible]);

  const goToStep = React.useCallback((next) => {
    const dir = next > prevStep.current ? 1 : -1;
    prevStep.current = next;
    slideAnim.setValue(dir * 60);
    setStep(next);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 20 }).start();
  }, [slideAnim]);

  const STEPS = [
    {
      title: 'The Food Chain',
      body: 'Every animal eats the tier directly below it. This chain is the foundation of every move you make.',
      Visual: ChainPyramidVisual,
      notes: [],
    },
    {
      title: 'Moving & Eating',
      body: 'Move a predator next to its prey — if it has exactly one adjacent prey, it eats automatically. You can also move to empty cells to reposition.',
      Visual: MoveVisual,
      notes: ['Move in all 8 directions', 'Land adjacent to prey → auto-eat', 'Drop on same cell to cancel'],
    },
    {
      title: 'Scoring Points',
      body: 'You earn points for every piece that gets eaten. Higher tiers are worth much more — aim for the top of the chain.',
      Visual: PointsVisual,
      notes: [],
    },
    {
      title: 'Chain Reactions',
      body: 'After your move, if a predator has exactly one adjacent prey it eats automatically — and this can cascade into a long chain.',
      Visual: CascadeVisual,
      notes: ['You only move one piece per turn', 'The board keeps resolving until stable', 'Plan your setup to trigger long cascades'],
    },
    {
      title: 'Forced Choices',
      body: 'If a predator can reach two or more prey after a move, the game pauses and asks you to choose which one it eats.',
      Visual: ChoiceVisual,
      notes: ['Blinking piece = waiting for your input', 'Amber highlighted cells = valid targets', 'Your choice shapes the rest of the cascade'],
    },
    {
      title: 'Combos',
      body: 'Every eat event in a single turn counts toward your combo. A well-set chain can fire 4–5 eats from one move.',
      Visual: ComboVisual,
      notes: ['Combo = total eats in one turn', 'Your best combo is shown in the HUD', 'Some levels require a minimum combo to win'],
    },
  ];

  const current = STEPS[step];
  const { Visual } = current;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalShell} onPress={() => {}}>
          <View style={styles.modalCard}>
            <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
              <Text style={styles.modalTitle}>{current.title}</Text>
              <Text style={styles.modalBody}>{current.body}</Text>

              <View style={styles.modalVisual}>
                <Visual key={step} />
              </View>

              <View style={styles.modalNotes}>
                {current.notes.map((note) => (
                  <Text key={note} style={styles.modalNoteText}>· {note}</Text>
                ))}
              </View>
            </Animated.View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => goToStep(step - 1)}
                disabled={step === 0}
                style={[styles.modalNavBtn, styles.modalNavBtnSecondary, step === 0 && styles.modalNavBtnDisabled]}
              >
                <Text style={[styles.modalNavIcon, step === 0 && styles.modalNavTextDisabled]}>{'<'}</Text>
                <Text style={[styles.modalNavText, step === 0 && styles.modalNavTextDisabled]}>Previous</Text>
              </TouchableOpacity>

              <View style={styles.modalDots}>
                {STEPS.map((s, index) => (
                  <View key={s.title} style={[styles.modalDot, index === step && styles.modalDotActive]} />
                ))}
              </View>

              {step < STEPS.length - 1 ? (
                <TouchableOpacity onPress={() => goToStep(step + 1)} style={[styles.modalNavBtn, styles.modalNavBtnPrimary]}>
                  <Text style={styles.modalNavTextPrimary}>Next</Text>
                  <Text style={styles.modalNavIconPrimary}>{'>'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onClose} style={styles.modalDoneBtn}>
                  <Text style={styles.modalDoneText}>Got it</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Slide 1: Food Chain pyramid (stacked rectangles) ─────────────────────────
const PYRAMID_ROWS = [
  { token: 'D', emoji: '🦖', width: 60  },
  { token: 'B', emoji: '🐻', width: 102 },
  { token: 'W', emoji: '🐺', width: 144 },
  { token: 'F', emoji: '🦊', width: 186 },
  { token: 'R', emoji: '🐰', width: 228 },
  { token: 'G', emoji: '🌱', width: 270 },
];

function ChainPyramidVisual() {
  const [shown, setShown] = React.useState([false, false, false, false, false, false]);

  React.useEffect(() => {
    let cancelled = false;
    const ORDER = [5, 4, 3, 2, 1, 0];
    const BUILD_DELAY = 150;
    const STEP_MS = 160;
    const HOLD_MS = 1600;
    const RESET_MS = 200;
    const TOTAL_BUILD = BUILD_DELAY + ORDER.length * STEP_MS;

    function runCycle() {
      if (cancelled) return;
      ORDER.forEach((tierIdx, order) => {
        setTimeout(() => {
          if (cancelled) return;
          setShown((prev) => { const n = [...prev]; n[tierIdx] = true; return n; });
        }, BUILD_DELAY + order * STEP_MS);
      });
      setTimeout(() => {
        if (cancelled) return;
        setShown([false, false, false, false, false, false]);
        setTimeout(() => { if (!cancelled) runCycle(); }, RESET_MS);
      }, TOTAL_BUILD + HOLD_MS);
    }

    runCycle();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      {PYRAMID_ROWS.map((row, i) => (
        <View
          key={row.token}
          style={{
            width: row.width,
            height: 36,
            borderRadius: 4,
            backgroundColor: PAL[row.token].bg,
            borderWidth: 1,
            borderColor: PAL[row.token].border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: shown[i] ? 1 : 0,
            // CSS transition via style on web
            transition: 'opacity 0.2s ease-out',
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24 }}>{row.emoji}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Slide 2: Move → adjacent → auto-eat animation ───────────────────────────
// Shows: [Fox] [empty cell] [Rabbit]
// Fox moves into the empty middle cell → Rabbit auto-eats with AUTO label
function MoveVisual() {
  const rabbitX     = React.useRef(new Animated.Value(0)).current;
  const autoOpacity = React.useRef(new Animated.Value(0)).current;
  const autoScale   = React.useRef(new Animated.Value(0.6)).current;
  const grassOp     = React.useRef(new Animated.Value(1)).current;
  const ptsScale    = React.useRef(new Animated.Value(0)).current;

  const CELL = 66; // cell width + gap

  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(600),
      // Rabbit slides left next to Grass
      Animated.timing(rabbitX, { toValue: -CELL, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      Animated.delay(200),
      // AUTO badge pops in
      Animated.parallel([
        Animated.timing(autoOpacity, { toValue: 1,   duration: 150, useNativeDriver: true }),
        Animated.timing(autoScale,   { toValue: 1,   duration: 150, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // Grass eaten, +1 pops
      Animated.parallel([
        Animated.timing(grassOp,  { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ptsScale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      // reset
      Animated.parallel([
        Animated.timing(rabbitX,     { toValue: 0,   duration: 0, useNativeDriver: true }),
        Animated.timing(autoOpacity, { toValue: 0,   duration: 0, useNativeDriver: true }),
        Animated.timing(autoScale,   { toValue: 0.6, duration: 0, useNativeDriver: true }),
        Animated.timing(grassOp,     { toValue: 1,   duration: 0, useNativeDriver: true }),
        Animated.timing(ptsScale,    { toValue: 0,   duration: 0, useNativeDriver: true }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      {/* AUTO badge */}
      <Animated.View style={{ opacity: autoOpacity, transform: [{ scale: autoScale }] }}>
        <View style={{ backgroundColor: 'rgba(79,208,79,0.18)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: '#4fd04f', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>AUTO-EAT</Text>
        </View>
      </Animated.View>

      {/* 2-cell row: Grass | Rabbit (Rabbit slides left onto Grass) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Grass with +1 label */}
        <View style={{ position: 'relative' }}>
          <Animated.View style={{ opacity: grassOp }}>
            <PieceDemoTile token="G" variant="target" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: -16, left: 0, right: 0, alignItems: 'center', transform: [{ scale: ptsScale }] }}>
            <Text style={{ color: '#4fd04f', fontSize: 13, fontWeight: '900' }}>+1</Text>
          </Animated.View>
        </View>
        {/* Rabbit moves left */}
        <Animated.View style={{ transform: [{ translateX: rabbitX }] }}>
          <PieceDemoTile token="R" variant="selected" />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Slide 3: Points pop-in ───────────────────────────────────────────────────
const PREY_POINTS_DISPLAY = [
  { token: 'G', pts: 1 },
  { token: 'R', pts: 3 },
  { token: 'F', pts: 8 },
  { token: 'W', pts: 20 },
  { token: 'B', pts: 48 },
];

function PointsVisual() {
  const scales = React.useRef(PREY_POINTS_DISPLAY.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    const popIn = Animated.stagger(130,
      scales.map((s) => Animated.spring(s, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }))
    );
    const reset = Animated.parallel(scales.map((s) => Animated.timing(s, { toValue: 0, duration: 0, useNativeDriver: true })));
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(200), popIn, Animated.delay(1400), reset, Animated.delay(100)])
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 }}>
      {PREY_POINTS_DISPLAY.map(({ token, pts }, i) => (
        <Animated.View key={token} style={{ alignItems: 'center', gap: 5, transform: [{ scale: scales[i] }] }}>
          <PieceBadge token={token} />
          <Text style={{ color: PAL[token].glow, fontSize: 11, fontWeight: '800' }}>{pts}pt{pts > 1 ? 's' : ''}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Slide 4: Cascade animation ───────────────────────────────────────────────
// Layout: [Fox] [Grass] [Rabbit]
// Step 1: Rabbit jumps left onto Grass (+1 AUTO)
// Step 2: Fox jumps right onto Rabbit (+3 AUTO)
const CELL_GAP = 66; // 56px tile + 10px gap

function CascadeVisual() {
  // Layout: Fox | Grass | Rabbit
  // Step 1: Rabbit slides LEFT onto Grass (center) → Grass eaten (+1)
  // Step 2: Fox lights up and slides RIGHT onto Rabbit at center → Rabbit eaten (+3)
  const rabbitX  = React.useRef(new Animated.Value(0)).current;
  const foxX     = React.useRef(new Animated.Value(0)).current;
  const grassOp  = React.useRef(new Animated.Value(1)).current;
  const pts1Op   = React.useRef(new Animated.Value(0)).current;
  const auto1Sc  = React.useRef(new Animated.Value(0)).current;
  const rabbitOp = React.useRef(new Animated.Value(1)).current;
  const pts2Op   = React.useRef(new Animated.Value(0)).current;
  const auto2Sc  = React.useRef(new Animated.Value(0)).current;
  const [foxVariant, setFoxVariant] = React.useState('normal');

  React.useEffect(() => {
    let cancelled = false;
    // Cycle timings (ms)
    const HOLD_START = 700;
    const RABBIT_SLIDE = 380;
    const GRASS_FADE = 160;
    const BETWEEN = 450;
    const FOX_GLOW = 200;
    const FOX_SLIDE = 380;
    const RABBIT_FADE = 160;
    const HOLD_END = 900;
    const TOTAL = HOLD_START + RABBIT_SLIDE + GRASS_FADE + BETWEEN + FOX_GLOW + FOX_SLIDE + RABBIT_FADE + HOLD_END;

    function runCycle() {
      if (cancelled) return;
      // Reset
      rabbitX.setValue(0); foxX.setValue(0); grassOp.setValue(1);
      rabbitOp.setValue(1); pts1Op.setValue(0); pts2Op.setValue(0);
      auto1Sc.setValue(0); auto2Sc.setValue(0);
      setFoxVariant('normal');

      const t0 = HOLD_START;
      // Step 1: Rabbit slides left
      setTimeout(() => {
        if (cancelled) return;
        Animated.timing(rabbitX, { toValue: -CELL_GAP, duration: RABBIT_SLIDE, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }).start();
      }, t0);
      // Grass fades
      const t1 = t0 + RABBIT_SLIDE;
      setTimeout(() => {
        if (cancelled) return;
        Animated.parallel([
          Animated.timing(grassOp, { toValue: 0, duration: GRASS_FADE, useNativeDriver: true }),
          Animated.timing(pts1Op,  { toValue: 1, duration: GRASS_FADE, useNativeDriver: true }),
          Animated.timing(auto1Sc, { toValue: 1, duration: GRASS_FADE, useNativeDriver: true }),
        ]).start();
      }, t1);
      // Clear step-1 badges and start step 2: Fox glows
      const t2 = t1 + GRASS_FADE + BETWEEN;
      setTimeout(() => {
        if (cancelled) return;
        pts1Op.setValue(0); auto1Sc.setValue(0);
        setFoxVariant('selected');
      }, t2);
      // Fox slides right
      const t3 = t2 + FOX_GLOW;
      setTimeout(() => {
        if (cancelled) return;
        Animated.timing(foxX, { toValue: CELL_GAP, duration: FOX_SLIDE, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }).start();
      }, t3);
      // Rabbit fades
      const t4 = t3 + FOX_SLIDE;
      setTimeout(() => {
        if (cancelled) return;
        Animated.parallel([
          Animated.timing(rabbitOp, { toValue: 0, duration: RABBIT_FADE, useNativeDriver: true }),
          Animated.timing(pts2Op,   { toValue: 1, duration: RABBIT_FADE, useNativeDriver: true }),
          Animated.timing(auto2Sc,  { toValue: 1, duration: RABBIT_FADE, useNativeDriver: true }),
        ]).start();
      }, t4);
      // Loop
      setTimeout(() => { if (!cancelled) runCycle(); }, TOTAL);
    }
    runCycle();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 72 }}>

        {/* Fox: slides right onto center */}
        <View style={{ position: 'relative', width: 56 }}>
          <Animated.View style={{ transform: [{ translateX: foxX }] }}>
            <PieceDemoTile token="F" variant={foxVariant} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: -18, left: CELL_GAP, right: -CELL_GAP, alignItems: 'center', opacity: pts2Op }}>
            <Text style={{ color: '#ff9824', fontSize: 12, fontWeight: '900' }}>+3</Text>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: -30, left: CELL_GAP - 16, right: -CELL_GAP + 16, alignItems: 'center', transform: [{ scale: auto2Sc }] }}>
            <View style={{ backgroundColor: 'rgba(79,208,79,0.18)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: '#4fd04f', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>AUTO</Text>
            </View>
          </Animated.View>
        </View>

        {/* Grass: center, fades when Rabbit eats it */}
        <View style={{ position: 'relative', width: 56 }}>
          <Animated.View style={{ opacity: grassOp }}>
            <PieceDemoTile token="G" variant="normal" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: -18, left: 0, right: 0, alignItems: 'center', opacity: pts1Op }}>
            <Text style={{ color: '#4fd04f', fontSize: 12, fontWeight: '900' }}>+1</Text>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: -30, left: -16, right: -16, alignItems: 'center', transform: [{ scale: auto1Sc }] }}>
            <View style={{ backgroundColor: 'rgba(79,208,79,0.18)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: '#4fd04f', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>AUTO</Text>
            </View>
          </Animated.View>
        </View>

        {/* Rabbit: slides left onto center, fades when Fox eats */}
        <View style={{ position: 'relative', width: 56 }}>
          <Animated.View style={{ opacity: rabbitOp, transform: [{ translateX: rabbitX }] }}>
            <PieceDemoTile token="R" variant="selected" />
          </Animated.View>
        </View>

      </View>
    </View>
  );
}

// ── Slide 5: Forced choice blink ─────────────────────────────────────────────
function ChoiceVisual() {
  const blink = React.useRef(new Animated.Value(1)).current;
  const rabbitGlow = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,    duration: 380, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rabbitGlow, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(rabbitGlow, { toValue: 0.4, duration: 380, useNativeDriver: true }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      <Text style={{ color: '#d4af37', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>YOU CHOOSE</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Animated.View style={{ opacity: blink }}>
          <PieceDemoTile token="F" variant="blink" />
        </Animated.View>
        <Animated.View style={{ opacity: rabbitGlow }}>
          <PieceDemoTile token="R" variant="prey" />
        </Animated.View>
        <Animated.View style={{ opacity: blink }}>
          <PieceDemoTile token="F" variant="blink" />
        </Animated.View>
      </View>
      <Text style={{ color: '#8f9a87', fontSize: 10, textAlign: 'center' }}>Two foxes want the same rabbit</Text>
    </View>
  );
}

// ── Slide 6: Combo counter ───────────────────────────────────────────────────
function ComboVisual() {
  const [count, setCount] = React.useState(0);
  const countScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    let cancelled = false;
    let timer;
    const bump = (n) => {
      if (cancelled) return;
      setCount(n);
      Animated.sequence([
        Animated.timing(countScale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
        Animated.timing(countScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
      ]).start();
      if (n < 4) {
        timer = setTimeout(() => bump(n + 1), 700);
      } else {
        timer = setTimeout(() => { if (!cancelled) { setCount(0); } }, 1200);
        timer = setTimeout(() => bump(1), 2000);
      }
    };
    timer = setTimeout(() => bump(1), 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const color = count >= 4 ? '#ff9824' : count >= 3 ? '#d4af37' : count >= 2 ? '#4fd04f' : '#8f9a87';

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['F', 'W', 'R', 'G'].map((token) => (
          <PieceBadge key={token} token={token} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: '#8f9a87', fontSize: 12, fontWeight: '600' }}>Combo</Text>
        <Animated.View style={{ transform: [{ scale: countScale }] }}>
          <Text style={{ color, fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>
            {count > 0 ? `×${count}` : '—'}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

function PieceDemoTile({ token, variant }) {
  return (
    <View
      style={[
        styles.demoTile,
        { backgroundColor: PAL[token].bg, borderColor: PAL[token].border },
        variant === 'selected' && styles.demoSelected,
        variant === 'target' && styles.demoTarget,
        variant === 'prey' && styles.demoPrey,
        variant === 'blink' && styles.demoBlink,
      ]}
    >
      <PieceIcon token={token} size={42} />
    </View>
  );
}

function PieceBadge({ token }) {
  return (
    <View style={[styles.chainBadge, { backgroundColor: PAL[token].bg, borderColor: PAL[token].border }]}>
      <PieceIcon token={token} size={34} />
    </View>
  );
}

function FlowArrow({ compact = false }) {
  return (
    <View style={[styles.flowArrow, compact && styles.flowArrowCompact]}>
      <View style={styles.flowArrowGlow}>
        <View style={[styles.flowArrowShaft, compact && styles.flowArrowShaftCompact]} />
        <View style={styles.flowArrowHead} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', paddingTop: 0, paddingBottom: 24, paddingHorizontal: 20 },

  // ── Wide layout ─────────────────────────────────────────────────────────
  wideRow: { flex: 1, flexDirection: 'row' },
  wideLeft: { width: 380, flexShrink: 0, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)' },
  wideColScroll: { flex: 1 },
  wideLeftContent: { paddingBottom: 40 },
  wideHero: { alignItems: 'center', paddingTop: 0, paddingBottom: 16, paddingHorizontal: 16 },
  wideRight: { flex: 1 },
  wideRightContent: { paddingTop: 16, paddingBottom: 40, maxWidth: 560, alignSelf: 'center', width: '100%' },
  wideDivider: { width: 1, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.06)' },

  heroBrandWide: { height: 140, marginHorizontal: -16, paddingHorizontal: 12 },
  titleWide: { fontSize: 52, lineHeight: 64, letterSpacing: 2 },
  subtitleWide: { fontSize: 12, letterSpacing: 5 },
  heroBrand: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    paddingHorizontal: 16,
    paddingTop: 8,
    marginHorizontal: 0,
    marginBottom: 10,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  heroStar: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#e8e4d9',
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    ...(Platform.OS !== 'web' && { color: '#e8e4d9' }),
    letterSpacing: 4,
    lineHeight: 76,
    fontFamily: Platform.select({
      web: 'Cinzel Decorative, Georgia, serif',
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia',
    }),
    ...(Platform.OS !== 'web' && {
      textShadowColor: 'rgba(0, 229, 195, 0.32)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 20,
    }),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    color: '#00e5c3',
    letterSpacing: 6,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: Platform.select({ web: 'Nunito, sans-serif', default: undefined }),
    opacity: 0.82,
  },

  // ── Tier accordion ─────────────────────────────────────────────────────
  tierWrapper: { marginBottom: 12, paddingHorizontal: 16 },

  // Collapsed pill
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(8,16,12,0.84)',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  cometSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 80,
  },
  tierPillIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tierPillIconText: { fontSize: 18 },
  tierPillLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tierPillSub: { fontSize: 10, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  tierChevron: { fontSize: 22, fontWeight: '700', lineHeight: 24 },

  // Expanded card — "Comic Bold"
  tierCardExpanded: {
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1a1a1a',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: { elevation: 8 },
      web: { boxShadow: '5px 5px 0 #1a1a1a' },
    }),
  },
  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tierCardHeaderIcon: { fontSize: 18 },
  tierCardHeaderLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tierCardHeaderSub: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  tierCardChevronOpen: {
    marginLeft: 'auto',
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    transform: [{ rotate: '90deg' }],
  },
  tierCardRows: { padding: 10, gap: 7 },

  // Level row cards inside expanded tier
  lvRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#1a1a1a',
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: { elevation: 4 },
      web: { boxShadow: '3px 3px 0 #1a1a1a' },
    }),
  },
  lvRowCardLocked: { opacity: 0.55 },
  lvRowNum: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  lvRowNumText: { fontSize: 12, fontWeight: '900' },
  lvRowName: { fontSize: 12, fontWeight: '900', color: '#1a1a1a' },
  lvRowObj: { fontSize: 10, color: '#666' },
  lvRowLockContainer: {
    width: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvRowLockIcon: { fontSize: 14, opacity: 0.6 },
  lvRowNewBadge: {
    width: 45,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── How to Play button ─────────────────────────────────────────────────
  howToPlayBtn: {
    alignSelf: 'center',
    minWidth: 170,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(3, 28, 33, 0.95)',
    borderColor: 'rgba(0, 229, 195, 0.24)',
    borderWidth: 1,
    marginBottom: 2,
    shadowColor: '#00e5c3',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  howToPlayText: {
    color: '#bff5ec',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Modal ──────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalShell: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 14 },
  modalCard: {
    width: '100%',
    height: 480,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    position: 'relative',
    backgroundColor: '#0d140b',
    borderColor: 'rgba(79,208,79,0.18)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  modalCloseBtn: {
    minWidth: 132,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  modalCloseText: { color: '#c6cec0', fontSize: 14, fontWeight: '700', letterSpacing: 0.4 },
  modalTitle: { color: '#4fd04f', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10, paddingHorizontal: 24 },
  modalBody: { color: '#bcc7b4', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  modalVisual: { marginTop: 20, minHeight: 92, alignItems: 'center', justifyContent: 'center' },
  modalChainRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  modalDemoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  demoTile: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  demoSelected: { borderColor: '#ffd700', shadowColor: '#ffd700', shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  demoTarget: { borderColor: '#ff6050', shadowColor: '#ff6050', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  demoPrey: { borderColor: '#ffcc00', shadowColor: '#ffcc00', shadowOpacity: 0.45, shadowRadius: 12, elevation: 7 },
  demoBlink: { borderColor: '#4fd04f', shadowColor: '#4fd04f', shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  flowArrow: { width: 42, height: 24, alignItems: 'center', justifyContent: 'center' },
  flowArrowCompact: { width: 40 },
  flowArrowGlow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 2, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(79,208,79,0.08)', borderColor: 'rgba(79,208,79,0.12)', borderWidth: 1,
  },
  flowArrowShaft: { width: 18, height: 2.5, borderRadius: 999, backgroundColor: '#4fd04f', shadowColor: '#4fd04f', shadowOpacity: 0.35, shadowRadius: 5 },
  flowArrowShaftCompact: { width: 16 },
  flowArrowHead: { marginLeft: -1, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#4fd04f' },
  chainBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  choicePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  modalNotes: { marginTop: 18, gap: 6 },
  modalNoteText: { color: '#8f9a87', fontSize: 12, lineHeight: 18 },
  modalFooter: { position: 'absolute', bottom: 18, left: 22, right: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  modalNavBtn: { minWidth: 104, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalNavBtnPrimary: { backgroundColor: 'rgba(79,208,79,0.15)', borderColor: 'rgba(79,208,79,0.34)', borderWidth: 1, shadowColor: '#4fd04f', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  modalNavBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 },
  modalNavBtnDisabled: { opacity: 0.35 },
  modalNavText: { color: '#c8d1c3', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  modalNavTextPrimary: { color: '#52d852', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  modalNavTextDisabled: { color: '#5c6458' },
  modalNavIcon: { color: '#9ca594', fontSize: 16, fontWeight: '700', marginTop: -1 },
  modalNavIconPrimary: { color: '#52d852', fontSize: 16, fontWeight: '700', marginTop: -1 },
  modalDots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  modalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3b4239' },
  modalDotActive: { backgroundColor: '#4fd04f', width: 18 },
  modalDoneBtn: { minWidth: 104, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: 'rgba(79,208,79,0.18)', borderColor: 'rgba(79,208,79,0.34)', borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#4fd04f', shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  modalDoneText: { color: '#4fd04f', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
