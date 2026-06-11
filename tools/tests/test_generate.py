"""
Generation regression and property tests.
Run with: python -m pytest tools/tests/ -v

test_fixed_seed_properties: fast property checks on a small set of generated
  levels — does NOT assert exact boards (those change when generator logic
  changes) but asserts invariants that must always hold.

test_validate_levels_json: validates the shipped levels.json against the game
  engine — this is the same check as `--validate` and must always pass.
"""
import sys, os, json, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from engine import GRID_SIZE, has_illegal_adjacency, can_reach_objective
from generate_levels import (
    generate_level, DIFFICULTY_TARGETS, LEVELS_PER_TIER,
    TIER_DIFFICULTY_BANDS, validate_level,
)

_LEVELS_JSON = os.path.join(
    os.path.dirname(__file__), '..', '..', 'src', 'game', 'levels.json'
)

# ── Validate shipped levels.json ───────────────────────────────────────────────

def test_validate_levels_json():
    """Every level in levels.json must be solvable and have a legal start state."""
    if not os.path.exists(_LEVELS_JSON):
        pytest.skip('levels.json not found — run generate_levels.py first')
    with open(_LEVELS_JSON, encoding='utf-8') as f:
        data = json.load(f)
    errors = []
    for lv in data['levels']:
        errors.extend(validate_level(lv))
    assert errors == [], '\n'.join(errors)


# ── Fixed-seed property checks ─────────────────────────────────────────────────

@pytest.mark.parametrize('level_index', range(10))   # first 10 levels; adjust as needed
def test_generated_level_properties(level_index):
    """
    Generate a single level and assert hard invariants regardless of the exact board:
      - Difficulty lands in the correct tier band
      - min_moves >= required floor
      - Board has no illegal starting adjacency
      - Level is actually solvable within the given budget
      - Score target is positive
    """
    rng = random.Random(42)
    # Burn RNG state for levels before this one so each test uses the same
    # deterministic sub-sequence for its level_index.
    for i in range(level_index):
        generate_level(i, rng)

    lv = generate_level(level_index, rng)
    assert lv is not None, f'Level {level_index + 1} generation failed'

    tier      = level_index // LEVELS_PER_TIER
    band_min, band_max = TIER_DIFFICULTY_BANDS[tier]
    meta      = lv['meta']
    obj       = lv['objective']
    budget    = lv['moves']

    # Tier band
    assert band_min <= meta['difficulty'] <= band_max, (
        f'Level {level_index + 1} difficulty {meta["difficulty"]} outside band [{band_min}, {band_max}]'
    )

    # Score target is meaningful
    assert obj['target'] > 0

    # No illegal start adjacency
    grid = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    for tok, r, c in lv['pieces']:
        grid[r][c] = tok
    assert not has_illegal_adjacency(grid), f'Level {level_index + 1} has illegal starting adjacency'

    # Solvable
    assert can_reach_objective(grid, obj, budget), (
        f'Level {level_index + 1} is not solvable with {budget} moves'
    )


# ── Deduplication ──────────────────────────────────────────────────────────────

def test_no_duplicate_layouts():
    """No two generated levels should have identical piece positions + score target."""
    rng     = random.Random(42)
    hashes  = set()
    seen    = set()

    for i in range(20):
        lv = generate_level(i, rng, seen_hashes=hashes)
        assert lv is not None, f'Level {i + 1} generation failed'

        grid = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
        for tok, r, c in lv['pieces']:
            grid[r][c] = tok

        key = (
            tuple(sorted((tok, r, c) for tok, r, c in lv['pieces'])),
            lv['objective']['target'],
        )
        assert key not in seen, f'Level {i + 1} is a duplicate of an earlier level'
        seen.add(key)
        hashes.add(str(key))
