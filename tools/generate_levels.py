"""
generate_levels.py — Procedural level generator for Trophic.

Run this script manually to regenerate all 20 levels:

    python tools/generate_levels.py
    python tools/generate_levels.py --seed 7       # different variety
    python tools/generate_levels.py --validate     # validate existing levels.json

Output is written to src/game/levels.json which the game reads directly.
The JSON includes full meta (difficulty, agency, cascade, spread) for
maintainability — you can inspect every metric without re-running analysis.

Generation strategy
───────────────────
1. Pick a tier (0-3) and target difficulty from the explicit 40-90 tier band
   for the level index.
2. Place a food chain appropriate for the tier on the 6×6 grid using a
   constraint-aware placer (pieces added one at a time, only to cells that
   don't violate no-predator-adjacent-to-prey).
3. Set the objective as a score target (45-75% of achievable max).
4. Compute min_moves once via BFS; scan budgets from min_moves to
   min_moves+MAX_EXTRA, passing the precomputed metrics to score_difficulty
   to avoid redundant BFS work.
5. Pick the budget whose measured difficulty is closest to the target.
   A hard slack cap (MAX_SLACK=5) rejects layouts that need an over-generous
   budget to hit difficulty.
6. Apply quality filters (min-moves floor, cascade depth, agency ratio,
   board spread, first-move branching factor) — retry on failure.
7. Progressive relaxation: if half the attempt budget is spent, widen the
   difficulty tolerance; if 75% is spent, also relax agency/branching gates.
   The best candidate found so far is returned as a last resort rather than
   hard-failing the entire run.
"""

from __future__ import annotations
import argparse
import json
import os
import random
import sys
from datetime import datetime, timezone
from typing import Optional

sys.setrecursionlimit(50_000)

from engine import (
    GRASS, RABBIT, FOX, WOLF, BEAR, DINO, DIRS8,
    GRID_SIZE, PREY_OF, PREDATOR_OF, PREY_POINTS,
    clone_grid, has_illegal_adjacency, can_reach_objective,
)
from difficulty import (
    count_winning_first_moves,
    score_difficulty,
    find_min_moves,
    measure_min_moves,
)

# ── Output path ────────────────────────────────────────────────────────────────

_TOOLS_DIR   = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_PATH = os.path.join(_TOOLS_DIR, '..', 'src', 'game', 'levels.json')

# ── Tier definitions ───────────────────────────────────────────────────────────

TIER_CHAIN = [
    [GRASS, RABBIT, FOX],
    [GRASS, RABBIT, FOX, WOLF],
    [GRASS, RABBIT, FOX, WOLF, BEAR],
    [GRASS, RABBIT, FOX, WOLF, BEAR, DINO],
]

LEVELS_PER_TIER = 5

TIER_META = [
    {'label': 'Fox Forest',    'color': '#ff9824', 'chain': 'G->R->F',             'levels': list(range(0 * LEVELS_PER_TIER, 1 * LEVELS_PER_TIER))},
    {'label': 'Wolf Ridge',    'color': '#8496f0', 'chain': 'G->R->F->W',          'levels': list(range(1 * LEVELS_PER_TIER, 2 * LEVELS_PER_TIER))},
    {'label': 'Bear Mountain', 'color': '#cd8038', 'chain': 'G->R->F->W->B',       'levels': list(range(2 * LEVELS_PER_TIER, 3 * LEVELS_PER_TIER))},
    {'label': 'Dino Peak',     'color': '#6ed3c8', 'chain': 'G->R->F->W->B->D',    'levels': list(range(3 * LEVELS_PER_TIER, 4 * LEVELS_PER_TIER))},
]

# ── Difficulty targets (explicit 40 → 90 tier bands across 20 levels) ────────

