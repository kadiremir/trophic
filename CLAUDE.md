# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

**Web (primary dev target):**
```powershell
# Build static web bundle
npx expo export --platform web   # outputs to dist/

# Serve the built bundle
node serve-dist.js               # http://localhost:8081
```

**Mobile:**
```powershell
npx expo start --android
npx expo start --ios
```

**Important:** `package.json` must have `"main": "expo/AppEntry"` (not `"App.js"`). The `expo/AppEntry` entry point calls `registerRootComponent`; without it the React tree never mounts and the browser shows a blank page.

`app.json` must have `"plugins": []` — `@react-native-async-storage/async-storage` is listed in deps but must NOT be in plugins (causes PluginError on web).

## Architecture

Single-screen React Native / Expo SDK 51 game. No navigation library — `App.js` renders either `MenuScreen` or `GameScreen` based on `activeLevel` state.

```
App.js                   ← level unlock state (unlocked=20 enables all levels)
src/
  game/
    constants.js         ← entity tokens (G/R/F/W/B/X), PREY_OF chain, PREY_POINTS, PAL palette
    engine.js            ← all game logic (pure functions, no React)
    levels.js            ← LEVELS array (20 levels) + TIER_META
  screens/
    MenuScreen.js        ← tier accordion + level select
    GameScreen.js        ← main game loop, all state, animation
  components/
    Grid.js              ← renders 6×6 board, passes per-cell flags to Cell
    Cell.js              ← single cell with 7 visual states
    JumpSprite.js        ← absolutely-positioned animated predator mid-jump
```

## Game Engine (engine.js)

Key functions and their contracts:

- **`resolveJumps(grid)`** — cascades auto-eats for predators with exactly 1 adjacent prey. Skips predators with 2+ adjacent prey (caller must invoke `getAmbiguousJump` and ask the player).
- **`getAmbiguousJump(grid)`** — returns `{ r, c, preyTargets: [[r,c],...] }` for the first predator touching 2+ prey, or `null`.
- **`executeMove(grid, sr, sc, tr, tc)`** — validates + applies one player move, then calls `resolveJumps`. Returns `null` if illegal.
- **`getLegalTargets(grid, sr, sc)`** — returns Set of `"r,c"` keys for legal moves (empty cells + direct prey cells).

Trophic chain: `🌱(G) ← 🐰(R) ← 🦊(F) ← 🐺(W) ← 🐻(B)`. `🔥(X)` burns adjacent grass each turn via `applyWildfire`.

Points: G=1, R=3, F=8, W=20.

## GameScreen State Machine

`phase` values: `'idle'` | `'selected'` | `'animating'` | `'choosing'`

The `'choosing'` phase handles ambiguous prey selection:
- `pendingChoice` holds `{ r, c, preyTargets, accPts, accEventCount, workingGrid }`
- `blinkOn` toggles every 380ms to drive the amber blink on `choiceCells`
- After the player taps a target, the choice resolves, `resolveJumps` runs again, and if another ambiguity exists, `pendingChoice` loops

## Level Format

```js
{
  id, name, tier,          // tier 0-4 maps to TIER_META
  moves,                   // move budget
  objective: {
    type: 'score'|'combo'|'clear',
    target?,               // number (score/combo types)
    label,                 // display string
  },
  hint,                    // shown in HUD
  grid,                    // 6×6 array of constants (null = empty)
}
```

Grid start positions must not have any predator 8-dir adjacent to its prey (`hasIllegalAdjacency` validates this).
