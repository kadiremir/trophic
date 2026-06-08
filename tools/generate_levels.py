"""
generate_levels.py — Procedural level generator for Trophic.

Usage:
    python tools/generate_levels.py                         # generate 20 levels, write to stdout
    python tools/generate_levels.py --count 20 --out levels_generated.json
    python tools/generate_levels.py --validate              # validate existing src/game/levels.js

Generation strategy
───────────────────
1. Pick a *tier* (0-4) and *target difficulty* (0-100).
2. Place a food chain appropriate for the tier: for tier T, the apex predator
   is at index T in [R, F, W, B, D], and the full chain below it is included.
3. Scatter pieces on the 6×6 grid ensuring:
   - No predator is 8-dir adjacent to its prey at start (has_illegal_adjacency).
   - The level is solvable within the move budget (can_reach_objective).
4. Set the objective as a score target derived from the pieces on the board.
5. Tune the move budget until the measured difficulty is within ±8 of the target.
6. Retry with a fresh random layout if no budget produces the desired difficulty.

Difficulty target per level index (0-19):
   index 0  → difficulty  0  (trivial tutorial)
   index 19 → difficulty 100 (hardest)
   Interpolated linearly: target = round(index * 100 / 19)

See tools/LEVELGEN.md for the full rationale and the difficulty formula.
"""

from __future__ import annotations
import argparse
import json
import math
import random
import sys
from typing import Optional

sys.setrecursionlimit(50_000)

from engine import (
    GRASS, RABBIT, FOX, WOLF, BEAR, DINO, EMPTY,
    GRID_SIZE, PREY_OF, PREY_POINTS,
    clone_grid, has_illegal_adjacency, can_reach_objective,
)
from difficulty import score_difficulty, find_min_moves

# ── Tier definitions ───────────────────────────────────────────────────────────
# TIER_CHAIN[t] = ordered chain from grass up to the apex for that tier
TIER_CHAIN = [
    [GRASS, RABBIT],                         # tier 0: G–R
    [GRASS, RABBIT, FOX],                    # tier 1: G–R–F
    [GRASS, RABBIT, FOX, WOLF],              # tier 2: G–R–F–W
    [GRASS, RABBIT, FOX, WOLF, BEAR],        # tier 3: G–R–F–W–B
    [GRASS, RABBIT, FOX, WOLF, BEAR, DINO],  # tier 4: G–R–F–W–B–D
]

TIER_META = [
    {'label': 'Mixed Meadow',  'color': '#4fd04f', 'chain': 'G->R'},
    {'label': 'Fox Forest',    'color': '#ff9824', 'chain': 'G->R->F'},
    {'label': 'Wolf Ridge',    'color': '#8496f0', 'chain': 'G->R->F->W'},
    {'label': 'Bear Mountain', 'color': '#cd8038', 'chain': 'G->R->F->W->B'},
    {'label': 'Dino Peak',     'color': '#6ed3c8', 'chain': 'G->R->F->W->B->D'},
]

# Difficulty targets for levels 0-19 (linear 0→100)
DIFFICULTY_TARGETS = [round(i * 100 / 19) for i in range(20)]

# ── Grid builder ───────────────────────────────────────────────────────────────

def empty_grid() -> list:
    return [[None] * GRID_SIZE for _ in range(GRID_SIZE)]


def random_placement(
    chain: list[str],
    piece_counts: dict[str, int],
    rng: random.Random,
    max_tries: int = 2000,
) -> Optional[list]:
    """
    Randomly place pieces from *piece_counts* on a 6×6 grid such that
    no predator is 8-dir adjacent to its prey (start cold constraint).
    Returns the grid or None if max_tries is exceeded.
    """
    pieces = []
    for token, n in piece_counts.items():
        pieces.extend([token] * n)

    for _ in range(max_tries):
        grid = empty_grid()
        cells = [(r, c) for r in range(GRID_SIZE) for c in range(GRID_SIZE)]
        rng.shuffle(cells)
        if len(cells) < len(pieces):
            return None
        for i, (r, c) in enumerate(cells[:len(pieces)]):
            grid[r][c] = pieces[i]
        if not has_illegal_adjacency(grid):
            return grid

    return None