TIER_DIFFICULTY_TARGETS = [
    [40, 45, 50, 55, 60],    # Fox Forest:    40-60
    [60, 63, 65, 68, 70],    # Wolf Ridge:    60-70
    [70, 73, 75, 78, 80],    # Bear Mountain: 70-80
    [80, 83, 85, 88, 90],    # Dino Peak:     80-90
]
DIFFICULTY_TARGETS = [target for tier_targets in TIER_DIFFICULTY_TARGETS for target in tier_targets]
TIER_DIFFICULTY_BANDS = [(tier_targets[0], tier_targets[-1]) for tier_targets in TIER_DIFFICULTY_TARGETS]
TOTAL_LEVELS = len(DIFFICULTY_TARGETS)

# ── Minimum score targets per tier ────────────────────────────────────────────
# A score target below these values is trivially meaningless:
#   Tier 0 (Fox Forest)    G=1 + R=3          → at least one full fox chain = 4
#   Tier 1 (Wolf Ridge)    + F=8               → at least one wolf chain = 12
#   Tier 2 (Bear Mountain) + W=20              → at least one bear chain = 32
#   Tier 3 (Dino Peak)     + B=48              → at least half a dino chain = 40
MIN_SCORE_BY_TIER = [4, 12, 32, 40]

# ── Quality thresholds per tier ────────────────────────────────────────────────
# Each entry: (max_cascade_depth, min_agency_ratio, min_board_spread, min_branching)
#
# max_cascade_depth:    most auto-eats allowed after any single player move.
#                       Tier 3 (dino) is uncapped — the long chain cascade is intentional.
# min_agency_ratio:     player moves / (player + auto) events. 1.0 = fully manual.
#                       Higher tier = more cascade is acceptable.
# min_board_spread:     mean Chebyshev distance between pieces. Too low = clustered board
#                       where chains fire immediately once touched.
# min_first_move_branching: how many distinct opening moves lead to a solution.
#                       1 = only one valid opener (too obvious); require ≥2 for mid+ tiers.

_QUALITY_THRESHOLDS = {
    # tier: (max_cascade, min_agency, min_spread, min_branching)
    0: (3,    0.30, 1.8, 1),   # Fox Forest
    1: (4,    0.25, 2.0, 2),   # Wolf Ridge
    2: (5,    0.20, 2.0, 2),   # Bear Mountain
    3: (999,  0.10, 1.5, 1),   # Dino Peak — long cascade is the intended spectacle
}

# ── Level names and hints ──────────────────────────────────────────────────────

LEVEL_NAMES = [
    # Fox Forest (1-5)
    'First Hunt',     'Fox Trail',     'Two Lanes',     'Corner Push',    'Split Meadow',
    # Wolf Ridge (6-10)
    'Wolf Run',       'Ridge Walk',    'Crossing',      'Pressure Zone',  'Dense Forest',
    # Bear Mountain (11-15)
    'Bear Awakens',   'Mountain Pass', 'High Ridge',    'Four Points',    'Bear Crossing',
    # Dino Peak (16-20)
    'Apex Hunt',      'Dino Valley',   'Cliff Edge',    'Summit Climb',   'Final Summit',
]

HINTS = [
    # Fox Forest
    'Move the fox adjacent to the rabbit to start your first chain.',
    'One chain, one path. Set up before you trigger.',
    'Two lanes, two chains. Trigger them in order.',
    'Corner chains resolve cleanly. Pick your starting corner.',
    'Split the board — handle each side independently.',
    # Wolf Ridge
    'The wolf needs the full chain set up before it can eat.',
    'Position the wolf last — it eats the whole lane at once.',
    'One misplaced move stalls the whole board.',
    'Two forced-choice moments. Choose the branch that scores most.',
    'Pack the score early — you will need every point.',
    # Bear Mountain
    'The bear carries heavy points. Stage the full chain before feeding it.',
    'Bear + fox together. Bear lane first, fox for cleanup.',
    'The bear lane is the anchor. Do not fire it early.',
    'Four corners, four chains. Sequence matters.',
    'One bear and three fox. Order the fox around the bear.',
    # Dino Peak
    'Dino fires for 48+20+8+3+1. One setup move ignites everything.',
    'Same chain, fresh shape. Feed the bottom, harvest the top.',
    'Every cell has a role. No wasted moves here.',
    'Two dino lanes. Fire the smaller one first to keep space.',
    'Final board. No free cascades — earn every point.',
]

