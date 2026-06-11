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

  React.useEffect(() => {
    if (!visible) {
      setStep(0);
    }
  }, [visible]);

  const steps = React.useMemo(() => [
    {
      title: 'The Food Chain',
      body: 'Each predator can eat only the tier directly below it. Score comes from prey that gets eaten during the chain.',
      visual: (
        <View style={styles.modalChainRow}>
          {['G', 'R', 'F', 'W', 'B', 'D'].map((token, index, arr) => (
            <React.Fragment key={token}>
              <PieceBadge token={token} />
              {index < arr.length - 1 && <FlowArrow compact />}
            </React.Fragment>
          ))}
        </View>
      ),
      notes: [
        'Rabbit eats grass',
        'Fox eats rabbit',
        'Wolf eats fox',
        'Bear eats wolf',
        'Dinosaur eats bear',
      ],
    },
    {
      title: 'Drag to Move',
      body: 'Drag an animal one cell in any direction. Drop on the same cell, off the board, or on an illegal cell to cancel.',
      visual: (
        <View style={styles.modalDemoRow}>
          <PieceDemoTile token="F" variant="selected" />
          <FlowArrow />
          <PieceDemoTile token="R" variant="target" />
        </View>
      ),
      notes: [
        'Animals move in 8 directions',
        'Drag instead of tap-to-move',
        'Empty cells and prey cells can be valid drops',
      ],
    },
    {
      title: 'Chain Reactions',
      body: 'After your move, guaranteed forced eats resolve automatically. Long cascades build your combo and score.',
      visual: (
        <View style={styles.modalDemoRow}>
          <PieceBadge token="G" />
          <FlowArrow compact />
          <PieceBadge token="R" />
          <FlowArrow compact />
          <PieceBadge token="F" />
          <FlowArrow compact />
          <PieceBadge token="W" />
        </View>
      ),
      notes: [
        'Lower trophic tiers resolve first',
        'The board keeps checking for the next forced eat',
        'Bigger chains mean better combos',
      ],
    },
    {
      title: 'Forced Choices',
      body: 'If multiple predators at the same active tier can eat, the prey stays highlighted and the eligible predators blink. Drag one blinking predator onto that prey to decide the order.',
      visual: (
        <View style={styles.choicePreview}>
          <PieceDemoTile token="F" variant="blink" />
          <PieceDemoTile token="R" variant="prey" />
          <PieceDemoTile token="F" variant="blink" />
        </View>
      ),
      notes: [
        'Blinking predators are the valid choosers',
        'The highlighted prey is the forced target',
        'Your choice determines what resolves first',
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const current = steps[step];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalShell} onPress={() => {}}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{current.title}</Text>
            <Text style={styles.modalBody}>{current.body}</Text>

            <View style={styles.modalVisual}>{current.visual}</View>

            <View style={styles.modalNotes}>
              {current.notes.map((note) => (
                <Text key={note} style={styles.modalNoteText}>
                  - {note}
                </Text>
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setStep((prev) => Math.max(0, prev - 1))}
                disabled={step === 0}
                style={[
                  styles.modalNavBtn,
                  styles.modalNavBtnSecondary,
                  step === 0 && styles.modalNavBtnDisabled,
                ]}
              >
                <Text style={[styles.modalNavIcon, step === 0 && styles.modalNavTextDisabled]}>
                  {'<'}
                </Text>
                <Text style={[styles.modalNavText, step === 0 && styles.modalNavTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <View style={styles.modalDots}>
                {steps.map((item, index) => (
                  <View
                    key={item.title}
                    style={[
                      styles.modalDot,
                      index === step && styles.modalDotActive,
                    ]}
                  />
                ))}
              </View>

              {step < steps.length - 1 ? (
                <TouchableOpacity
                  onPress={() => setStep((prev) => prev + 1)}
                  style={[
                    styles.modalNavBtn,
                    styles.modalNavBtnPrimary,
                  ]}
                >
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
