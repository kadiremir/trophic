"""
engine.py — Python port of src/game/engine.js

Mirrors every rule exactly. When engine.js changes, update this file in the same PR.
See tools/LEVELGEN.md for the authoritative sync checklist.

Food chain: G(grass) <- R(rabbit) <- F(fox) <- W(wolf) <- B(bear) <- D(dino)
Movement: one step in any of the 8 directions (Chebyshev distance == 1).
Forced-eat priority: lowest trophic tier first (R before F before W before B before D).
  - Exactly 1 forced eat at the active tier  → resolve automatically.
  - 2+ forced eats at the active tier        → player must choose one (forced-choice phase).
Level start constraint: no predator may be 8-dir adjacent to its prey at turn 0.
"""

from __future__ import annotations
import copy
from typing import Optional

# ── Entity tokens ──────────────────────────────────────────────────────────────
GRASS  = 'G'
RABBIT = 'R'
FOX    = 'F'
WOLF   = 'W'
BEAR   = 'B'
DINO   = 'D'
EMPTY  = None

GRID_SIZE = 6

# What each predator eats
PREY_OF: dict[str, str] = {
    RABBIT: GRASS,
    FOX:    RABBIT,
    WOLF:   FOX,
    BEAR:   WOLF,
    DINO:   BEAR,
}

PREY_POINTS: dict[str, int] = {
    GRASS:  1,
    RABBIT: 3,
    FOX:    8,
    WOLF:   20,
    BEAR:   48,
}

# Lower number = resolved first
JUMP_PRIORITY: dict[str, int] = {
    RABBIT: 0,
    FOX:    1,
    WOLF:   2,
    BEAR:   3,
    DINO:   4,
}

DIRS8 = [
    (-1, -1), (-1, 0), (-1, 1),
    ( 0, -1),          ( 0, 1),
    ( 1, -1), ( 1, 0), ( 1, 1),
]

Grid = list[list[Optional[str]]]


# ── Helpers ────────────────────────────────────────────────────────────────────

def clone_grid(g: Grid) -> Grid:
    return [row[:] for row in g]


def in_bounds(r: int, c: int) -> bool:
    return 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE


def serialize_grid(grid: Grid) -> str:
    return '|'.join(''.join(cell or '.' for cell in row) for row in grid)


def is_one_step(r1: int, c1: int, r2: int, c2: int) -> bool:
    return max(abs(r1 - r2), abs(c1 - c2)) == 1


def get_remaining_score_potential(grid: Grid) -> int:
    return sum(PREY_POINTS.get(cell, 0) for row in grid for cell in row)


def has_illegal_adjacency(grid: Grid) -> bool:
    """True if any predator starts 8-dir adjacent to its prey (forbidden at level start)."""
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            cell = grid[r][c]
            if not cell or cell == GRASS:
                continue
            prey = PREY_OF.get(cell)
            if not prey:
                continue
            for dr, dc in DIRS8:
                nr, nc = r + dr, c + dc
                if in_bounds(nr, nc) and grid[nr][nc] == prey:
                    return True
    return False


# ── Move logic ─────────────────────────────────────────────────────────────────

def get_legal_targets(grid: Grid, sr: int, sc: int) -> set[tuple[int, int]]:
    piece = grid[sr][sc]
    if not piece or piece == GRASS:
        return set()
    out = set()
    for dr, dc in DIRS8:
        nr, nc = sr + dr, sc + dc
        if not in_bounds(nr, nc):
            continue
        target = grid[nr][nc]
        if target is None or PREY_OF.get(piece) == target:
            out.add((nr, nc))
    return out


def _sort_jump_options(options: list[dict]) -> list[dict]:
    return sorted(
        options,
        key=lambda o: (
            JUMP_PRIORITY[o['pred']],
            o['from'][0], o['from'][1],
            o['to'][0],   o['to'][1],
        )
    )


def get_forced_jump_options(grid: Grid) -> list[dict]:
    """
    Returns every forced-eat at the active (lowest) trophic tier.
    Mirrors getForcedJumpOptions in engine.js exactly.
    """
    options = []
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            pred = grid[r][c]
            if not pred or pred == GRASS:
                continue
            prey = PREY_OF.get(pred)
            if not prey:
                continue
            for dr, dc in DIRS8:
                nr, nc = r + dr, c + dc
                if in_bounds(nr, nc) and grid[nr][nc] == prey:
                    options.append({
                        'pred': pred,
                        'prey': prey,
                        'from': (r, c),
                        'to':   (nr, nc),
                        'pts':  PREY_POINTS.get(prey, 0),
                        'priority': JUMP_PRIORITY[pred],
                        'kind': 'auto',
                    })

    if not options:
        return []
    min_priority = min(o['priority'] for o in options)
    return _sort_jump_options([o for o in options if o['priority'] == min_priority])