# ── Grid helpers ───────────────────────────────────────────────────────────────

def empty_grid() -> list:
    return [[None] * GRID_SIZE for _ in range(GRID_SIZE)]


def _placement_violates(token: str, r: int, c: int, grid: list) -> bool:
    """True if placing *token* at (r, c) would put a predator adjacent to its prey."""
    prey = PREY_OF.get(token)
    pred = PREDATOR_OF.get(token)
    for dr, dc in DIRS8:
        nr, nc = r + dr, c + dc
        if not (0 <= nr < GRID_SIZE and 0 <= nc < GRID_SIZE):
            continue
        neighbor = grid[nr][nc]
        if neighbor is None:
            continue
        if prey and neighbor == prey:    # token would eat neighbor
            return True
        if pred and neighbor == pred:    # neighbor would eat token
            return True
    return False


def random_placement(
    chain: list[str],
    piece_counts: dict[str, int],
    rng: random.Random,
    max_tries: int = 200,
) -> Optional[list]:
    """
    Place pieces on a 6×6 grid so that no predator is 8-dir adjacent to its prey.

    Uses a constraint-aware greedy strategy: places one piece at a time, choosing
    only from cells that don't violate the adjacency rule with already-placed pieces.
    Falls back to a fresh shuffle on failure.  Far faster than pure shuffle-and-reject
    for large piece sets (e.g. dino 2-chain with 12 pieces).
    """
    pieces = []
    for token, n in piece_counts.items():
        pieces.extend([token] * n)

    all_cells = [(r, c) for r in range(GRID_SIZE) for c in range(GRID_SIZE)]

    for _ in range(max_tries):
        rng.shuffle(pieces)
        grid     = empty_grid()
        occupied: set[tuple[int, int]] = set()
        success  = True

        shuffled_cells = all_cells[:]
        rng.shuffle(shuffled_cells)

        for token in pieces:
            valid = [
                (r, c) for r, c in shuffled_cells
                if (r, c) not in occupied
                and not _placement_violates(token, r, c, grid)
            ]
            if not valid:
                success = False
                break
            r, c = rng.choice(valid)
            grid[r][c] = token
            occupied.add((r, c))

        if success:
            return grid

    return None


def _score_target_for_grid(grid: list) -> int:
    """
    Maximum score achievable: only count PREY_POINTS[T] when the predator of T
    is also present on the board.
    """
    flat    = [cell for row in grid for cell in row if cell]
    present = set(flat)
    total   = 0
    for cell in flat:
        pred = PREDATOR_OF.get(cell)
        if pred and pred in present:
            total += PREY_POINTS.get(cell, 0)
    return total


def _piece_counts_for_tier(tier: int, difficulty: int, rng: random.Random) -> dict[str, int]:
    """
    Pick piece counts for one level.  1–2 complete chains, scaled by difficulty.

    Tier 3 (Dino Peak) allows 2 chains to enable forced-choice ambiguity and break
    through the ~75 difficulty ceiling that a single linear chain produces.
    MAX_SEARCH_STATES in difficulty.py is set to 1M to handle the larger state space.
    """
    chain = TIER_CHAIN[tier]

    if tier >= 3:
        # Difficulty 85+ is unreachable on the usual 3-move dino boards unless the
        # layout creates at least one forced-choice point. In practice that requires
        # 2 full chains, so don't waste half the attempts on 1-chain boards.
        n_chains = 2 if difficulty >= 85 else rng.choice([1, 2])
    else:
        # Official level targets now start at 40, so Fox Forest can open with
        # multi-chain boards instead of the old 20-39 single-chain ramp.
        n_chains = 1 + (difficulty >= 40)
        n_chains = rng.randint(n_chains, min(n_chains + 1, 2))

    # No extra lone grass for dino — 12 pieces is already the BFS limit
    extra_g = 0 if tier >= 3 else (
        rng.randint(0, max(0, 3 - tier)) if difficulty < 50 else rng.randint(0, 1)
    )

    counts: dict[str, int] = {}
    for token in chain:
        counts[token] = n_chains
    counts[GRASS] = counts.get(GRASS, 0) + extra_g

    return {k: v for k, v in counts.items() if v > 0}


