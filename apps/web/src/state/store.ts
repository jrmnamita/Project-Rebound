/**
 * ============================================================
 *  store.ts — the UI state store: what the interface knows
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines the Zustand store holding everything the React chrome
 *    renders: which screen is up, the HUD snapshot, the live board
 *    rows, the phase banner, and the results. It also defines
 *    GameIntents — the tiny interface through which UI buttons ask
 *    the game to do things.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §3: React ⟂ Phaser ⟂ sim-core with Zustand —
 *      the UI never touches the simulation. The GameHost (Game Loop
 *      module, later) WRITES snapshots into this store; components
 *      READ them. Data flows one way: sim → host → store → React.
 *    - CODING_STANDARDS §7: "UI contains zero gameplay logic." Every
 *      field here is a REPORT of something the simulation already
 *      decided — the store cannot compute a score, kill a player, or
 *      end a match, because it holds no rules, only results.
 *
 *  HOW IT FITS
 *    Writers: the GameHost (snapshots each tick, events on death/
 *    phase-change/results). Readers: every component in src/ui.
 *    GameIntents is the reverse channel — implemented by the
 *    GameHost, injected into <App/> (consumer-defined seam, the same
 *    pattern as GroundQuery and ViewTarget).
 *
 *  WHAT IT MUST NEVER DO
 *    Import sim-core, compute gameplay values, or grow logic.
 *    A store method with an `if` about gameplay is a rule leak.
 * ============================================================
 */

import { create } from 'zustand';
import type { PhaseName } from '../theme.js';

/**
 * Purpose: What the always-visible HUD shows (GDD §9: score, phase,
 * lives at a glance).
 *
 * Why every field is a plain value: each is the simulation's already-
 * decided truth, formatted for display by components. lives is a
 * count out of 3 (GDD §8.3); spawnProtected drives the respawn
 * shimmer so protection is VISIBLE — an invisible mechanic would
 * make deaths illegible (GDD §5.2).
 */
export interface HudSnapshot {
  readonly score: number;
  readonly bestScore: number;
  readonly lives: number;
  readonly phaseName: PhaseName;
  readonly spawnProtected: boolean;
}

/**
 * Purpose: One row of the live match board (GDD §9: avatar, rank,
 * score, lives — permanently on screen, 4 rows max).
 *
 * Why it exists NOW, in solo Phase 1: multiplayer is the primary
 * mode (GDD §9) — building the board as a list from day one means
 * Phase 2 fills it with rivals instead of redesigning it. Solo shows
 * a row of one. Emoji avatars per ARCHITECTURE §2.5.
 */
export interface BoardRow {
  readonly id: string;
  readonly avatar: string;
  readonly name: string;
  readonly score: number;
  readonly lives: number;
  readonly eliminated: boolean;
  readonly isSelf: boolean;
}

/** Purpose: what the results screen reports — the match's verdict,
 *  already decided by the simulation (GDD §7: results & standings). */
export interface ResultsSnapshot {
  readonly score: number;
  readonly bestScore: number;
  readonly isNewBest: boolean;
  readonly phaseReached: PhaseName;
}

/**
 * Purpose: The UI's requests TO the game — the only direction UI is
 * allowed to speak.
 *
 * Why so small: GDD §7's rematch rule ("next match within two taps")
 * is enforced by this interface having a DIRECT rematch intent —
 * results screen → rematch is one tap, with no menu detour possible.
 * Implemented by the GameHost (Game Loop module); until then main.tsx
 * wires a placeholder.
 */
export interface GameIntents {
  startPractice(): void;
  rematch(): void;
  backToMenu(): void;
}

export type Screen = 'menu' | 'playing' | 'results';

interface UiState {
  readonly screen: Screen;
  readonly hud: HudSnapshot;
  readonly board: readonly BoardRow[];
  /** Set on phase change; the banner animates once and the NEXT
   *  change replaces it (keyed render — no timers in the store). */
  readonly phaseBanner: PhaseName | null;
  readonly results: ResultsSnapshot | null;

  // ── Writers (called by the GameHost; components never call these
  //    except navigation-on-intent, which the host also drives) ──
  showMenu(): void;
  showPlaying(): void;
  showResults(results: ResultsSnapshot): void;
  updateHud(hud: HudSnapshot): void;
  updateBoard(board: readonly BoardRow[]): void;
  announcePhase(phase: PhaseName): void;
}

/** A sensible pre-match HUD so components never juggle undefined. */
const IDLE_HUD: HudSnapshot = {
  score: 0,
  bestScore: 0,
  lives: 3,
  phaseName: 'Normal',
  spawnProtected: false,
};

/**
 * Purpose: THE store instance — one per app, shared by all
 * components via the useUiStore hook.
 *
 * Side effects: none beyond state updates; every writer is a plain
 * set(). No writer computes anything — see the file header's rule
 * about rule leaks.
 */
export const useUiStore = create<UiState>((set) => ({
  screen: 'menu',
  hud: IDLE_HUD,
  board: [],
  phaseBanner: null,
  results: null,

  showMenu: () => set({ screen: 'menu', results: null, phaseBanner: null }),
  showPlaying: () => set({ screen: 'playing', results: null, phaseBanner: null }),
  showResults: (results) => set({ screen: 'results', results }),
  updateHud: (hud) => set({ hud }),
  updateBoard: (board) => set({ board }),
  announcePhase: (phase) => set({ phaseBanner: phase }),
}));
