# Trophic Level Generation Tooling

Scripts in `tools/` for generating, validating, and scoring Trophic levels.

---

## Files

| File | Purpose |
|---|---|
| `engine.py` | Python port of `src/game/engine.js` — pure game logic |
| `difficulty.py` | Difficulty scoring: `find_min_moves`, `count_solutions`, `score_difficulty` |
| `generate_levels.py` | Procedural level generator + CLI + optional JS output |
| `levels_generated.json` | Output from the last `--seed 42` run (20 levels, difficulty 0→100) |

---

## Quick start

```bash
# Generate 20 levels and print JSON to stdout
python3 tools/generate_levels.py --count 20 --seed 42

# Write to JSON
python3 tools/generate_levels.py --count 20 --seed 42 --out tools/levels_generated.json

# Write a drop-in JS replacement for src/game/levels.js
python3 tools/generate_levels.py --count 20 --seed 42 --out src/game/levels_generated.js

# Validate the existing hand-authored levels.js
python3 tools/generate_levels.py --validate
```

---

## Difficulty formula

```
slack_ratio     = (budget - min_moves) / budget        # 0=hardest, 1=easiest
solution_count  = distinct winning paths (capped at 50)
ambiguity_count = forced-choice points on the first winning path

difficulty = 100
           - 50 * slack_ratio
           - 30 * log(solution_count + 1) / log(51)
           - 20 * (ambiguity_count == 0)
```

**Range:** 0 (trivial) to 100 (maximum difficulty).

### Signal breakdown

| Term | Max reduction | Meaning |
|---|---|---|
| `50 * slack_ratio` | 50 | Move budget generous relative to minimum → easy |
| `30 * log(sol+1)/log(51)` | 30 | Many winning paths → easy (less planning required) |
| `20 * (ambig==0)` | 20 | No forced choices → easy (no branching decisions) |

### Design implications

- A level is **hardest** (difficulty ≈ 100) when: `budget == min_moves`, exactly 1 solution, ≥1 forced-choice point.
- A level is **easiest** (difficulty ≈ 0) when: very generous budget, ≥50 solutions, no forced choices.
- The formula caps at 50 for `sol_count`-based reduction because the counting DFS is capped at 50 paths for performance. Boards with more than 50 paths are treated as "many solutions" and score maximum reduction from that term.

---

## Generation strategy

For each of 20 difficulty targets (linearly spaced 0 → 100):

1. **Tier selection:** `tier = min(4, target // 20)`. Tier 0 = G–R chain, tier 4 = full G–R–F–W–B–D.
2. **Piece placement:** Place 1–2 complete chains of the tier's food chain on a 6×6 grid. Retry until `has_illegal_adjacency` is false (no predator adjacent to its prey at start).
3. **Score objective:** Set target = 50–70% of the achievable score (sum of `PREY_POINTS` for entities whose predator is also on the board).
4. **Budget tuning:** BFS finds `min_moves`. Then scan `budget = min_moves` to `min_moves + 12` and pick the budget whose measured difficulty is closest to the target.
5. **Min-moves floor:** Reject the layout if `min_moves < floor(target_difficulty)`. The floor prevents hard levels from being solved by one player move that cascades automatically into a win (see table below).
6. **Acceptance:** Accept if `|measured_difficulty - target| ≤ 15`. Otherwise retry with a fresh random layout (up to 120 outer attempts).

### Min-moves floor by difficulty band

| Difficulty | Required min player moves |
|---|---|
| 0 – 20  | 1 |
| 21 – 60 | 2 |
| 61 – 100 | 3 |

Two additional caps apply:
- The difficulty floor is capped at **3** overall because `find_min_moves` (BFS, 200 000-state cap) cannot reliably prove `min_moves ≥ 4` for tier 2+ boards within that budget. Raising `MAX_SEARCH_STATES` in `difficulty.py` enables a floor of 4, at the cost of slower generation.
- **Tier-4 (dino)** levels use a single 6-token chain. A single player move can ignite the whole G→R→F→W→B→D sequence, and placing all 6 pieces ≥ 3 steps apart is too rare under random placement. The tier-4 floor is therefore capped at **2** regardless of difficulty band.

