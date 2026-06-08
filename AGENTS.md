# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Mandatory maintenance rule

Whenever any gameplay rule is introduced, removed, or changed, you must update the rule documentation in the same change.

At minimum, update all relevant rule references in:
- `README.md`
- `AGENTS.md`
- engine comments or contracts in `src/game/engine.js`

Do not leave rule behavior and rule documentation out of sync.

## Build & Run

**Web (primary dev target):**
```powershell
npx expo export --platform web
node serve-dist.js
```

**Mobile:**
```powershell
npx expo start --android
npx expo start --ios
```

**Important:** `package.json` must keep `"main": "expo/AppEntry"`.

`app.json` must keep `"plugins": []`. `@react-native-async-storage/async-storage` is a dependency, but it must not be added as an Expo plugin.

## Architecture

Single-screen React Native / Expo SDK 51 game.

```text
App.js
src/
  game/
    constants.js
    engine.js
    levels.js
  screens/
    MenuScreen.js
    GameScreen.js
  components/
    Grid.js
    Cell.js
    JumpSprite.js
```

## Current gameplay rules

### Movement
- Animals move one cell in any of 8 directions.
- The player moves pieces by drag-and-drop, not by source/target tapping.
- When the board pauses for multiple same-tier forced eats, the player still resolves that choice by dragging one blinking predator onto the highlighted prey.
- Releasing on the source cell cancels the move.
- Releasing off-board or on an illegal destination also cancels the move.

### Food chain
- `R -> G`
- `F -> R`
- `W -> F`
- `B -> W`
- `D -> B`

### Forced resolution order
- Forced eats are resolved globally from the lowest trophic tier to the highest.
- `rabbit -> grass` must always resolve before `fox -> rabbit` if both are available.
- `fox -> rabbit` must always resolve before `wolf -> fox`, and so on.
- If the active priority tier has exactly one forced eat, resolve it automatically.
- If the active priority tier has multiple forced eats, the player must choose which one resolves first.
- In that forced-choice state, the prey cell remains highlighted while the eligible predator cells blink.
- After each forced eat, recompute from the board again using the same priority rule.

### Level rule
- Every level must start cold: no predator may begin adjacent to its prey.
- Keep all shipped levels solvable after any gameplay or level-data changes.

## Engine contracts

- **`getLegalTargets(grid, sr, sc)`** returns legal adjacent destinations for one piece.
- **`getForcedJumpOptions(grid)`** returns every forced jump at the currently active lowest priority tier.
- **`getForcedChoice(grid)`** returns the active forced-jump options when the player must choose, otherwise `null`.
- **`applyForcedChoice(grid, option)`** applies one chosen forced jump.
- **`resolveJumps(grid)`** resolves only guaranteed forced jumps and stops when player choice is required.
- **`executeMove(grid, sr, sc, tr, tc)`** applies one player move, then runs `resolveJumps`.

## UI state notes

`GameScreen` phases are:
- `'play'`
- `'animating'`
- `'choosing'`
- `'win'`
- `'lose'`

`'choosing'` means the board has multiple forced eats at the same active tier; the prey stays highlighted, the eligible predators blink, and the player resolves the choice by dragging one predator onto that prey.