def _score_target_for_grid(grid: list) -> int:
    """
    Maximum score achievable: only count PREY_POINTS[T] when the predator of T
    is also present on the board. Entities whose predator is absent cannot be eaten.
    """
    flat = [cell for row in grid for cell in row if cell]
    present = set(flat)
    # predator_of[prey] = predator — invert PREY_OF
    predator_of = {v: k for k, v in PREY_OF.items()}
    total = 0
    for cell in flat:
        pred = predator_of.get(cell)
        if pred and pred in present:
            total += PREY_POINTS.get(cell, 0)
    return total


# ── Piece count profiles by tier and difficulty ─────────────────────────────
# (grass_count, predator_multiplier) — these shape how crowded the board is.
# More pieces + tight budget = harder.

def _piece_counts_for_tier(tier: int, difficulty: int, rng: random.Random) -> dict[str, int]:
    """
    Produces a small, bounded piece set for one food chain level.

    Strategy: pick a number of independent "chains" (1-3) scaled with difficulty.
    Each chain is one complete G→R→…→apex sequence placed as a group.
    This keeps total piece count to 6-12, avoids the multiplicative cascade bug,
    and gives the solver a manageable state space.
    """
    chain = TIER_CHAIN[tier]  # e.g. [G, R, F, W] for tier 2

    # 1-2 chains depending on difficulty. 3 chains would create 12+ pieces for
    # tier 2+ boards and make BFS intractably slow. Tier 4 (dino, 6-token chain)
    # is always capped at 1 chain (6 pieces) to keep BFS feasible at floor=4.
    if tier >= 4:
        n_chains = 1
    else:
        n_chains = 1 + (difficulty >= 40)
        n_chains = rng.randint(n_chains, min(n_chains + 1, 2))

    # Optionally add lone G's for easy levels (extra points, simple setup)
    extra_g = rng.randint(0, max(0, 3 - tier)) if difficulty < 50 else 0

    counts: dict[str, int] = {}
    for token in chain:
        counts[token] = n_chains
    counts[GRASS] = counts.get(GRASS, 0) + extra_g

    return {k: v for k, v in counts.items() if v > 0}


# ── Move budget tuning ────────────────────────────────────────────────────────

def _tune_budget(
    grid: list,
    objective: dict,
    target_difficulty: float,
    rng: random.Random,
) -> Optional[tuple[int, dict]]:
    """
    Scans budgets from min_moves to min_moves+MAX_EXTRA and returns the one
    whose measured difficulty is closest to *target_difficulty*.
    Tighter budgets → higher difficulty; looser budgets → lower difficulty.
    Returns (budget, score_info) or None if unsolvable.
    """
    min_moves = find_min_moves(grid, objective)
    if min_moves is None:
        return None

    # Max extra slack we ever add. Difficulty floor = 100 - 50*(12/(min+12)) - 50 ≈ 0.
    MAX_EXTRA = 12

    best_budget = None
    best_info = None
    best_delta = float('inf')

    for extra in range(0, MAX_EXTRA + 1):
        budget = min_moves + extra
        info = score_difficulty(grid, objective, budget, min_moves=min_moves)
        delta = abs(info['difficulty'] - target_difficulty)
        if delta < best_delta:
            best_delta = delta
            best_budget = budget
            best_info = info
        # Early stop: we've passed the target difficulty
        if info['difficulty'] < target_difficulty and extra >= 2:
            break

    return (best_budget, best_info)


# ── Level generation ──────────────────────────────────────────────────────────

LEVEL_NAMES = [
    'First Steps',    'Open Field',    'Two Lanes',    'Corner Push',
    'Split Meadow',   'Fox Run',       'Crossing',     'Ridge Walk',
    'Wolf Pack',      'Dense Forest',  'Pressure Zone','Four Points',
    'Bear Awakens',   'Mountain Pass', 'High Ridge',   'Bear Crossing',
    'Apex Hunt',      'Dino Valley',   'Cliff Edge',   'Final Summit',
]

