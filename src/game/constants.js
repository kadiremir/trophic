// ═══ Entity Types ═══════════════════════════════════════════════════════════
export const GRASS  = 'G';
export const RABBIT = 'R';
export const FOX    = 'F';
export const WOLF   = 'W';
export const BEAR   = 'B';
export const DINO   = 'D';
export const EMPTY  = null;

export const EMOJI = {
  G: '🌱', R: '🐰', F: '🦊', W: '🐺', B: '🐻', D: '🦖',
};

export const PIECE_LABELS = {
  G: 'Grass',
  R: 'Rabbit',
  F: 'Fox',
  W: 'Wolf',
  B: 'Bear',
  D: 'Dinosaur',
};

export const PIECE_IMAGES = {
  G: require('../../assets/characters/grass.png'),
  R: require('../../assets/characters/rabbit.png'),
  F: require('../../assets/characters/fox.png'),
  W: require('../../assets/characters/wolf.png'),
  B: require('../../assets/characters/bear.png'),
  D: require('../../assets/characters/dinosaur.png'),
};

// minus-1 prey: what each predator eats
export const PREY_OF = {
  R: GRASS,
  F: RABBIT,
  W: FOX,
  B: WOLF,
  D: BEAR,
};

export const PREY_POINTS = {
  G: 1,
  R: 3,
  F: 8,
  W: 20,
  B: 48,
};

// 8-directional movement
export const DIRS8 = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

export const GRID_SIZE = 6;

// ═══ Visual Palette ══════════════════════════════════════════════════════════
export const PAL = {
  G: { bg: '#0c2810', border: '#256b25', glow: '#4fd04f', text: '#a0e0a0' },
  R: { bg: '#1a1238', border: '#5840b0', glow: '#a888ff', text: '#d0c0ff' },
  F: { bg: '#2e1400', border: '#bc6200', glow: '#ff9824', text: '#ffc880' },
  W: { bg: '#141a32', border: '#4452a0', glow: '#8496f0', text: '#b0c0ff' },
  B: { bg: '#221000', border: '#7a3e12', glow: '#cd8038', text: '#e0b070' },
  D: { bg: '#102421', border: '#2a6f68', glow: '#6ed3c8', text: '#bdf3ed' },
  E: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.07)', glow: 'transparent', text: '' },
};

export const TIER_COLORS = {
  0: '#4fd04f',   // grass/rabbit tier
  1: '#ff9824',   // fox tier
  2: '#8496f0',   // wolf tier
  3: '#cd8038',   // bear tier
  4: '#6ed3c8',   // dinosaur tier
};
