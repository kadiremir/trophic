/**
 * One-line config: change ACTIVE_EFFECT to swap the in-game eat feedback.
 *
 * Options:
 *   'ScoreFlyout'    — original gold number on a bezier arc
 *   'ComicChomp'     — "CHOMP!" word-art + impact lines
 *   'ShockwaveRing'  — expanding concentric rings
 *   'ParticleBurst'  — physics scatter with gravity
 *   'ScoreVacuum'    — number sucked upward with ghost trails
 *   'SquashGulp'     — cartoony squash-stretch gulp
 *   'ComboStacker'   — left/right slide-in collision + badge
 *   'StrikeSlash'    — crossing sword-slash marks
 *   'ScreenFlash'    — white radial flash + score drops in
 *   'NumberSplatter' — each digit explodes out then snaps back
 *   'ConfettiBurst'  — colored confetti shower
 */
export const ACTIVE_EFFECT = 'ScoreFlyout';

import { ScoreFlyout }    from './ScoreFlyout';
import { ComicChomp }     from './ComicChomp';
import { ShockwaveRing }  from './ShockwaveRing';
import { ParticleBurst }  from './ParticleBurst';
import { ScoreVacuum }    from './ScoreVacuum';
import { SquashGulp }     from './SquashGulp';
import { ComboStacker }   from './ComboStacker';
import { StrikeSlash }    from './StrikeSlash';
import { ScreenFlash }    from './ScreenFlash';
import { NumberSplatter } from './NumberSplatter';
import { ConfettiBurst }  from './ConfettiBurst';

export const EFFECT_MAP = {
  ScoreFlyout,
  ComicChomp,
  ShockwaveRing,
  ParticleBurst,
  ScoreVacuum,
  SquashGulp,
  ComboStacker,
  StrikeSlash,
  ScreenFlash,
  NumberSplatter,
  ConfettiBurst,
};

export const EatEffect = EFFECT_MAP[ACTIVE_EFFECT] ?? ScoreFlyout;