# ── Budget tuning ──────────────────────────────────────────────────────────────

def _tune_budget(
    grid: list,
    objective: dict,
    target_difficulty: float,
    rng: random.Random,
    *,
    base_metrics: Optional[dict] = None,
) -> Optional[tuple[int, dict]]:
    """
    Compute min_moves once, then scan budgets from min_moves to min_moves+MAX_EXTRA
    and return the one whose measured difficulty is closest to *target_difficulty*.
    Returns (budget, score_info) or None if unsolvable.

    The precomputed min_move_metrics are passed to every score_difficulty call so
    the BFS is only run once per layout regardless of how many budgets are probed.

    MAX_SLACK caps how many extra moves beyond min_moves are allowed.  A layout
    where the only way to hit the target difficulty is a budget far above min_moves
    is a bad layout — reject it so the generator retries with a fresh placement.
    """
    base_metrics = base_metrics if base_metrics is not None else measure_min_moves(grid, objective)
    if base_metrics is None:
        return None

    solution_cache: dict[int, tuple[int, int]] = {}

    min_moves = base_metrics['min_moves']
    MAX_EXTRA = 12   # absolute scan ceiling
    MAX_SLACK = 5    # hard cap: budget may never exceed min_moves + MAX_SLACK

    best_delta = float('inf')
    candidates = []

    for extra in range(0, MAX_EXTRA + 1):
        budget = min_moves + extra
        info   = score_difficulty(
            grid,
            objective,
            budget,
            min_move_metrics=base_metrics,
            compute_branching=False,
            solution_cache=solution_cache,
        )
        delta  = abs(info['difficulty'] - target_difficulty)
        if delta < best_delta:
            best_delta = delta
        candidates.append((budget, info, delta))
        if info['difficulty'] < target_difficulty and extra >= 2:
            break

    # Enforce slack cap: drop any candidate whose budget is too generous
    candidates = [(b, i, d) for b, i, d in candidates if b - min_moves <= MAX_SLACK]
    if not candidates:
        return None

    pool = [(b, i) for b, i, d in candidates if d <= best_delta + 5]
    if not pool:
        pool = [(b, i) for b, i, d in candidates if d == min(d for _, _, d in candidates)]
    best_budget, _ = rng.choice(pool)
    precomputed_branching = count_winning_first_moves(
        grid, objective, base_metrics['min_moves']
    )
    best_info = score_difficulty(
        grid,
        objective,
        best_budget,
        min_move_metrics=base_metrics,
        precomputed_branching=precomputed_branching,
        solution_cache=solution_cache,
    )
    return (best_budget, best_info)


# ── Min-moves floor ────────────────────────────────────────────────────────────

def _min_moves_floor(target_difficulty: float) -> int:
    """
    Minimum player moves a level must require.
    Prevents hard levels from being solved by one lucky cascade move.
    """
    if target_difficulty <= 20:
        return 1
    elif target_difficulty <= 60:
        return 2
    else:
        return 3


# ── Quality gate ───────────────────────────────────────────────────────────────

def _passes_quality(info: dict, tier: int, *, relax: bool = False) -> bool:
    """
    Returns True when all agency / spread / branching metrics are within
    acceptable bounds for the given tier.

    When *relax* is True (used in late generation attempts), only the hard
    structural constraints (cascade depth and board spread) are enforced.
    Agency ratio and branching factor are skipped — these matter for feel but
    a slightly imperfect level is better than no level at all.
    """
    max_casc, min_agency, min_spread, min_branching = _QUALITY_THRESHOLDS[tier]

    if info['max_cascade_depth'] > max_casc:
        return False
    if info['mean_pairwise_distance'] < min_spread:
        return False
    if not relax:
        if info['agency_ratio'] < min_agency:
            return False
        if info['first_move_branching_factor'] < min_branching:
            return False
    return True


# ── Progressive attempt tolerances ────────────────────────────────────────────

