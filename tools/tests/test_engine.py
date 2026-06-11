"""
Unit tests for engine.py — verifies core game rules that level generation relies on.
Run with: python -m pytest tools/tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from engine import (
    GRASS, RABBIT, FOX, WOLF, BEAR,
    GRID_SIZE, clone_grid,
    execute_move, resolve_jumps, get_forced_choice,
    get_legal_targets, has_illegal_adjacency,
    can_reach_objective, get_remaining_score_potential,
)


def make_grid(*placements):
    """Build a 6×6 grid from (token, r, c) tuples."""
    g = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    for token, r, c in placements:
        g[r][c] = token
    return g


# ── has_illegal_adjacency ──────────────────────────────────────────────────────

def test_no_illegal_adjacency_empty():
    assert not has_illegal_adjacency([[None] * GRID_SIZE for _ in range(GRID_SIZE)])

def test_illegal_adjacency_fox_next_to_rabbit():
    g = make_grid((FOX, 0, 0), (RABBIT, 0, 1))
    assert has_illegal_adjacency(g)

def test_legal_adjacency_fox_far_from_rabbit():
    g = make_grid((FOX, 0, 0), (RABBIT, 0, 2))
    assert not has_illegal_adjacency(g)

def test_illegal_adjacency_diagonal():
    g = make_grid((FOX, 0, 0), (RABBIT, 1, 1))
    assert has_illegal_adjacency(g)


# ── get_legal_targets ──────────────────────────────────────────────────────────

def test_grass_has_no_legal_targets():
    g = make_grid((GRASS, 3, 3))
    assert get_legal_targets(g, 3, 3) == set()

def test_fox_can_move_to_empty_neighbors():
    g = make_grid((FOX, 3, 3))
    targets = get_legal_targets(g, 3, 3)
    # All 8 neighbors of (3,3) are empty and in-bounds
    assert len(targets) == 8

def test_fox_can_eat_adjacent_rabbit():
    g = make_grid((FOX, 3, 3), (RABBIT, 3, 4))
    targets = get_legal_targets(g, 3, 3)
    assert (3, 4) in targets

def test_fox_cannot_eat_grass():
    g = make_grid((FOX, 3, 3), (GRASS, 3, 4))
    targets = get_legal_targets(g, 3, 3)
    assert (3, 4) not in targets


# ── execute_move ───────────────────────────────────────────────────────────────

def test_execute_move_illegal_returns_none():
    g = make_grid((FOX, 0, 0))
    assert execute_move(g, 0, 0, 0, 2) is None   # two steps away

def test_execute_move_simple_step():
    g = make_grid((FOX, 3, 3))
    result = execute_move(g, 3, 3, 3, 4)
    assert result is not None
    assert result['grid'][3][4] == FOX
    assert result['grid'][3][3] is None
    assert result['pts'] == 0

def test_execute_move_fox_eats_rabbit():
    g = make_grid((FOX, 3, 3), (RABBIT, 3, 4))
    result = execute_move(g, 3, 3, 3, 4)
    assert result is not None
    assert result['grid'][3][4] == FOX
    assert result['pts'] == 3   # PREY_POINTS[RABBIT]

def test_execute_move_cannot_eat_non_prey():
    g = make_grid((FOX, 3, 3), (WOLF, 3, 4))
    assert execute_move(g, 3, 3, 3, 4) is None


# ── resolve_jumps (cascade) ────────────────────────────────────────────────────

def test_resolve_jumps_no_auto_eat():
    # Fox and rabbit not adjacent — nothing fires
    g = make_grid((FOX, 0, 0), (RABBIT, 5, 5))
    result = resolve_jumps(g)
    assert result['pts'] == 0
    assert result['events'] == []

def test_resolve_jumps_single_auto_eat():
    # Fox at (1,1), rabbit at (1,2): fox eats rabbit automatically
    g = make_grid((FOX, 1, 1), (RABBIT, 1, 2))
    result = resolve_jumps(g)
    assert result['pts'] == 3
    assert len(result['events']) == 1
    assert result['grid'][1][2] == FOX
    assert result['grid'][1][1] is None

def test_resolve_jumps_stops_on_ambiguity():
    # Fox between two rabbits — resolveJumps must NOT auto-eat (ambiguous)
    g = make_grid((RABBIT, 1, 1), (FOX, 1, 2), (RABBIT, 1, 3))
    result = resolve_jumps(g)
    assert result['pts'] == 0
    assert result['events'] == []   # stopped, didn't auto-eat


# ── get_forced_choice ──────────────────────────────────────────────────────────

def test_forced_choice_none_when_unambiguous():
    g = make_grid((FOX, 1, 1), (RABBIT, 1, 2))
    assert get_forced_choice(g) is None

def test_forced_choice_returned_when_ambiguous():
    g = make_grid((RABBIT, 1, 1), (FOX, 1, 2), (RABBIT, 1, 3))
    choice = get_forced_choice(g)
    assert choice is not None
    assert len(choice) == 2


# ── can_reach_objective ────────────────────────────────────────────────────────

def test_can_reach_trivial_score():
    # Fox can eat rabbit in 1 move to score 3 pts
    g = make_grid((FOX, 0, 0), (RABBIT, 0, 2))
    obj = {'type': 'score', 'target': 3}
    assert can_reach_objective(g, obj, 2)

def test_cannot_reach_impossible_score():
    g = make_grid((FOX, 0, 0), (RABBIT, 0, 2))
    obj = {'type': 'score', 'target': 100}
    assert not can_reach_objective(g, obj, 10)

def test_cannot_reach_within_budget():
    # Rabbit and fox too far apart for budget=1
    g = make_grid((FOX, 0, 0), (RABBIT, 5, 5))
    obj = {'type': 'score', 'target': 3}
    assert not can_reach_objective(g, obj, 1)


# ── get_remaining_score_potential ──────────────────────────────────────────────

def test_score_potential_ignores_lone_prey():
    # Rabbit with no fox on board — can't be scored
    g = make_grid((RABBIT, 3, 3))
    assert get_remaining_score_potential(g) == 0

def test_score_potential_counts_when_predator_present():
    g = make_grid((FOX, 0, 0), (RABBIT, 5, 5))
    assert get_remaining_score_potential(g) == 3   # PREY_POINTS[RABBIT]
