"""
level_config.py — all tunable generation constants in one place.

Edit this file to tweak difficulty, piece counts, quality thresholds, or
campaign structure without touching the generation/scoring logic.

Imported by generate_levels.py and difficulty.py.
"""

from engine import GRASS, RABBIT, FOX, WOLF, BEAR, DINO

# ── Food chains per tier ───────────────────────────────────────────────────────

TIER_CHAIN = [
    [GRASS, RABBIT, FOX],
    [GRASS, RABBIT, FOX, WOLF],
    [GRASS, RABBIT, FOX, WOLF, BEAR],
    [GRASS, RABBIT, FOX, WOLF, BEAR, DINO],
]

# ── Campaign structure ─────────────────────────────────────────────────────────

LEVELS_PER_TIER = 5

TIER_META = [
    {'label': 'Fox Forest',    'color': '#ff9824', 'chain': 'G->R->F',
     'levels': list(range(0 * LEVELS_PER_TIER, 1 * LEVELS_PER_TIER))},
    {'label': 'Wolf Ridge',    'color': '#8496f0', 'chain': 'G->R->F->W',
     'levels': list(range(1 * LEVELS_PER_TIER, 2 * LEVELS_PER_TIER))},
    {'label': 'Bear Mountain', 'color': '#cd8038', 'chain': 'G->R->F->W->B',
     'levels': list(range(2 * LEVELS_PER_TIER, 3 * LEVELS_PER_TIER))},
    {'label': 'Dino Peak',     'color': '#6ed3c8', 'chain': 'G->R->F->W->B->D',
     'levels': list(range(3 * LEVELS_PER_TIER, 4 * LEVELS_PER_TIER))},
]

# ── Difficulty targets ─────────────────────────────────────────────────────────
# Explicit 40→90 ramp across 20 levels.  Edit individual values to reshape the
# campaign curve; the generator will try to hit each target within the tier band.

TIER_DIFFICULTY_TARGETS = [
    [40, 45, 50, 55, 60],    # Fox Forest:    40–60
    [60, 63, 65, 68, 70],    # Wolf Ridge:    60–70
    [70, 73, 75, 78, 80],    # Bear Mountain: 70–80
    [80, 83, 85, 88, 90],    # Dino Peak:     80–90
]

DIFFICULTY_TARGETS = [t for tier in TIER_DIFFICULTY_TARGETS for t in tier]
TIER_DIFFICULTY_BANDS = [(tier[0], tier[-1]) for tier in TIER_DIFFICULTY_TARGETS]
TOTAL_LEVELS = len(DIFFICULTY_TARGETS)

# ── Minimum score targets per tier ────────────────────────────────────────────
# Prevents trivially low objectives.  Values represent the minimum meaningful
# chain completion score for each tier.

MIN_SCORE_BY_TIER = [4, 12, 32, 40]

# ── Quality thresholds per tier ────────────────────────────────────────────────
# (max_cascade_depth, min_agency_ratio, min_board_spread, min_first_move_branching)

QUALITY_THRESHOLDS = {
    0: (3,    0.30, 1.8, 1),   # Fox Forest
    1: (4,    0.25, 2.0, 2),   # Wolf Ridge
    2: (5,    0.20, 2.0, 2),   # Bear Mountain
    3: (999,  0.10, 1.5, 1),   # Dino Peak — long cascade is the intended spectacle
}

# ── Difficulty scoring constants ───────────────────────────────────────────────
# Used by difficulty.py.  Changing these alters measured difficulty for all levels.

MAX_SOLUTIONS     = 50       # cap for solution-count normalisation
MAX_SEARCH_STATES = 1_000_000
MAX_SLACK         = 5        # normaliser for abs_slack term
MAX_MIN_MOVES     = 6        # normaliser for planning-depth bonus

# ── Level names and hints ──────────────────────────────────────────────────────
# Names are reassigned after difficulty sorting (slot-based).
# Hints are NOT reassigned — they stay with the board they were generated for.
# Review hints manually after regeneration if the board order changed.

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