def _attempt_tolerances(attempt: int, max_tries: int) -> tuple[int, bool]:
    """
    Widen acceptance criteria as the attempt count grows to avoid hard failures.

    Phase 0 (0–49 % of budget): strict  — ±30 difficulty, full quality gate.
    Phase 1 (50–74 %):          relaxed — ±40 difficulty, full quality gate.
    Phase 2 (75–100 %):         lenient — ±50 difficulty, skip agency/branching.
    """
    frac = attempt / max_tries
    if frac < 0.50:
        return 30, False
    elif frac < 0.75:
        return 40, False
    return 50, True


# ── Level assembly ─────────────────────────────────────────────────────────────

def _build_level(
    level_index: int,
    tier: int,
    grid: list,
    budget: int,
    score_target: int,
    info: dict,
) -> dict:
    pieces = [
        [grid[r][c], r, c]
        for r in range(GRID_SIZE)
        for c in range(GRID_SIZE)
        if grid[r][c]
    ]
    return {
        'id':        level_index + 1,
        'name':      LEVEL_NAMES[level_index],
        'tier':      tier,
        'moves':     budget,
        'objective': {
            'type':   'score',
            'target': score_target,
            'label':  f'Score {score_target} pts',
        },
        'hint':      HINTS[level_index],
        'pieces':    pieces,
        'meta': {
            'difficulty':                  info['difficulty'],
            'target_difficulty':           DIFFICULTY_TARGETS[level_index],
            'min_moves':                   info['min_moves'],
            'solution_count':              info['solution_count'],
            'ambiguity_count':             info['ambiguity_count'],
            'slack_ratio':                 info['slack_ratio'],
            'max_cascade_depth':           info['max_cascade_depth'],
            'total_auto_events':           info['total_auto_events'],
            'agency_ratio':                info['agency_ratio'],
            'first_move_branching_factor': info['first_move_branching_factor'],
            'mean_pairwise_distance':      info['mean_pairwise_distance'],
        },
    }


def _assign_level_slot(level: dict, level_index: int) -> dict:
    """
    Rewrite slot-dependent metadata after final difficulty ordering.

    The level geometry, move budget, objective, and measured difficulty stay
    untouched; only campaign-facing labels and target metadata are reseated to
    match the final slot order.
    """
    level['id'] = level_index + 1
    level['name'] = LEVEL_NAMES[level_index]
    level['hint'] = HINTS[level_index]
    level['meta']['target_difficulty'] = DIFFICULTY_TARGETS[level_index]
    return level


def _order_levels_by_difficulty(levels: list[dict]) -> list[dict]:
    """
    Sort levels by measured difficulty within each tier band, then reseat them
    into their final campaign slots.

    Hard biome bands guarantee tiers do not overlap (Fox < Wolf < Bear < Dino),
    so sorting within each tier yields a globally rising campaign curve.
    """
    ordered: list[dict] = []

    for tier in range(len(TIER_CHAIN)):
        tier_levels = [lv for lv in levels if lv['tier'] == tier]
        if len(tier_levels) != LEVELS_PER_TIER:
            raise ValueError(
                f'Tier {tier} expected {LEVELS_PER_TIER} levels, got {len(tier_levels)}'
            )

        tier_levels.sort(
            key=lambda lv: (
                lv['meta']['difficulty'],
                lv['meta']['min_moves'],
                lv['moves'],
                lv['objective']['target'],
            )
        )

        base_index = tier * LEVELS_PER_TIER
        for offset, level in enumerate(tier_levels):
            ordered.append(_assign_level_slot(level, base_index + offset))

    return ordered


# ── Level generation ───────────────────────────────────────────────────────────

# Rejection stage labels used in per-level debug output
_R_PLACEMENT  = 'place'
_R_SCORE      = 'score'
_R_UNSOLVABLE = 'unsolv'
_R_FLOOR      = 'floor'
_R_BAND       = 'band'
_R_DIFF       = 'diff'
_R_QUALITY    = 'qual'