def get_forced_choice(grid: Grid) -> Optional[list[dict]]:
    """Returns forced-choice options when the player must choose, else None."""
    options = get_forced_jump_options(grid)
    return options if len(options) > 1 else None


def _apply_jump_option(grid: Grid, option: dict, kind: str = 'auto') -> dict:
    g = clone_grid(grid)
    fr, fc = option['from']
    tr, tc = option['to']
    earned = PREY_POINTS.get(option['prey'], 0)
    g[tr][tc] = option['pred']
    g[fr][fc] = None
    return {'grid': g, 'pts': earned, 'event': {**option, 'kind': kind}}


def resolve_jumps(grid: Grid) -> dict:
    """
    Cascades auto-eats until the board is quiescent or a forced-choice is required.
    Returns {'grid', 'pts', 'events'}.
    """
    current = clone_grid(grid)
    pts = 0
    events = []
    while True:
        options = get_forced_jump_options(current)
        if len(options) != 1:
            break
        resolved = _apply_jump_option(current, options[0], 'auto')
        current = resolved['grid']
        pts += resolved['pts']
        events.append(resolved['event'])
    return {'grid': current, 'pts': pts, 'events': events}


def _resolve_choice_branches(grid: Grid) -> list[dict]:
    choice = get_forced_choice(grid)
    if not choice:
        return [{'grid': grid, 'pts': 0, 'events': []}]

    outcomes = []
    for option in choice:
        chosen   = _apply_jump_option(grid, option, 'choose')
        after    = resolve_jumps(chosen['grid'])
        tails    = _resolve_choice_branches(after['grid'])
        for tail in tails:
            outcomes.append({
                'grid':   tail['grid'],
                'pts':    chosen['pts'] + after['pts'] + tail['pts'],
                'events': [chosen['event'], *after['events'], *tail['events']],
            })
    return outcomes


def execute_move(grid: Grid, sr: int, sc: int, tr: int, tc: int) -> Optional[dict]:
    """
    Validates and applies one player move, then resolves cascades.
    Returns {'grid', 'pts', 'events'} or None if illegal.
    """
    mover = grid[sr][sc]
    if not mover or mover == GRASS:
        return None
    if not is_one_step(sr, sc, tr, tc):
        return None

    target = grid[tr][tc]
    g = clone_grid(grid)
    pts = 0
    events = []

    if target is not None:
        if PREY_OF.get(mover) != target:
            return None
        earned = PREY_POINTS.get(target, 0)
        pts += earned
        events.append({
            'pred': mover, 'prey': target,
            'from': (sr, sc), 'to': (tr, tc),
            'pts': earned, 'kind': 'hunt',
        })
        g[tr][tc] = mover
        g[sr][sc] = None
    else:
        g[tr][tc] = mover
        g[sr][sc] = None

    auto = resolve_jumps(g)
    pts += auto['pts']
    events.extend(auto['events'])
    return {'grid': auto['grid'], 'pts': pts, 'events': events}


def has_any_move(grid: Grid) -> bool:
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            p = grid[r][c]
            if not p or p == GRASS:
                continue
            for dr, dc in DIRS8:
                nr, nc = r + dr, c + dc
                if not in_bounds(nr, nc):
                    continue
                t = grid[nr][nc]
                if t is None or PREY_OF.get(p) == t:
                    return True
    return False


# ── Solvability search ─────────────────────────────────────────────────────────

def can_reach_objective(
    grid: Grid,
    objective: dict,
    moves_left: int,
    score: int = 0,
) -> bool:
    """
    DFS with memoisation. Mirrors canReachObjective in engine.js.
    objective: {'type': 'score', 'target': int}
    """
    memo: set[str] = set()

    def dfs(g: Grid, s: int, m: int) -> bool:
        if objective['type'] == 'score' and s >= objective['target']:
            return True
        if m <= 0:
            return False
        if objective['type'] == 'score':
            if s + get_remaining_score_potential(g) < objective['target']:
                return False

        key = f"{serialize_grid(g)}|{m}|{s}"
        if key in memo:
            return False
        memo.add(key)

        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                piece = g[r][c]
                if not piece or piece == GRASS:
                    continue
                for tgt in get_legal_targets(g, r, c):
                    tr, tc = tgt
                    res = execute_move(g, r, c, tr, tc)
                    if not res:
                        continue
                    for branch in _resolve_choice_branches(res['grid']):
                        if dfs(branch['grid'], s + res['pts'] + branch['pts'], m - 1):
                            return True
        return False

    return dfs(grid, score, moves_left)
