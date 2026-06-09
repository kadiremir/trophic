import { GRID_SIZE } from './constants';
import { hasIllegalAdjacency } from './engine';
import levelsData from './levels.json';

const createGrid = (pieces) => {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  pieces.forEach(([type, r, c]) => {
    grid[r][c] = type;
  });
  return grid;
};

export const LEVELS = levelsData.levels.map((lv) => ({
  id:        lv.id,
  name:      lv.name,
  tier:      lv.tier,
  moves:     lv.moves,
  objective: lv.objective,
  hint:      lv.hint,
  grid:      createGrid(lv.pieces),
  meta:      lv.meta,
}));

LEVELS.forEach((lv) => {
  if (hasIllegalAdjacency(lv.grid)) {
    throw new Error(`Level ${lv.id} has illegal starting adjacency.`);
  }
});

export const TIER_META = levelsData.tier_meta;
