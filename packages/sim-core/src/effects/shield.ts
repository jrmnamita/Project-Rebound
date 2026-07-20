/**
 * ============================================================
 *  shield.ts — the Shield: one free "no"
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Grants the shield status. The shield's actual power — eating
 *    the next offensive effect entirely — lives in resolve.ts's
 *    resolution order, because counterplay is an ORDERING rule, not
 *    a status rule: the shield must be consulted BEFORE any
 *    offensive module runs.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §11.3: "Absorbs the next negative effect entirely; visible
 *    bubble so attackers know. Counterplay [against the shield]:
 *    bait it out with a cheap effect first." The visibility clause
 *    is presentation's duty (the renderer draws the bubble from
 *    shieldActive — no hidden state, Vision: Honesty: attackers
 *    must be able to SEE the shield to bait it). No duration: a
 *    shield waits as long as it takes — its cost is that it eats
 *    exactly one effect, cheap or dear.
 * ============================================================
 */

import type { MatchPlayer } from '../match.js';

/**
 * Purpose: Raise the shield on its holder.
 * Inputs: mp — the collector. Outputs: the shielded player (a
 * second shield while one is up is simply still one shield — no
 * stacking; there is nothing to stack, GDD §11.3 names one charge).
 * Side effects: none — pure.
 */
export function applyShield(mp: MatchPlayer): MatchPlayer {
  if (mp.effects.shieldActive) return mp;
  return { ...mp, effects: { ...mp.effects, shieldActive: true } };
}
