"""
difficulty.py — Level difficulty scoring and minimum-move search.

Formula (see tools/LEVELGEN.md for full rationale):

    slack_ratio     = (budget - min_moves) / budget        # 0 = hardest, 1 = easiest
    abs_slack       = budget - min_moves                   # raw extra moves granted
    solution_count  = distinct winning paths (capped at MAX_SOLUTIONS)
    ambiguity_count = forced-choice points in the shortest winning path

    difficulty = 100
               - 50 * slack_ratio                          # relative tightness
               - 15 * abs_slack / MAX_SLACK                # absolute generosity penalty
               - 30 * log(solution_count+1) / log(51)      # solution count
               + 10 * min_moves / MAX_MIN_MOVES            # planning depth bonus
               - 20 / (ambiguity_count + 1)                # forced-choice reward (continuous)

Range: ~0 (trivial) to 100 (brutal).

The ambiguity term is continuous: 0 choices → -20, 1 choice → -10, 2 → -6.7, … → 0.
This rewards each additional forced choice, not just the first one.

Agency metrics (see score_difficulty return dict):
    max_cascade_depth         — most auto-eat events triggered by a single player move
                                on the first optimal path found
    total_auto_events         — total auto-eats across all moves on that path
    agency_ratio              — min_moves / (min_moves + total_auto_events);
                                1.0 = player does everything, 0.0 = pure cascade
    first_move_branching_factor — number of distinct (sr,sc,tr,tc) openers that lead
                                  to a solution in min_moves total

    mean_pairwise_distance    — mean Chebyshev distance between all pairs of pieces
                                (proxy for clustering; low = tightly packed board)

When engine.js rules change, re-derive min_moves and re-run scoring for all levels.
"""

from __future__ import annotations
import math
from collections import deque
from itertools import combinations
from typing import Optional

from engine import (
    Grid, GRASS, GRID_SIZE, PREY_OF, PREY_POINTS,
    clone_grid, serialize_grid, get_remaining_score_potential,
    get_legal_targets, execute_move, get_forced_choice,
    _resolve_choice_branches, can_reach_objective,
)

MAX_SOLUTIONS     = 50           # cap for solution-count normalisation
MAX_SEARCH_STATES = 1_000_000    # raised to support dino 2-chain layouts (12 pieces)
MAX_SLACK         = 5            # normaliser for abs_slack term (matches _tune_budget cap)
MAX_MIN_MOVES     = 6            # normaliser for planning-depth bonus


# ── Board geometry ─────────────────────────────────────────────────────────────

def measure_board_spread(grid: Grid) -> float:
    """
    Mean Chebyshev distance between all pairs of non-empty cells (including grass).
    Low value = pieces clustered together = cascades fire easily.
    """
    pieces = [
        (r, c)
        for r in range(GRID_SIZE)
        for c in range(GRID_SIZE)
        if grid[r][c] is not None
    ]
    if len(pieces) < 2:
        return 0.0
    dists = [
        max(abs(r1 - r2), abs(c1 - c2))
        for (r1, c1), (r2, c2) in combinations(pieces, 2)
    ]
    return round(sum(dists) / len(dists), 3)


# ── Unified BFS ────────────────────────────────────────────────────────────────

def measure_min_moves(grid: Grid, objective: dict) -> Optional[dict]:
    """
    BFS over grid states to find the minimum number of player moves needed
    to satisfy *objective*, plus cascade statistics for the first optimal path found.

    Returns a dict with:
      min_moves         — int
      max_cascade_depth — int, worst single-move cascade on this optimal path
      total_auto_events — int, total auto-eats across all moves on this path
    or None if unsolvable / MAX_SEARCH_STATES exceeded.

    Replaces the former find_min_moves + find_min_moves_with_metrics pair.
    Callers that only need the move count should use find_min_moves().
    Callers that also need cascade metrics (e.g. score_difficulty) should call
    this directly and pass the result as min_move_metrics to avoid a second BFS.
    """
    # Current score is fully determined by the remaining board contents, so the
    # grid alone is a sufficient visited key. Including score multiplies the
    # search space with no extra information.
    start_key = serialize_grid(grid)
    queue: deque = deque()
    queue.append((grid, 0, 0, 0, 0))   # grid, score, moves, max_casc, total_auto
    visited: set[str] = {start_key}
    expanded = 0

    while queue:
        if expanded >= MAX_SEARCH_STATES:
            return None
        g, score, moves, max_casc, total_auto = queue.popleft()
        expanded += 1

        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                piece = g[r][c]
                if not piece or piece == GRASS:
                    continue
                for tr, tc in get_legal_targets(g, r, c):
                    res = execute_move(g, r, c, tr, tc)
                    if not res:
                        continue
                    for branch in _resolve_choice_branches(res['grid']):
                        auto_this_move = sum(
                            1 for e in res['events'] if e.get('kind') == 'auto'
                        ) + sum(
                            1 for e in branch['events'] if e.get('kind') in ('auto', 'choose')
                        )
                        new_max_casc   = max(max_casc, auto_this_move)
                        new_total_auto = total_auto + auto_this_move
                        new_score      = score + res['pts'] + branch['pts']
                        new_moves      = moves + 1

                        if objective['type'] == 'score' and new_score >= objective['target']:
                            return {
                                'min_moves':         new_moves,
                                'max_cascade_depth': new_max_casc,
                                'total_auto_events': new_total_auto,
                            }
                        if objective['type'] == 'score':
                            if new_score + get_remaining_score_potential(branch['grid']) < objective['target']:
                                continue

                        key = serialize_grid(branch['grid'])
                        if key not in visited:
                            visited.add(key)
                            queue.append((branch['grid'], new_score, new_moves, new_max_casc, new_total_auto))

    return None