def generate_level(
    level_index: int,
    rng: random.Random,
    max_outer_tries: int = 200,
) -> Optional[dict]:
    """
    Generate a single level at *level_index* within the configured target list.

    Tries up to *max_outer_tries* random layouts.  Acceptance thresholds widen
    progressively so the generator never hard-fails on a single level — the
    best candidate found within tolerance is returned as a fallback, or None
    only if nothing solvable was found at all.
    """
    target_diff = DIFFICULTY_TARGETS[level_index]
    tier        = level_index // LEVELS_PER_TIER
    band_min, band_max = TIER_DIFFICULTY_BANDS[tier]
    floor       = _min_moves_floor(target_diff)

    rejects = {_R_PLACEMENT: 0, _R_SCORE: 0, _R_UNSOLVABLE: 0,
               _R_FLOOR: 0, _R_BAND: 0, _R_DIFF: 0, _R_QUALITY: 0}

    best_candidate: Optional[dict] = None
    best_delta = float('inf')

    for attempt in range(max_outer_tries):
        diff_tolerance, relax_quality = _attempt_tolerances(attempt, max_outer_tries)

        counts = _piece_counts_for_tier(tier, target_diff, rng)
        grid   = random_placement(TIER_CHAIN[tier], counts, rng)
        if grid is None:
            rejects[_R_PLACEMENT] += 1
            continue

        total_pts = _score_target_for_grid(grid)
        if total_pts <= 0:
            rejects[_R_SCORE] += 1
            continue

        frac         = rng.uniform(0.45, 0.75)
        score_target = max(MIN_SCORE_BY_TIER[tier], round(total_pts * frac))
        if score_target > total_pts:
            rejects[_R_SCORE] += 1
            continue

        objective = {'type': 'score', 'target': score_target}

        base_metrics = measure_min_moves(grid, objective)
        if base_metrics is None:
            rejects[_R_UNSOLVABLE] += 1
            continue

        if base_metrics['min_moves'] < floor:
            rejects[_R_FLOOR] += 1
            continue

        result = _tune_budget(
            grid,
            objective,
            target_diff,
            rng,
            base_metrics=base_metrics,
        )
        if result is None:
            rejects[_R_UNSOLVABLE] += 1
            continue

        budget, info = result

        delta = abs(info['difficulty'] - target_diff)

        if not (band_min <= info['difficulty'] <= band_max):
            rejects[_R_BAND] += 1
            continue

        # Keep the closest band-valid candidate as the fallback. This preserves
        # the hard difficulty split even when the full quality gate cannot be met.
        if delta < best_delta:
            best_delta     = delta
            best_candidate = _build_level(level_index, tier, grid, budget, score_target, info)

        if delta > diff_tolerance:
            rejects[_R_DIFF] += 1
            continue

        if not _passes_quality(info, tier, relax=relax_quality):
            rejects[_R_QUALITY] += 1
            continue

        return _build_level(level_index, tier, grid, budget, score_target, info)

    # All attempts exhausted — use best-found fallback if available
    if best_candidate is not None:
        print(
            f'  [warn] level {level_index + 1}: using best-found '
            f'(Δdiff={best_delta:.1f})  rejects={rejects}'
        )
        return best_candidate

    print(f'  [fail] level {level_index + 1}: all {max_outer_tries} attempts rejected  rejects={rejects}')
    return None


# ── Validation ────────────────────────────────────────────────────────────────

def _build_grid_from_pieces(pieces: list) -> list:
    grid = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    for token, r, c in pieces:
        grid[r][c] = token
    return grid


def validate_level(lv: dict) -> list[str]:
    """Returns a list of error strings (empty = OK)."""
    errors = []
    grid   = _build_grid_from_pieces(lv['pieces'])
    obj    = lv['objective']
    budget = lv['moves']

    if has_illegal_adjacency(grid):
        errors.append(f"Level {lv['id']}: illegal starting adjacency")

    if not can_reach_objective(grid, obj, budget):
        errors.append(f"Level {lv['id']}: unsolvable with {budget} moves")

    return errors


# ── JSON export ────────────────────────────────────────────────────────────────