A "player move" is a single drag-and-drop action. Forced auto-eats and cascades that follow do not count. This ensures the player must make multiple deliberate decisions on harder levels rather than finding one lucky position and watching the board clear itself.

### Piece count constraint

Each tier-T level uses 1–2 chains of `len(TIER_CHAIN[T])` tokens. This caps total pieces at:

| Tier | Chain length | Max pieces (2 chains) |
|---|---|---|
| 0 | 2 (G,R) | 4+extras |
| 1 | 3 (G,R,F) | 6 |
| 2 | 4 (G,R,F,W) | 8 |
| 3 | 5 (G,R,F,W,B) | 10 |
| 4 | 6 (G,R,F,W,B,D) | 12 |

Larger counts make BFS (`find_min_moves`) intractably slow (exponential in depth × branching factor). If you need denser boards, raise `MAX_SEARCH_STATES` in `difficulty.py` and expect proportionally longer generation times.

---

## Solvability validation

`find_min_moves` uses **breadth-first search** over `(grid_state, score)` states to find the minimum player moves needed. It returns `None` if the objective is provably unreachable or if `MAX_SEARCH_STATES` (default 200 000) is exhausted.

`can_reach_objective` (mirroring the JS function) is used for final validation before a level is accepted.

`count_solutions` uses **DFS** (no memo, node cap 30 000) to count distinct winning paths and count forced-choice points on the first winning path found. The node cap means solution counts may be approximate for complex boards, but the direction (few vs. many) is always correct.

---

## Sync checklist — keep engine.py up to date

`engine.py` is a manual port of `src/game/engine.js`. **Every time engine.js changes**, verify or update:

| engine.js change | What to update in engine.py |
|---|---|
| New entity added (new tier token) | Add to `PREY_OF`, `PREY_POINTS`, `JUMP_PRIORITY`; update `TIER_CHAIN` in `generate_levels.py` |
| Food chain link changed | Update `PREY_OF` |
| Forced-choice resolution rule changed | Update `get_forced_jump_options`, `get_forced_choice` |
| Auto-eat cascade rule changed | Update `resolve_jumps` |
| Movement range changed (currently Chebyshev 1) | Update `is_one_step`, `DIRS8` |
| Grid size changed | Update `GRID_SIZE` |
| Scoring changed | Update `PREY_POINTS`, `get_remaining_score_potential` |

After updating `engine.py`, re-run `python3 tools/generate_levels.py --validate` to confirm existing shipped levels still pass, then regenerate levels that fall below the new difficulty targets.

---

## Re-generating levels

```bash
# Default run (seed 42, 20 levels)
python3 tools/generate_levels.py --count 20 --seed 42 --out tools/levels_generated.json

# Different seed for variety
python3 tools/generate_levels.py --count 20 --seed 7 --out tools/levels_seed7.json

# Export as JS (drop-in replacement, inspect before shipping)
python3 tools/generate_levels.py --count 20 --seed 42 --out src/game/levels_generated.js
```

The generated JS file is **auto-generated** — do not hand-edit it. If a level needs manual tweaks, edit `src/game/levels.js` directly and add it to the hand-authored set.

---

## Known limitations

- Difficulty accuracy: measured difficulty may deviate ±15 from the target. The formula is a heuristic; human play-testing is still needed to calibrate perceived difficulty.
- `count_solutions` is bounded by the 30 000-node cap. Very complex boards may undercount paths; the `solution_count` field in `meta` should be read as "at least N" rather than exact.
- The generator does not currently produce `combo` or `clear` objective types — only `score`.
- Wildfire (`🔥/X`) entity is not modelled in the Python engine. If wildfire is added to the JS engine, update `engine.py` accordingly.