def find_min_moves(grid: Grid, objective: dict) -> Optional[int]:
    """
    Convenience wrapper: returns the minimum player-move count, or None.
    When cascade metrics are also needed, call measure_min_moves() directly
    and pass the result to score_difficulty() via min_move_metrics= to avoid
    a redundant BFS pass.
    """
    result = measure_min_moves(grid, objective)
    return result['min_moves'] if result else None


# ── First-move branching factor ────────────────────────────────────────────────

def count_winning_first_moves(grid: Grid, objective: dict, min_moves: int) -> int:
    """
    Count distinct (sr, sc, tr, tc) first-move choices that lead to a solution
    in exactly *min_moves* total moves.

    For each first move we check whether any of its cascade branches leaves a
    grid that is solvable in min_moves-1 remaining moves.  This requires one
    find_min_moves call per candidate first move, which is slow but fine for
    offline generation.
    """
    if min_moves <= 0:
        return 0

    count = 0
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            piece = grid[r][c]
            if not piece or piece == GRASS:
                continue
            for tr, tc in get_legal_targets(grid, r, c):
                res = execute_move(grid, r, c, tr, tc)
                if not res:
                    continue
                leads_to_solution = False
                for branch in _resolve_choice_branches(res['grid']):
                    branch_pts = res['pts'] + branch['pts']
                    if objective['type'] == 'score':
                        remaining = objective['target'] - branch_pts
                        if remaining <= 0:
                            leads_to_solution = True
                            break
                        rem_obj = {'type': 'score', 'target': remaining}
                        rem_min = find_min_moves(branch['grid'], rem_obj)
                        if rem_min is not None and rem_min <= min_moves - 1:
                            leads_to_solution = True
                            break
                if leads_to_solution:
                    count += 1
    return count


# ── Solution counting ──────────────────────────────────────────────────────────

def count_solutions(
    grid: Grid,
    objective: dict,
    budget: int,
    cap: int = MAX_SOLUTIONS,
) -> tuple[int, int]:
    """
    Counts distinct winning paths (capped at *cap*) and the number of
    forced-choice points along the lexicographically first winning path.

    Uses memoisation keyed on (grid_state, score, moves_left) to avoid
    re-exploring equivalent states.  Returns (solution_count, ambiguity_count).

    Note: solution_count is a lower bound — the node cap (30 000) may cause
    undercounting for complex boards, which slightly inflates measured difficulty.
    """
    solutions = [0]
    first_path_ambiguities = [None]  # set once when the first solution is found
    nodes = [0]
    MAX_NODES = 30_000

    def dfs(g: Grid, score: int, moves_left: int, choice_points: int) -> None:
        if solutions[0] >= cap or nodes[0] >= MAX_NODES:
            return
        nodes[0] += 1
        if objective['type'] == 'score' and score >= objective['target']:
            solutions[0] += 1
            if first_path_ambiguities[0] is None:
                first_path_ambiguities[0] = choice_points
            return
        if moves_left <= 0:
            return
        if objective['type'] == 'score':
            if score + get_remaining_score_potential(g) < objective['target']:
                return

        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                piece = g[r][c]
                if not piece or piece == GRASS:
                    continue
                for tr, tc in get_legal_targets(g, r, c):
                    if nodes[0] >= MAX_NODES:
                        return
                    res = execute_move(g, r, c, tr, tc)
                    if not res:
                        continue
                    branches = _resolve_choice_branches(res['grid'])
                    extra_choice = 1 if len(branches) > 1 else 0
                    for branch in branches:
                        dfs(
                            branch['grid'],
                            score + res['pts'] + branch['pts'],
                            moves_left - 1,
                            choice_points + extra_choice,
                        )

    dfs(grid, 0, budget, 0)
    return solutions[0], (first_path_ambiguities[0] or 0)