def _build_output(levels: list[dict], seed: int) -> dict:
    """Build the full levels.json structure."""
    return {
        '_comment':     'AUTO-GENERATED by tools/generate_levels.py — do not hand-edit.',
        '_run':         {
            'seed':         seed,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'count':        len(levels),
        },
        'tier_meta':    TIER_META,
        'levels':       levels,
    }


def _print_table_header(index_label: str) -> None:
    print(f'{index_label:>4}  {"Diff":>6}  {"Target":>6}  {"MinMv":>5}  {"Budget":>6}  '
          f'{"Sols":>4}  {"Casc":>4}  {"Agcy":>5}  {"Sprd":>5}  {"Brch":>4}')
    print('-' * 72)


def _print_level_table(levels: list[dict], label: str) -> None:
    print(f'\n{label}\n')
    _print_table_header('Lvl')
    for lv in levels:
        m = lv['meta']
        print(
            f'  {lv["id"]:2d}  '
            f'{m["difficulty"]:6.1f}  {m["target_difficulty"]:6d}  '
            f'{m["min_moves"]:5d}  {lv["moves"]:6d}  '
            f'{m["solution_count"]:4d}  {m["max_cascade_depth"]:4d}  '
            f'{m["agency_ratio"]:5.2f}  {m["mean_pairwise_distance"]:5.2f}  '
            f'{m["first_move_branching_factor"]:4d}'
        )


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description=f'Generate {TOTAL_LEVELS} Trophic levels and write to src/game/levels.json'
    )
    parser.add_argument('--seed',     type=int, default=42,   help='Random seed (default 42)')
    parser.add_argument('--validate', action='store_true',    help='Validate existing levels.json')
    parser.add_argument('--out',      type=str, default=None,
                        help=f'Output path (default: {_OUTPUT_PATH})')
    args = parser.parse_args()

    out_path = args.out or _OUTPUT_PATH

    if args.validate:
        _run_validation(out_path)
        return

    rng    = random.Random(args.seed)
    levels = []

    print(f'\nGenerating {TOTAL_LEVELS} levels  (seed={args.seed})\n')
    _print_table_header('Slot')

    for i in range(TOTAL_LEVELS):
        print(f'{i + 1:4d}  ', end='', flush=True)
        lv = generate_level(i, rng)
        if lv is None:
            print('FAILED — cannot continue.')
            sys.exit(1)
        m = lv['meta']
        print(
            f'{m["difficulty"]:6.1f}  {m["target_difficulty"]:6d}  '
            f'{m["min_moves"]:5d}  {lv["moves"]:6d}  '
            f'{m["solution_count"]:4d}  {m["max_cascade_depth"]:4d}  '
            f'{m["agency_ratio"]:5.2f}  {m["mean_pairwise_distance"]:5.2f}  '
            f'{m["first_move_branching_factor"]:4d}'
        )
        levels.append(lv)

    levels = _order_levels_by_difficulty(levels)
    _print_level_table(levels, 'Final campaign order (sorted by measured difficulty)')

    # Final validation pass
    print('\nValidating …')
    all_ok = True
    for lv in levels:
        errs = validate_level(lv)
        for e in errs:
            print(f'  ERROR: {e}')
            all_ok = False
    if not all_ok:
        print('Validation FAILED — levels not written.')
        sys.exit(1)
    print(f'All {TOTAL_LEVELS} levels valid.')

    output = _build_output(levels, args.seed)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f'\nWrote {os.path.abspath(out_path)}')


def _run_validation(path: str) -> None:
    path = os.path.abspath(path)
    if not os.path.exists(path):
        print(f'File not found: {path}')
        sys.exit(1)
    print(f'Validating {path} …')
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    levels  = data['levels']
    all_ok  = True
    for lv in levels:
        errs = validate_level(lv)
        if errs:
            for e in errs:
                print(f'  ERROR: {e}')
            all_ok = False
        else:
            print(f'  Level {lv["id"]:2d}: OK')
    if all_ok:
        print('\nAll levels valid.')
    else:
        print('\nValidation FAILED.')
        sys.exit(1)


if __name__ == '__main__':
    main()