HINTS = [
    'Move one predator adjacent to its prey to start the cascade.',
    'Both lanes are safe until you act. Trigger one at a time.',
    'Setup first, cascade second.',
    'Each corner is its own chain. Pick an order.',
    'The wolf needs two setups. Plan before you move.',
    'Fox chains are quick. Position them carefully.',
    'One misplaced move stalls the whole board.',
    'Higher predators carry more points. Feed them last.',
    'Three wolf lanes. Trigger in the order that keeps space open.',
    'Pack the score early — you will need every point.',
    'Two forced-choice moments. Choose the branch that scores most.',
    'Four corners, four chains. Sequence matters.',
    'The bear carries 48 pts. Stage it cleanly first.',
    'Bear + fox together. Bear lane first, fox for cleanup.',
    'The bear lane is the anchor. Do not fire it early.',
    'One bear and three fox. Order the fox around the bear.',
    'Dino fires for 48+20+8+3+1. One setup move ignites everything.',
    'Same chain, fresh shape. Feed the bottom, harvest the top.',
    'Every cell has a role. No wasted moves here.',
    'Final board. No free cascades — earn every point.',
]


def _min_moves_floor(target_difficulty: float) -> int:
    """
    Minimum number of player moves a level must require, scaled by difficulty.

    The intent: a hard level must not auto-resolve after a single correct move.
    Each step below represents one more deliberate player action before the
    puzzle can be complete (cascade does not count as a player move).

      difficulty  0–20  → 1  (one setup move is fine for tutorials)
      difficulty 21–60  → 2
      difficulty 61–100 → 3

    Floor is capped at 3 because find_min_moves (BFS, 200k state cap) cannot
    reliably prove min_moves ≥ 4 for tier 2+ boards with 8-10 pieces within
    that budget. To push the floor to 4 or 5, raise MAX_SEARCH_STATES in
    difficulty.py — expect proportionally slower generation for hard levels.
    """
    if target_difficulty <= 20:
        return 1
    elif target_difficulty <= 60:
        return 2
    else:
        return 3


