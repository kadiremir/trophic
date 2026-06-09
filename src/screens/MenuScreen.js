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
import { LEVELS, TIER_META } from '../game/levels';
import { PAL } from '../game/constants';
import PieceIcon from '../components/PieceIcon';
import FoodChainShowcase from '../components/FoodChainShowcase';
import LottieAnimation from '../components/LottieAnimation';
import completedAnimation from '../../assets/completed.json';
import lockedAnimation from '../../assets/locked.json';
import newAnimation from '../../assets/new.json';

export default function MenuScreen({ unlocked, completed, onSelect }) {
  const [showHowToPlay, setShowHowToPlay] = React.useState(false);

  // First unlocked level that hasn't been completed yet
  const nextLevel = LEVELS.findIndex((_, li) => li < unlocked && !completed.has(li));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#070b06" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <TrophicHeroBrand />
          <TouchableOpacity
            onPress={() => setShowHowToPlay(true)}
            style={styles.howToPlayBtn}
          >
            <Text style={styles.howToPlayText}>How to Play</Text>
          </TouchableOpacity>
          <FoodChainShowcase />
        </View>

        {TIER_META.map((tier, ti) => (
          <View key={ti} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={[styles.groupLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>

            {tier.levels.map((li) => {
              const lv = LEVELS[li];
              const locked = li >= unlocked;
              const done = completed.has(li);

              return (
                <TouchableOpacity
                  key={lv.id}
                  disabled={locked}
                  onPress={() => onSelect(li)}
                  style={[
                    styles.lvBtn,
                    locked && styles.lvLocked,
                    done && { borderColor: tier.color, shadowColor: tier.color },
                  ]}
                >
                  <View style={styles.lvNumContainer}>
                    {done ? (
                      <LottieAnimation
                        source={completedAnimation}
                        autoPlay={true}
                        loop={true}
                        style={styles.lvDoneLottie}
                      />
                    ) : (
                      <Text style={[styles.lvNum, { color: '#555' }]}>{lv.id}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lvName}>{lv.name}</Text>
                    <Text style={styles.lvObj}>{lv.objective.label}</Text>
                  </View>
                  {locked && (
                    <View style={styles.lvLockedLottieContainer}>
                      <LottieAnimation
                        source={lockedAnimation}
                        autoPlay={true}
                        loop={true}
                        style={styles.lvLockedLottie}
                      />
                    </View>
                  )}
                  {!locked && !done && li === nextLevel && (
                    <View style={styles.lvNewLottieContainer}>
                      <LottieAnimation
                        source={newAnimation}
                        autoPlay={true}
                        loop={true}
                        style={styles.lvNewLottie}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

      </ScrollView>

      <HowToPlayModal
        visible={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </SafeAreaView>
  );
}

const HERO_STARS = [
  { left: '3%', top: 64, size: 1, opacity: 0.75 },
  { left: '9%', top: 28, size: 2, opacity: 0.42 },
  { left: '26%', top: 102, size: 1, opacity: 0.24 },
  { left: '70%', top: 26, size: 1, opacity: 0.58 },
  { left: '84%', top: 82, size: 2, opacity: 0.26 },
  { left: '96%', top: 42, size: 1, opacity: 0.38 },
];

function TrophicHeroBrand() {
  const glow = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [glow]);

  const titleGlow = {
    textShadowRadius: glow.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 42],
    }),
  };

  return (
    <View style={styles.heroBrand}>
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
        numberOfLines={1}
        adjustsFontSizeToFit
        className={Platform.OS === 'web' ? 'trophic-logo-title' : undefined}
        style={[styles.title, titleGlow]}
      >
        TROPHIC
      </Animated.Text>
      <Text style={styles.subtitle}>CHAIN OF NATURE</Text>
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

  const steps = [
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
  ];

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

function HeroChainPiece({ token }) {
  return (
    <View style={styles.heroChainPiece}>
      <PieceIcon token={token} size={60} />
    </View>
  );
}

function FlowArrow({ compact = false, hero = false }) {
  return (
    <View style={[styles.flowArrow, compact && styles.flowArrowCompact, hero && styles.flowArrowHero]}>
      <View style={[styles.flowArrowGlow, hero && styles.flowArrowGlowHero]}>
        <View
          style={[
            styles.flowArrowShaft,
            compact && styles.flowArrowShaftCompact,
            hero && styles.flowArrowShaftHero,
          ]}
        />
        <View style={[styles.flowArrowHead, hero && styles.flowArrowHeadHero]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 0, paddingBottom: 24, paddingHorizontal: 20 },
  heroBrand: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    paddingHorizontal: 16,
    paddingTop: 8,
    marginHorizontal: -20,
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
    color: '#e8e4d9',
    letterSpacing: 4,
    lineHeight: 76,
    fontFamily: Platform.select({
      web: 'Cinzel Decorative, Georgia, serif',
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia',
    }),
    textShadowColor: 'rgba(0, 229, 195, 0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
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
    fontFamily: Platform.select({
      web: 'Nunito, sans-serif',
      default: undefined,
    }),
    opacity: 0.82,
  },
  heroChain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  heroChainPiece: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 20 },
  group: { marginBottom: 24, paddingHorizontal: 16 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  groupLabel: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  groupChain: { fontSize: 11, color: '#444' },
  lvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderRadius: 11,
    padding: 12,
    marginBottom: 5,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  lvLocked: { opacity: 0.3 },
  lvNumContainer: { width: 26, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lvNum: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  lvDoneLottie: { position: 'absolute', width: 100, height: 100 },
  lvName: { fontSize: 14, color: '#ccc', fontWeight: '600' },
  lvObj: { fontSize: 11, color: '#555', marginTop: 2 },
  lock: { fontSize: 14, opacity: 0.5 },
  lvLockedLottieContainer: { width: 24, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lvLockedLottie: { position: 'absolute', width: 48, height: 48 },
  lvNewLottieContainer: { width: 45, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lvNewLottie: { position: 'absolute', width: 75, height: 75 },
  howToPlayBtn: {
    alignSelf: 'center',
    minWidth: 170,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(3, 28, 33, 0.95)',
    borderColor: 'rgba(0, 229, 195, 0.24)',
    borderWidth: 1,
    marginTop: 0,
    marginBottom: 14,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalShell: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 14,
  },
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
  modalCloseText: {
    color: '#c6cec0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  modalTitle: {
    color: '#4fd04f',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  modalBody: {
    color: '#bcc7b4',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalVisual: {
    marginTop: 20,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalChainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalDemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  demoTile: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  demoSelected: {
    borderColor: '#ffd700',
    shadowColor: '#ffd700',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  demoTarget: {
    borderColor: '#ff6050',
    shadowColor: '#ff6050',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  demoPrey: {
    borderColor: '#ffcc00',
    shadowColor: '#ffcc00',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 7,
  },
  demoBlink: {
    borderColor: '#4fd04f',
    shadowColor: '#4fd04f',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  flowArrow: {
    width: 42,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowArrowCompact: {
    width: 40,
  },
  flowArrowHero: {
    width: 36,
    height: 28,
  },
  flowArrowGlow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(79,208,79,0.08)',
    borderColor: 'rgba(79,208,79,0.12)',
    borderWidth: 1,
  },
  flowArrowGlowHero: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  flowArrowShaft: {
    width: 18,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#4fd04f',
    shadowColor: '#4fd04f',
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  flowArrowShaftCompact: {
    width: 16,
  },
  flowArrowShaftHero: {
    width: 14,
    height: 3,
    backgroundColor: '#e8dfc0',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  flowArrowHead: {
    marginLeft: -1,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#4fd04f',
  },
  flowArrowHeadHero: {
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 10,
    borderLeftColor: '#e8dfc0',
  },
  chainBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  choicePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  modalNotes: {
    marginTop: 18,
    gap: 6,
  },
  modalNoteText: {
    color: '#8f9a87',
    fontSize: 12,
    lineHeight: 18,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 18,
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalNavBtn: {
    minWidth: 104,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalNavBtnPrimary: {
    backgroundColor: 'rgba(79,208,79,0.15)',
    borderColor: 'rgba(79,208,79,0.34)',
    borderWidth: 1,
    shadowColor: '#4fd04f',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalNavBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  modalNavBtnDisabled: {
    opacity: 0.35,
  },
  modalNavText: {
    color: '#c8d1c3',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modalNavTextPrimary: {
    color: '#52d852',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalNavTextDisabled: {
    color: '#5c6458',
  },
  modalNavIcon: {
    color: '#9ca594',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  modalNavIconPrimary: {
    color: '#52d852',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  modalDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3b4239',
  },
  modalDotActive: {
    backgroundColor: '#4fd04f',
    width: 18,
  },
  modalDoneBtn: {
    minWidth: 104,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(79,208,79,0.18)',
    borderColor: 'rgba(79,208,79,0.34)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4fd04f',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  modalDoneText: {
    color: '#4fd04f',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