# ── Master scoring function ────────────────────────────────────────────────────

def score_difficulty(
    grid: Grid,
    objective: dict,
    budget: int,
    *,
    min_move_metrics: Optional[dict] = None,
    compute_branching: bool = True,
    precomputed_branching: Optional[int] = None,
    solution_cache: Optional[dict[int, tuple[int, int]]] = None,
) -> dict:
    """
    Computes difficulty in [0, 100] for a level plus all agency / spread metrics.

    Pass *min_move_metrics* (the dict returned by measure_min_moves) when you have
    already computed it for this grid+objective — saves an entire BFS pass.  If
    omitted, it is computed here.

    Set *compute_branching* to `False` when you only need the difficulty score
    during intermediate budget tuning; callers can then compute branching once
    for the final selected budget.

    *precomputed_branching* lets callers reuse the first-move branching factor
    across multiple budget probes for the same grid/objective.

    *solution_cache* lets callers memoize `(solution_count, ambiguity_count)` by
    counting budget when scanning nearby move budgets for the same layout.

    Returns a dict with:
      difficulty                — float, 0 (trivial) … 100 (max hard)
      min_moves                 — int or None
      solution_count            — int (capped at MAX_SOLUTIONS)
      ambiguity_count           — int (forced-choice nodes on first solution path)
      slack_ratio               — float
      max_cascade_depth         — int (worst single-move cascade on optimal path)
      total_auto_events         — int (total auto-eats on optimal path)
      agency_ratio              — float (min_moves / (min_moves + total_auto_events))
      first_move_branching_factor — int (distinct winning openers)
      mean_pairwise_distance    — float (board clustering proxy)
    """
    spread  = measure_board_spread(grid)
    metrics = min_move_metrics if min_move_metrics is not None else measure_min_moves(grid, objective)

    if metrics is None:
        # Unsolvable or search exhausted — treat as hardest
        return {
            'difficulty':                   100.0,
            'min_moves':                    None,
            'solution_count':               0,
            'ambiguity_count':              0,
            'slack_ratio':                  0.0,
            'max_cascade_depth':            0,
            'total_auto_events':            0,
            'agency_ratio':                 0.0,
            'first_move_branching_factor':  0,
            'mean_pairwise_distance':       spread,
        }

    min_moves_val     = metrics['min_moves']
    max_cascade_depth = metrics['max_cascade_depth']
    total_auto_events = metrics['total_auto_events']

    if min_moves_val > budget:
        return {
            'difficulty':                   100.0,
            'min_moves':                    min_moves_val,
            'solution_count':               0,
            'ambiguity_count':              0,
            'slack_ratio':                  0.0,
            'max_cascade_depth':            max_cascade_depth,
            'total_auto_events':            total_auto_events,
            'agency_ratio':                 0.0,
            'first_move_branching_factor':  0,
            'mean_pairwise_distance':       spread,
        }

    agency_ratio = round(
        min_moves_val / (min_moves_val + total_auto_events)
        if (min_moves_val + total_auto_events) > 0 else 1.0,
        3,
    )

    if not compute_branching:
        branching = 0
    else:
        branching = (
            precomputed_branching
            if precomputed_branching is not None
            else count_winning_first_moves(grid, objective, min_moves_val)
        )

    abs_slack   = budget - min_moves_val
    slack_ratio = abs_slack / budget

    counting_budget = min(budget, min_moves_val + 4)
    if solution_cache is not None and counting_budget in solution_cache:
        sol_count, ambig_count = solution_cache[counting_budget]
    else:
        sol_count, ambig_count = count_solutions(grid, objective, counting_budget)
        if solution_cache is not None:
            solution_cache[counting_budget] = (sol_count, ambig_count)
    sol_count = max(sol_count, 1)

    log_max = math.log(MAX_SOLUTIONS + 1)
    log_sol = math.log(sol_count + 1)

    difficulty = (
        100
        - 50  * slack_ratio                          # relative tightness
        - 15  * (abs_slack / MAX_SLACK)              # absolute generosity penalty
        - 30  * (log_sol / log_max)                  # solution count
        + 10  * (min_moves_val / MAX_MIN_MOVES)      # planning depth bonus
        - 20  / (ambig_count + 1)                    # forced-choice reward (continuous)
    )
    difficulty = max(0.0, min(100.0, difficulty))

    return {
        'difficulty':                   round(difficulty, 1),
        'min_moves':                    min_moves_val,
        'solution_count':               sol_count,
        'ambiguity_count':              ambig_count,
        'slack_ratio':                  round(slack_ratio, 3),
        'max_cascade_depth':            max_cascade_depth,
        'total_auto_events':            total_auto_events,
        'agency_ratio':                 agency_ratio,
        'first_move_branching_factor':  branching,
        'mean_pairwise_distance':       spread,
    }