def generate_level(
    level_index: int,
    rng: random.Random,
    max_outer_tries: int = 120,
) -> Optional[dict]:
    """
    Generate a single level at *level_index* (0-19).
    Returns a level dict compatible with src/game/levels.js, or None on failure.
    """
    target_diff = DIFFICULTY_TARGETS[level_index]
    # Map difficulty to tier: 0-19→tier0, 20-39→tier1, … 80-100→tier4
    tier = min(4, target_diff // 20)
    floor = _min_moves_floor(target_diff)
    # Tier-4 (dino) always uses a single 6-token chain; the deep cascade means a
    # single predator placement can auto-score 48+20+8+3+1 pts in one player move.
    # Getting min_moves ≥ 3 would require placing all 6 pieces > 2 steps apart,
    # which random placement rarely achieves. Cap the floor at 2 for tier 4.
    if tier >= 4:
        floor = min(floor, 2)

    for _ in range(max_outer_tries):
        counts = _piece_counts_for_tier(tier, target_diff, rng)
        grid = random_placement(TIER_CHAIN[tier], counts, rng)
        if grid is None:
            continue

        total_pts = _score_target_for_grid(grid)
        if total_pts <= 0:
            continue

        # Score target: 50–70% of max achievable to keep min_moves in a searchable range
        frac = rng.uniform(0.50, 0.70)
        score_target = max(1, round(total_pts * frac))
        objective = {'type': 'score', 'target': score_target}

        result = _tune_budget(grid, objective, target_diff, rng)
        if result is None:
            continue

        budget, info = result

        # Enforce the min_moves floor: reject layouts that are trivially solvable
        # with fewer player moves than the difficulty tier demands.
        if info['min_moves'] is None or info['min_moves'] < floor:
            continue

        if abs(info['difficulty'] - target_diff) > 30:
            continue   # too far off target — retry

        # Build level dict
        pieces_flat = []
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                if grid[r][c]:
                    pieces_flat.append([grid[r][c], r, c])

        name = LEVEL_NAMES[level_index]
        hint = HINTS[level_index]

        return {
            'id':        level_index + 1,
            'name':      name,
            'tier':      tier,
            'moves':     budget,
            'objective': {'type': 'score', 'target': score_target, 'label': f'Score {score_target} pts'},
            'hint':      hint,
            'grid':      grid,
            'pieces':    pieces_flat,   # kept for JS createGrid helper
            'meta': {
                'difficulty':      info['difficulty'],
                'target_difficulty': target_diff,
                'min_moves':       info['min_moves'],
                'solution_count':  info['solution_count'],
                'ambiguity_count': info['ambiguity_count'],
                'slack_ratio':     info['slack_ratio'],
            },
        }

    return None


# ── JS output ──────────────────────────────────────────────────────────────────

def _grid_to_js_array(grid: list) -> str:
    token_map = {'G': 'G', 'R': 'R', 'F': 'F', 'W': 'W', 'B': 'B', 'D': 'D', None: 'null'}
    rows = []
    for row in grid:
        cells = ', '.join(token_map[c] for c in row)
        rows.append(f'    [{cells}]')
    return '[\n' + ',\n'.join(rows) + '\n  ]'


def levels_to_js(levels: list[dict]) -> str:
    """Render generated levels as a drop-in src/game/levels.js replacement."""
    lines = [
        '// AUTO-GENERATED by tools/generate_levels.py — do not hand-edit.',
        '// Re-run: python tools/generate_levels.py --out src/game/levels_generated.js',
        'import {',
        '  GRASS as G, RABBIT as R, FOX as F, WOLF as W, BEAR as B, DINO as D, GRID_SIZE,',
        "} from './constants';",
        "import { hasIllegalAdjacency } from './engine';",
        '',
        'const createGrid = (pieces) => {',
        '  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));',
        '  pieces.forEach(([type, r, c]) => { grid[r][c] = type; });',
        '  return grid;',
        '};',
        '',
        'const rawLevels = [',
    ]

    for lv in levels:
        pieces_js = ', '.join(f'[{t}, {r}, {c}]' for t, r, c in lv['pieces'])
        meta = lv['meta']
        lines += [
            '  {',
            f"    id: {lv['id']},",
            f"    name: '{lv['name']}',",
            f"    tier: {lv['tier']},",
            f"    moves: {lv['moves']},",
            f"    objective: {{ type: 'score', target: {lv['objective']['target']}, label: 'Score {lv['objective']['target']} pts' }},",
            f"    hint: '{lv['hint']}',",
            f"    grid: createGrid([{pieces_js}]),",
            f"    // difficulty={meta['difficulty']} target={meta['target_difficulty']} minMoves={meta['min_moves']} solutions={meta['solution_count']}",
            '  },',
        ]

    lines += [
        '];',
        '',
        'rawLevels.forEach((entry) => {',
        '  if (hasIllegalAdjacency(entry.grid)) {',
        "    throw new Error(`Level ${entry.id} has illegal starting adjacency.`);",
        '  }',
        '});',
        '',
        'export const LEVELS = rawLevels;',
        '',
        'export const TIER_META = [',
        "  { label: 'Mixed Meadow',  color: '#4fd04f', chain: 'G->R',           levels: [0,1,2,3] },",
        "  { label: 'Fox Forest',    color: '#ff9824', chain: 'G->R->F',         levels: [4,5,6,7] },",
        "  { label: 'Wolf Ridge',    color: '#8496f0', chain: 'G->R->F->W',      levels: [8,9,10,11] },",
        "  { label: 'Bear Mountain', color: '#cd8038', chain: 'G->R->F->W->B',   levels: [12,13,14,15] },",
        "  { label: 'Dino Peak',     color: '#6ed3c8', chain: 'G->R->F->W->B->D',levels: [16,17,18,19] },",
        '];',
    ]
    return '\n'.join(lines) + '\n'


# ── Validation ────────────────────────────────────────────────────────────────

def validate_level(lv: dict) -> list[str]:
    """Returns a list of error strings (empty = OK)."""
    errors = []
    grid = lv['grid']

    from engine import has_illegal_adjacency as _hia
    if _hia(grid):
        errors.append(f"Level {lv['id']}: illegal starting adjacency")

    obj = lv['objective']
    budget = lv['moves']
    if not can_reach_objective(grid, obj, budget):
        errors.append(f"Level {lv['id']}: unsolvable with {budget} moves")

    return errors


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description='Trophic level generator')
    parser.add_argument('--count',    type=int, default=20, help='Number of levels to generate (default 20)')
    parser.add_argument('--seed',     type=int, default=42, help='Random seed')
    parser.add_argument('--out',      type=str, default=None, help='Output file (.json or .js). Omit to print JSON.')
    parser.add_argument('--validate', action='store_true', help='Validate src/game/levels.js via Python engine')
    args = parser.parse_args()

    if args.validate:
        _run_validation()
        return

    rng = random.Random(args.seed)
    levels = []
    for i in range(args.count):
        target = DIFFICULTY_TARGETS[min(i, 19)]
        print(f'  Generating level {i+1:2d}/20  target_diff={target:3d}…', end=' ', flush=True)
        lv = generate_level(i, rng)
        if lv is None:
            print('FAILED')
            sys.exit(1)
        m = lv['meta']
        print(f"diff={m['difficulty']:5.1f}  min_moves={m['min_moves']}  budget={lv['moves']}  sols={m['solution_count']}")
        levels.append(lv)

    if args.out:
        if args.out.endswith('.js'):
            content = levels_to_js(levels)
            with open(args.out, 'w') as f:
                f.write(content)
            print(f'\nWrote {args.out}')
        else:
            # JSON — strip non-serialisable grid objects for portability
            out_data = []
            for lv in levels:
                d = {k: v for k, v in lv.items() if k != 'grid'}
                out_data.append(d)
            with open(args.out, 'w') as f:
                json.dump(out_data, f, indent=2)
            print(f'\nWrote {args.out}')
    else:
        out_data = []
        for lv in levels:
            d = {k: v for k, v in lv.items() if k != 'grid'}
            out_data.append(d)
        print(json.dumps(out_data, indent=2))


