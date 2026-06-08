# Trophic

A food-chain puzzle game for iOS, Android, and web.

## Setup

### 1. Install dependencies
```bash
cd C:\Users\kadir.emir\PycharmProjects\trophic
npm install
```

### 2. Run in browser
```bash
npx expo start --web
```

### 3. Export static web build
```bash
npx expo export --platform web
node serve-dist.js
```

### 4. Run on device or emulator
```bash
npx expo start --android
npx expo start --ios
```

## Project Structure
```text
trophic/
|-- App.js
|-- src/
|   |-- game/
|   |   |-- constants.js
|   |   |-- engine.js
|   |   `-- levels.js
|   |-- screens/
|   |   |-- MenuScreen.js
|   |   `-- GameScreen.js
|   `-- components/
|       |-- Grid.js
|       |-- Cell.js
|       `-- JumpSprite.js
`-- AGENTS.md
```

## Rules

### Board and movement
- The board is 6x6.
- Animals move one cell in any of the 8 directions, including diagonals.
- You move by dragging an animal and releasing on the destination cell.
- If multiple same-tier forced eats are available, you still resolve the choice by dragging one blinking predator onto the highlighted prey.
- Releasing back on the source cell cancels the drag.
- Releasing outside the board or on an illegal destination also cancels the drag.

### Food chain
- Rabbit eats grass.
- Fox eats rabbit.
- Wolf eats fox.
- Bear eats wolf.
- Dino eats bear.

### Legal moves
- An animal may move to an empty adjacent cell.
- An animal may also move directly onto its own prey to eat it immediately.
- Grass does not move.

### Forced eating resolution
- After every move, all newly adjacent predator-prey pairs are checked.
- Forced eats always resolve from the lowest trophic tier upward.
- Rabbit eating grass always has priority over fox eating rabbit.
- Fox eating rabbit always has priority over wolf eating fox.
- Wolf eating fox always has priority over bear eating wolf.
- Bear eating wolf always has priority over dino eating bear.
- If exactly one forced eat exists at the active tier, it resolves automatically.
- If multiple forced eats exist at the same active tier, the player must choose which one resolves first.
- In that forced-choice state, the shared prey stays highlighted while the eligible predators blink.
- After that chosen eat resolves, the game checks again using the same lowest-tier-first rule.

### Start-of-level rule
- No level may begin with any predator already adjacent to its prey.
- Level data is validated against this rule during startup.

### Scoring
- Grass is worth 1 point.
- Rabbit is worth 3 points.
- Fox is worth 8 points.
- Wolf is worth 20 points.
- Bear is worth 48 points.

### Win condition
- Current levels use score goals.
- A level is won when the target score is reached before moves run out.

## Notes for contributors
- If gameplay rules change, update this README, `AGENTS.md`, and the relevant inline engine comments in the same change.
- If level behavior changes, re-check that all levels start cold and remain solvable.

## Troubleshooting
- If Expo web export warns about `./assets/favicon.png`, either add that file or remove the favicon entry from `app.json`.
- If Expo Go cannot connect, make sure the phone and PC are on the same network.
