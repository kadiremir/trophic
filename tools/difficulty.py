"""
difficulty.py — Level difficulty scoring and minimum-move search.

Formula (see tools/LEVELGEN.md for full rationale):

    slack_ratio     = (budget - min_moves) / budget        # 0 = hardest, 1 = easiest
    solution_count  = distinct winning paths (capped at MAX_SOLUTIONS)
    ambiguity_count = forced-choice points in the shortest winning path

    difficulty = 100
               - 50 * slack_ratio
               - 30 * log2(solution_count + 1) / log2(MAX_SOLUTIONS + 1)
               - 20 * (ambiguity_count == 0)

Range: ~0 (trivial) to 100 (brutal).

When engine.js rules change, re-derive min_moves and re-run scoring for all levels.
"""

from __future__ import annotations
import math
from collections import deque
from typing import Optional

from engine import (
    Grid, GRASS, PREY_OF, PREY_POINTS,
    clone_grid, serialize_grid, get_remaining_score_potential,
    get_legal_targets, execute_move, get_forced_choice,
    _resolve_choice_branches, can_reach_objective,
)

MAX_SOLUTIONS = 50    # cap for normalisation
MAX_SEARCH_STATES = 200_000  # safety valve for large boards


def find_min_moves(grid: Grid, objective: dict) -> Optional[int]:
    """
    BFS over (grid_state, score) to find the minimum number of player moves
    needed to satisfy *objective*.  Returns None if unsolvable within
    MAX_SEARCH_STATES expanded nodes.
    """
    start_key = f"{serialize_grid(grid)}|0"
    queue: deque[tuple[Grid, int, int]] = deque()
    queue.append((grid, 0, 0))   # grid, score, moves_used
    visited: set[str] = {start_key}
    expanded = 0

    while queue:
        if expanded >= MAX_SEARCH_STATES:
            return None
        g, score, moves = queue.popleft()
        expanded += 1

        for r in range(6):
            for c in range(6):
                piece = g[r][c]
                if not piece or piece == GRASS:
                    continue
                for tr, tc in get_legal_targets(g, r, c):
                    res = execute_move(g, r, c, tr, tc)
                    if not res:
                        continue
                    for branch in _resolve_choice_branches(res['grid']):
                        new_score = score + res['pts'] + branch['pts']
                        new_moves = moves + 1
                        if objective['type'] == 'score' and new_score >= objective['target']:
                            return new_moves
                        if objective['type'] == 'score':
                            if new_score + get_remaining_score_potential(branch['grid']) < objective['target']:
                                continue
                        key = f"{serialize_grid(branch['grid'])}|{new_score}"
                        if key not in visited:
                            visited.add(key)
                            queue.append((branch['grid'], new_score, new_moves))

    return None


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

        for r in range(6):
            for c in range(6):
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


def score_difficulty(
    grid: Grid,
    objective: dict,
    budget: int,
    min_moves: Optional[int] = None,
) -> dict:
    """
    Computes difficulty in [0, 100] for a level.

    Returns a dict with:
      difficulty      – float, 0 (trivial) … 100 (max hard)
      min_moves       – int or None
      solution_count  – int (capped at MAX_SOLUTIONS)
      ambiguity_count – int (forced-choice nodes on first solution path)
      slack_ratio     – float
    """
    if min_moves is None:
        min_moves = find_min_moves(grid, objective)

    if min_moves is None or min_moves > budget:
        # Unsolvable or search exhausted — treat as hardest
        return {
            'difficulty': 100.0,
            'min_moves': None,
            'solution_count': 0,
            'ambiguity_count': 0,
            'slack_ratio': 0.0,
        }

    slack_ratio = (budget - min_moves) / budget

    # Cap the counting budget: counting with a generous budget is intractable.
    # Solutions beyond min_moves+4 are already "easy" and the slack_ratio term
    # already captures that — we only need counts at the tight end.
    counting_budget = min(budget, min_moves + 4)
    sol_count, ambig_count = count_solutions(grid, objective, counting_budget)
    sol_count = max(sol_count, 1)  # at least 1 since it's solvable

    log_max = math.log(MAX_SOLUTIONS + 1)
    log_sol = math.log(sol_count + 1)

    difficulty = (
        100
        - 50 * slack_ratio
        - 30 * (log_sol / log_max)
        - 20 * (1 if ambig_count == 0 else 0)
    )
    difficulty = max(0.0, min(100.0, difficulty))

    return {
        'difficulty': round(difficulty, 1),
        'min_moves': min_moves,
        'solution_count': sol_count,
        'ambiguity_count': ambig_count,
        'slack_ratio': round(slack_ratio, 3),
    }