def _run_validation() -> None:
    """Parse src/game/levels.js and validate each level."""
    import re, os
    js_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'game', 'levels.js')
    print(f'Validating {js_path} …')
    with open(js_path) as f:
        content = f.read()

    # Extract piece lists via regex (best-effort — full JS parsing not needed)
    # Pattern: level(id, name, tier, moves, target, hint, [...pieces...], solution)
    pattern = re.compile(
        r'level\(\s*(\d+),\s*[^,]+,\s*(\d+),\s*(\d+),\s*(\d+),\s*[^,\[]+,\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]',
        re.DOTALL,
    )

    all_ok = True
    for m in pattern.finditer(content):
        lid, tier, budget, target = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        raw_pieces = m.group(5)

        # Parse [TOKEN, r, c] entries
        token_map = {'G': 'G', 'R': 'R', 'F': 'F', 'W': 'W', 'B': 'B', 'D': 'D'}
        entry_pat = re.compile(r'\[([GRFWBD]),\s*(\d),\s*(\d)\]')
        pieces = [(token_map[t], int(r), int(c)) for t, r, c in entry_pat.findall(raw_pieces)]

        from engine import empty_grid as _eg
        grid = [[None]*6 for _ in range(6)]
        for t, r, c in pieces:
            grid[r][c] = t

        obj = {'type': 'score', 'target': target}
        lv_dict = {'id': lid, 'grid': grid, 'moves': budget, 'objective': obj}
        errs = validate_level(lv_dict)
        if errs:
            for e in errs:
                print(f'  ERROR: {e}')
            all_ok = False
        else:
            print(f'  Level {lid:2d}: OK')

    if all_ok:
        print('\nAll levels valid.')
    else:
        print('\nValidation FAILED.')
        sys.exit(1)


if __name__ == '__main__':
    main()
