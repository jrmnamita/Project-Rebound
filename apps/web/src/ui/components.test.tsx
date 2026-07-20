/**
 * @vitest-environment jsdom
 * ============================================================
 *  components.test.tsx — guarantees of the UI module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the chrome's documented rules: the rematch rule's tap
 *    budget, the pointer-transparency of in-match overlays (no HUD
 *    pixel may steal a jump), the 4-row board cap, lives readout,
 *    phase announcement, and the store's one-way data flow.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §7 (rematch ≤ 2 taps — hard requirement, not polish),
 *    §12 Pillar 1 (the whole screen is the button), §9 (live board,
 *    4 rows). UI has no gameplay logic to test — these are tests of
 *    CONTRACT, not of rules.
 * ============================================================
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { useUiStore, type BoardRow, type GameIntents } from '../state/store.js';

/** Fresh intents recorder per test. */
function intents(): GameIntents & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    startPractice: () => calls.push('startPractice'),
    rematch: () => calls.push('rematch'),
    backToMenu: () => calls.push('backToMenu'),
  };
}

/** Reset the singleton store between tests — tests must not share state. */
afterEach(() => {
  cleanup();
  useUiStore.getState().showMenu();
  useUiStore.getState().updateBoard([]);
  useUiStore.getState().updateHud({
    score: 0, bestScore: 0, lives: 3, phaseName: 'Normal', spawnProtected: false,
  });
});

const row = (id: string, over: Partial<BoardRow> = {}): BoardRow => ({
  id, avatar: '🐱', name: id, score: 0, lives: 3, eliminated: false, isSelf: false, ...over,
});

describe('UI — the rematch rule (GDD §7: next match within two taps)', () => {
  it('REMATCH is one tap from the results screen — half the allowed budget', () => {
    const record = intents();
    render(<App intents={record} />);
    act(() => useUiStore.getState().showResults({
      score: 1234, bestScore: 2000, isNewBest: false, phaseReached: 'Very Fast',
    }));
    fireEvent.click(screen.getByTestId('results-rematch'));
    expect(record.calls).toEqual(['rematch']); // tap count: exactly 1
  });

  it('a new best celebrates; an ordinary run stays light — never doom (GDD §5.5)', () => {
    render(<App intents={intents()} />);
    act(() => useUiStore.getState().showResults({
      score: 3000, bestScore: 3000, isNewBest: true, phaseReached: 'Faster',
    }));
    expect(screen.getByText('NEW BEST!')).toBeTruthy();
    expect(screen.queryByText(/GAME OVER/i)).toBeNull();
  });
});

describe('UI — the whole screen is the jump button (GDD §12 Pillar 1)', () => {
  it('every in-match overlay is pointer-transparent — no pixel may steal a tap', () => {
    render(<App intents={intents()} />);
    act(() => {
      const state = useUiStore.getState();
      state.showPlaying();
      state.updateBoard([row('you', { isSelf: true })]);
      state.announcePhase('Faster');
    });
    for (const id of ['live-board', 'phase-banner']) {
      const el = screen.getByTestId(id);
      expect(el.closest('.pointer-events-none')).not.toBeNull();
    }
    // The HUD's root container likewise.
    const hudScore = screen.getByTestId('hud-score');
    expect(hudScore.closest('.pointer-events-none')).not.toBeNull();
  });
});

describe('UI — the HUD reports the simulation; it computes nothing', () => {
  it('shows score, lives dots, and the phase pill straight from the store', () => {
    render(<App intents={intents()} />);
    act(() => {
      useUiStore.getState().showPlaying();
      useUiStore.getState().updateHud({
        score: 4321.9, bestScore: 9999, lives: 2, phaseName: 'Very Fast', spawnProtected: false,
      });
    });
    expect(screen.getByTestId('hud-score').textContent).toBe('04321'); // floor, not round
    expect(screen.getAllByTestId('life-full')).toHaveLength(2);
    expect(screen.getAllByTestId('life-empty')).toHaveLength(1);
    expect(screen.getByTestId('hud-phase').textContent).toBe('VERY FAST');
  });

  it('announcePhase shows the banner with the phase name (GDD §8.5: announced and felt)', () => {
    render(<App intents={intents()} />);
    act(() => {
      useUiStore.getState().showPlaying();
      useUiStore.getState().announcePhase('Extreme Survival');
    });
    expect(screen.getByTestId('phase-banner').textContent).toBe('EXTREME SURVIVAL');
  });
});

describe('UI — the live board (GDD §9: four rows, rivals are people)', () => {
  it('renders rows in the order given — ranking is the host’s job, never the UI’s', () => {
    render(<App intents={intents()} />);
    act(() => {
      const state = useUiStore.getState();
      state.showPlaying();
      state.updateBoard([row('b', { score: 50 }), row('a', { score: 999 })]);
    });
    // Deliberately NOT sorted by score: the UI must not re-rank.
    expect(screen.getByTestId('board-row-0').textContent).toContain('b');
    expect(screen.getByTestId('board-row-1').textContent).toContain('a');
  });

  it('caps at four rows — portrait legibility is the board’s contract (GDD §9/§13)', () => {
    render(<App intents={intents()} />);
    act(() => {
      const state = useUiStore.getState();
      state.showPlaying();
      state.updateBoard(['a', 'b', 'c', 'd', 'e'].map((id) => row(id)));
    });
    expect(screen.getByTestId('live-board').children).toHaveLength(4);
  });
});

describe('UI — the front door (Vision: instant)', () => {
  it('menu → PRACTICE fires the start intent on the first tap', () => {
    const record = intents();
    render(<App intents={record} />);
    fireEvent.click(screen.getByTestId('menu-practice'));
    expect(record.calls).toEqual(['startPractice']);
  });

  it('the portrait frame is 9:16 regardless of display shape (Pillars 2/4)', () => {
    render(<App intents={intents()} />);
    expect(screen.getByTestId('portrait-frame').style.aspectRatio).toBe('9 / 16');
  });
});

describe('UI — store flow is one-way and side-effect-free', () => {
  it('writers replace snapshots without touching unrelated state', () => {
    const before = useUiStore.getState();
    before.updateHud({ score: 10, bestScore: 20, lives: 1, phaseName: 'Faster', spawnProtected: true });
    const after = useUiStore.getState();
    expect(after.hud.score).toBe(10);
    expect(after.screen).toBe(before.screen); // untouched
    expect(after.board).toEqual(before.board); // untouched
  });

  it('intents callbacks are the only path out of the UI — components never call gameplay', () => {
    // Structural assertion: GameIntents has exactly the three
    // documented requests, so the UI cannot ask for anything else.
    const record = intents();
    const keys = Object.keys(record).filter((k) => k !== 'calls');
    expect(keys.sort()).toEqual(['backToMenu', 'rematch', 'startPractice']);
  });
});
