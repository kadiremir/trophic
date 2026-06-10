import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * ContinueButton — the "pick up where you left off" CTA on the menu.
 *
 * Matches the `continue-cloud-rgb` design: an organic morphing border wrapping a
 * spinning RGB conic-gradient, with a rainbow drop-shadow glow. Those effects are
 * web-only CSS, so on web we render the real DOM structure that the injected
 * `#trophic-continue-styles` block in public/index.html targets. On native we
 * fall back to the green "primary" Button style from the design system.
 *
 * @param {string}   props.eyebrow   small label above the name (e.g. "Fox Forest · Level 8")
 * @param {string}   props.levelName the level being continued to
 * @param {string}   props.subLabel  small label inside the button (default "Next Level")
 * @param {string}   props.accent    eyebrow accent color (tier color)
 * @param {Function} props.onPress
 */
export default function ContinueButton({
  eyebrow,
  levelName,
  subLabel = 'Next Level',
  accent = '#ff9824',
  onPress,
}) {
  if (Platform.OS === 'web') {
    // Raw DOM so the injected CSS (conic-gradient / morph / glow) applies verbatim.
    return (
      <View style={styles.webWrap}>
        <div className="trophic-continue">
          {!!eyebrow && (
            <div>
              <div className="ctx-eyebrow" style={{ color: accent }}>{eyebrow}</div>
              {!!levelName && <div className="ctx-level-name">{levelName}</div>}
            </div>
          )}

          <div className="cloud-outer">
            <button type="button" className="cloud-btn" onClick={onPress}>
              <span className="cloud-inner">
                <span className="cloud-sub" style={{ color: accent }}>{subLabel}</span>
                <span className="cloud-label">Continue →</span>
              </span>
            </button>
          </div>
        </div>
      </View>
    );
  }

  // ── Native fallback (primary Button variant tokens) ──────────────────────
  return (
    <View style={styles.nativeWrap}>
      {!!eyebrow && (
        <>
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          {!!levelName && <Text style={styles.levelName}>{levelName}</Text>}
        </>
      )}

      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.btn}>
        <Text style={[styles.sub, { color: accent }]}>{subLabel}</Text>
        <Text style={styles.label}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrap: { paddingHorizontal: 16, marginBottom: 20, alignItems: 'center' },

  nativeWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 5,
    textTransform: 'uppercase',
    fontWeight: '700',
    opacity: 0.65,
  },
  levelName: {
    marginTop: 6,
    fontSize: 20,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 2,
    fontWeight: '700',
  },
  btn: {
    minWidth: 260,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 22,
    transform: [{ scale: 0.7 }],
    backgroundColor: 'rgba(79,208,79,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79,208,79,0.34)',
    shadowColor: '#4fd04f',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  sub: {
    fontSize: 9,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '700',
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    color: '#52d852',
  },
  hint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.16)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
