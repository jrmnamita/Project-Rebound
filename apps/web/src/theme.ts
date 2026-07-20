/**
 * ============================================================
 *  theme.ts — the visual identity, in exactly one place
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Names every color the interface uses. Components import these;
 *    nothing else in the app hard-codes a color.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §2.7: "art direction, character, world identity,
 *      tone, and naming start from zero" and belong to a dedicated
 *      identity pass (GDD §14 Q5). Until that pass, these are
 *      PLACEHOLDER values — cheerful, readable, deliberately
 *      unbranded. One file to swap when the identity arrives.
 *    - GDD §5.5 (lightness): "cheerful, readable, a little cheeky.
 *      Never grimdark, never solemn." Bright accents on a calm dark
 *      field; losing is comedy, so nothing here is alarming red-on-
 *      black doom.
 *    - CODING_STANDARDS §11: colors left gameplay code forever when
 *      the prototype was audited — sim-core has no idea what color
 *      anything is, and this file is where that separation lands.
 *
 *  WHAT IT MUST NEVER DO
 *    Hold layout, behavior, or gameplay values. Colors only.
 * ============================================================
 */

/** Phase names as the GDD spells them (§8.5) — display strings and
 *  the keys of PHASE_COLORS. The speed-curve module will own the
 *  canonical type when the Game Loop lands; the UI names match the
 *  GDD glossary today so no rename ripples later
 *  (CODING_STANDARDS §1: vocabulary comes from the GDD). */
export type PhaseName = 'Normal' | 'Faster' | 'Very Fast' | 'Extreme Survival';

export const THEME = {
  /** The app's field — calm, dark, lets the world glow. */
  background: '#101423',
  surface: 'rgba(255, 255, 255, 0.08)',
  surfaceBorder: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#f4f6ff',
  textDim: 'rgba(244, 246, 255, 0.55)',
  /** The action color: buttons, the player's own board row. */
  accent: '#38bdf8',
  accentDark: '#0284c7',
  /** Celebration (new best, wins) — delight, not solemnity (GDD §5.5). */
  celebrate: '#fbbf24',
  /** Danger readout (last life). Readable, not doom. */
  danger: '#fb7185',
  /** Lives dots. */
  lifeFull: '#4ade80',
  lifeEmpty: 'rgba(255, 255, 255, 0.15)',
} as const;

/** Phase accents escalate with the phases themselves — the shared
 *  dramatic act breaks (GDD §8.5) get hotter as the world does. */
export const PHASE_COLORS: Record<PhaseName, string> = {
  Normal: '#4ade80',
  Faster: '#facc15',
  'Very Fast': '#fb923c',
  'Extreme Survival': '#fb7185',
};
