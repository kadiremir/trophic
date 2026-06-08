import { GRASS, PREY_OF, PREY_POINTS, DIRS8, GRID_SIZE } from './constants';

export const cloneGrid = (g) => g.map((r) => [...r]);

export const serializeGrid = (grid) =>
  grid.map((row) => row.map((cell) => cell || '.').join('')).join('|');

export const inBounds = (r, c) =>
  r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

export const cellKey = (r, c) => `${r},${c}`;

export const isOneStep = (r1, c1, r2, c2) =>
  Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) === 1;

export const hasIllegalAdjacency = (grid) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r][c];
      if (!cell || cell === GRASS) continue;
      const prey = PREY_OF[cell];
      if (!prey) continue;
      for (const [dr, dc] of DIRS8) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && grid[nr][nc] === prey) return true;
      }
    }
  }
  return false;
};

export const getRemainingScorePotential = (grid) =>
  grid.flat().reduce((sum, cell) => sum + (PREY_POINTS[cell] || 0), 0);

const JUMP_PRIORITY = {
  R: 0,
  F: 1,
  W: 2,
  B: 3,
  D: 4,
};

const sortJumpOptions = (options) =>
  options.sort((a, b) =>
    JUMP_PRIORITY[a.pred] - JUMP_PRIORITY[b.pred] ||
    a.from[0] - b.from[0] ||
    a.from[1] - b.from[1] ||
    a.to[0] - b.to[0] ||
    a.to[1] - b.to[1]
  );

const applyJumpOption = (grid, option, kind = option.kind || 'auto') => {
  const g = cloneGrid(grid);
  const [fr, fc] = option.from;
  const [tr, tc] = option.to;
  const earnedPts = PREY_POINTS[option.prey] || 0;
  g[tr][tc] = option.pred;
  g[fr][fc] = null;
  return {
    grid: g,
    pts: earnedPts,
    event: {
      pred: option.pred,
      prey: option.prey,
      from: option.from,
      to: option.to,
      pts: earnedPts,
      kind,
    },
  };
};

export const getLegalTargets = (grid, sr, sc) => {
  const piece = grid[sr][sc];
  if (!piece || piece === GRASS) return new Set();
  const out = new Set();
  for (const [dr, dc] of DIRS8) {
    const nr = sr + dr, nc = sc + dc;
    if (!inBounds(nr, nc)) continue;
    const target = grid[nr][nc];
    if (target === null || PREY_OF[piece] === target) {
      out.add(cellKey(nr, nc));
    }
  }
  return out;
};

export const getForcedJumpOptions = (grid) => {
  const options = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const pred = grid[r][c];
      if (!pred || pred === GRASS) continue;
      const prey = PREY_OF[pred];
      if (!prey) continue;

      for (const [dr, dc] of DIRS8) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && grid[nr][nc] === prey) {
          options.push({
            pred,
            prey,
            from: [r, c],
            to: [nr, nc],
            pts: PREY_POINTS[prey] || 0,
            priority: JUMP_PRIORITY[pred],
            kind: 'auto',
          });
        }
      }
    }
  }

  if (!options.length) return [];
  const minPriority = Math.min(...options.map((option) => option.priority));
  return sortJumpOptions(options.filter((option) => option.priority === minPriority));
};

export const getForcedChoice = (grid) => {
  const options = getForcedJumpOptions(grid);
  // UI resolves these options as predator-origin -> prey-destination pairs during forced-choice drag.
  return options.length > 1 ? options : null;
};

export const applyForcedChoice = (grid, option) => applyJumpOption(grid, option, 'choose');

export const resolveJumps = (grid) => {
  let current = cloneGrid(grid);
  let pts = 0;
  const events = [];

  while (true) {
    const options = getForcedJumpOptions(current);
    if (options.length !== 1) break;

    const resolved = applyJumpOption(current, options[0], 'auto');
    current = resolved.grid;
    pts += resolved.pts;
    events.push(resolved.event);
  }

  return { grid: current, pts, events };
};

const resolveChoiceBranches = (grid) => {
  const choice = getForcedChoice(grid);
  if (!choice) return [{ grid, pts: 0, events: [] }];

  const outcomes = [];
  for (const option of choice) {
    const chosen = applyForcedChoice(grid, option);
    const afterAuto = resolveJumps(chosen.grid);
    const tails = resolveChoiceBranches(afterAuto.grid);
    for (const tail of tails) {
      outcomes.push({
        grid: tail.grid,
        pts: chosen.pts + afterAuto.pts + tail.pts,
        events: [
          chosen.event,
          ...afterAuto.events,
          ...tail.events,
        ],
      });
    }
  }

  return outcomes;
};

export const canReachObjective = (grid, objective, movesLeft, score = 0) => {
  const memo = new Set();

  const dfs = (currentGrid, currentScore, remainingMoves) => {
    if (objective.type === 'score' && currentScore >= objective.target) return true;
    if (remainingMoves <= 0) return false;

    if (
      objective.type === 'score' &&
      currentScore + getRemainingScorePotential(currentGrid) < objective.target
    ) {
      return false;
    }

    const key = `${serializeGrid(currentGrid)}|${remainingMoves}|${currentScore}`;
    if (memo.has(key)) return false;
    memo.add(key);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const piece = currentGrid[r][c];
        if (!piece || piece === GRASS) continue;
        const targets = getLegalTargets(currentGrid, r, c);
        for (const target of targets) {
          const [tr, tc] = target.split(',').map(Number);
          const res = executeMove(currentGrid, r, c, tr, tc);
          if (!res) continue;

          const branches = resolveChoiceBranches(res.grid);
          for (const branch of branches) {
            if (dfs(branch.grid, currentScore + res.pts + branch.pts, remainingMoves - 1)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  return dfs(grid, score, movesLeft);
};

export const getAmbiguousJump = (grid) => getForcedChoice(grid);

export const executeMove = (grid, sr, sc, tr, tc) => {
  const mover = grid[sr][sc];
  if (!mover || mover === GRASS) return null;
  if (!isOneStep(sr, sc, tr, tc)) return null;

  const target = grid[tr][tc];
  const g = cloneGrid(grid);
  let pts = 0;
  const events = [];

  if (target !== null) {
    if (PREY_OF[mover] !== target) return null;
    const earnedPts = PREY_POINTS[target] || 0;
    pts += earnedPts;
    events.push({
      pred: mover,
      prey: target,
      from: [sr, sc],
      to: [tr, tc],
      pts: earnedPts,
      kind: 'hunt',
    });
    g[tr][tc] = mover;
    g[sr][sc] = null;
  } else {
    g[tr][tc] = mover;
    g[sr][sc] = null;
  }

  const auto = resolveJumps(g);
  pts += auto.pts;
  auto.events.forEach((event) => events.push(event));

  return { grid: auto.grid, pts, events };
};

export const hasAnyMove = (grid) => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const p = grid[r][c];
      if (!p || p === GRASS) continue;
      for (const [dr, dc] of DIRS8) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const t = grid[nr][nc];
        if (t === null || PREY_OF[p] === t) return true;
      }
    }
  }
  return false;
};

export const checkWin = (objective, score, maxCombo, grid) => {
  if (objective.type === 'score') return score >= objective.target;
  if (objective.type === 'combo') return maxCombo >= objective.target;
  if (objective.type === 'clear') {
    const apex = findApex(grid);
    return grid.flat().every((c) => !c || c === apex);
  }
  return false;
};

const findApex = (grid) => {
  const order = ['D', 'B', 'W', 'F', 'R', 'G'];
  for (const t of order) {
    if (grid.flat().includes(t)) return t;
  }
  return null;
};
