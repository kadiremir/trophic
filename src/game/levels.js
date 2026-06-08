import {
  GRASS as G,
  RABBIT as R,
  FOX as F,
  WOLF as W,
  BEAR as B,
  DINO as D,
  GRID_SIZE,
} from './constants';
import { hasIllegalAdjacency } from './engine';

const createGrid = (pieces) => {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  pieces.forEach(([type, r, c]) => {
    grid[r][c] = type;
  });
  return grid;
};

const scoreObjective = (target) => ({
  type: 'score',
  target,
  label: `Score ${target} pts`,
});

const move = (sr, sc, tr, tc) => [[sr, sc], [tr, tc]];

const level = (id, name, tier, moves, objectiveTarget, hint, pieces, solution) => ({
  id,
  name,
  tier,
  moves,
  objective: scoreObjective(objectiveTarget),
  hint,
  grid: createGrid(pieces),
  solution,
});

const rawLevels = [
  level(
    1,
    'Crossed Paths',
    0,
    4,
    20,
    'Each chain starts cold now. Nudge a rabbit into position, then let the cascade do the work.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0],
      [G, 4, 4], [R, 2, 2], [F, 3, 5],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(2, 2, 3, 3)]
  ),
  level(
    2,
    'Twin Ridges',
    0,
    4,
    24,
    'Both wolf chains are safe at the start. Trigger one lane, then cash in the other.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 3, 2],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0)]
  ),
  level(
    3,
    'Offset Meadow',
    0,
    5,
    28,
    'One fox lane hides beside the wolf routes. Open a lane and let it finish before starting the next.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 3, 2],
      [G, 4, 4], [R, 2, 2], [F, 3, 5],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(2, 2, 3, 3)]
  ),
  level(
    4,
    'Corner Pressure',
    0,
    5,
    32,
    'Every quadrant is primed, but nothing auto-fires until you place the first rabbit.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 4],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 5, 2],
      [G, 2, 3], [R, 0, 1], [F, 3, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 4],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(0, 1, 1, 2), move(1, 1, 2, 2)]
  ),
  level(
    5,
    'Split Field',
    1,
    5,
    24,
    'The board looks busy, but every chain still needs a deliberate setup move first.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0],
      [G, 3, 2], [R, 1, 0], [F, 4, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 3],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(1, 0, 2, 1), move(1, 1, 2, 2)]
  ),
  level(
    6,
    'Pressure Grid',
    1,
    5,
    28,
    'Two wolves and one fox are enough. Start any lane, but keep the rest dormant until you need them.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 3, 2],
      [G, 4, 4], [R, 2, 2], [F, 3, 5],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(2, 2, 3, 3)]
  ),
  level(
    7,
    'Three Lanes',
    1,
    5,
    32,
    'Multiple cascades are possible here, but they only happen when you set them up.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 4],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 5, 2],
      [G, 2, 3], [R, 0, 1], [F, 3, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 4],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(0, 1, 1, 2), move(1, 1, 2, 2)]
  ),
  level(
    8,
    'Full Meadow',
    1,
    6,
    36,
    'Four staged chains fit on the board now. The trick is still the setup, not free auto-eats.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 5],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 5, 2],
      [G, 3, 2], [R, 1, 0], [F, 2, 3], [W, 4, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 4],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(1, 0, 2, 1), move(1, 1, 2, 2)]
  ),
  level(
    9,
    'Wolf Ridge',
    2,
    5,
    36,
    'All three wolf lanes are stable until touched. Trigger them in the order that keeps space open.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 3, 2],
      [G, 4, 4], [R, 2, 2], [F, 3, 5], [W, 4, 3],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(2, 2, 3, 3)]
  ),
  level(
    10,
    'Packed Ridge',
    2,
    6,
    40,
    'Three wolf chains plus one fox chain, all intentionally cold on turn zero.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 5],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 5, 2],
      [G, 3, 2], [R, 1, 0], [F, 2, 3], [W, 4, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 4],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(1, 0, 2, 1), move(1, 1, 2, 2)]
  ),
  level(
    11,
    'Dense Ridge',
    2,
    6,
    40,
    'This one still has a high ceiling, but it no longer self-solves from the opening layout.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 5],
      [G, 4, 1], [R, 2, 0], [F, 4, 0], [W, 5, 2],
      [G, 3, 2], [R, 1, 0], [F, 2, 3], [W, 4, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 4],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(1, 0, 2, 1), move(1, 1, 2, 2)]
  ),
  level(
    12,
    'Four Corners',
    2,
    6,
    48,
    'Four full wolf chains fit, but each one waits for the player instead of firing for free.',
    [
      [G, 1, 1], [R, 0, 3], [F, 0, 0], [W, 1, 2],
      [G, 4, 1], [R, 5, 3], [F, 3, 0], [W, 5, 0],
      [G, 2, 2], [R, 4, 4], [F, 3, 1], [W, 1, 3],
      [G, 2, 3], [R, 1, 5], [F, 3, 2], [W, 1, 4],
    ],
    [move(0, 3, 0, 2), move(5, 3, 5, 2), move(4, 4, 3, 3), move(1, 5, 2, 4)]
  ),
  level(
    13,
    'Bear Awakens',
    3,
    6,
    32,
    'The bear chain is now staged cleanly: one rabbit setup, then the full climb.',
    [
      [G, 1, 1], [R, 0, 3], [F, 0, 0], [W, 1, 2], [B, 1, 0],
    ],
    [move(0, 3, 0, 2)]
  ),
  level(
    14,
    'Bear and Fox',
    3,
    6,
    36,
    'The bear lane and fox lane are independent starts now, so you choose when each cascade begins.',
    [
      [G, 1, 1], [R, 0, 3], [F, 0, 0], [W, 1, 2], [B, 1, 0],
      [G, 4, 4], [R, 2, 3], [F, 3, 5],
    ],
    [move(0, 3, 0, 2), move(2, 3, 3, 3)]
  ),
  level(
    15,
    'Bear Crossfire',
    3,
    6,
    40,
    'The bear lane carries the heavy points. The fox lanes are there to let you finish cleanly.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3], [B, 0, 5],
      [G, 4, 1], [R, 2, 0], [F, 4, 0],
      [G, 4, 4], [R, 2, 2], [F, 3, 5],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(2, 2, 3, 3)]
  ),
  level(
    16,
    'Bear Corner',
    3,
    6,
    44,
    'One staged bear chain plus three fox chains. Nothing goes off until you commit a move.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3], [B, 0, 5],
      [G, 4, 1], [R, 2, 0], [F, 4, 0],
      [G, 3, 2], [R, 1, 0], [F, 4, 2],
      [G, 3, 3], [R, 1, 1], [F, 4, 3],
    ],
    [move(0, 2, 0, 3), move(2, 0, 3, 0), move(1, 0, 2, 1), move(1, 1, 2, 2)]
  ),
  level(
    17,
    'Dino Valley',
    4,
    7,
    80,
    'The dinosaur chain is now a true one-move ignition instead of a pre-lit board.',
    [
      [G, 1, 1], [R, 0, 3], [F, 0, 0], [W, 1, 2], [B, 1, 0], [D, 2, 2],
    ],
    [move(0, 3, 0, 2)]
  ),
  level(
    18,
    'Dino Shelf',
    4,
    7,
    80,
    'Same long chain, different footprint. You still have to feed it manually.',
    [
      [G, 1, 4], [R, 0, 2], [F, 0, 4], [W, 2, 3], [B, 0, 5], [D, 1, 3],
    ],
    [move(0, 2, 0, 3)]
  ),
  level(
    19,
    'Dino Climb',
    4,
    7,
    80,
    'This version climbs from the lower-left and still stays completely inert at the start.',
    [
      [G, 4, 1], [R, 2, 0], [F, 3, 2], [W, 4, 0], [B, 4, 2], [D, 5, 0],
    ],
    [move(2, 0, 3, 0)]
  ),
  level(
    20,
    'Dino Crest',
    4,
    7,
    80,
    'Final board: same apex chain, fresh shape, and no free opening cascades.',
    [
      [G, 4, 4], [R, 2, 2], [F, 3, 4], [W, 5, 3], [B, 3, 5], [D, 4, 3],
    ],
    [move(2, 2, 3, 3)]
  ),
];

rawLevels.forEach((entry) => {
  if (hasIllegalAdjacency(entry.grid)) {
    throw new Error(`Level ${entry.id} has illegal starting adjacency.`);
  }
});

export const LEVELS = rawLevels;

export const TIER_META = [
  { label: 'Mixed Meadow',  color: '#4fd04f', chain: 'G->R->F->W',         levels: [0, 1, 2, 3] },
  { label: 'Fox Forest',    color: '#ff9824', chain: 'G->R->F->W',         levels: [4, 5, 6, 7] },
  { label: 'Wolf Ridge',    color: '#8496f0', chain: 'G->R->F->W',         levels: [8, 9, 10, 11] },
  { label: 'Bear Mountain', color: '#cd8038', chain: 'G->R->F->W->B',      levels: [12, 13, 14, 15] },
  { label: 'Dino Peak',     color: '#6ed3c8', chain: 'G->R->F->W->B->D',   levels: [16, 17, 18, 19] },
];
