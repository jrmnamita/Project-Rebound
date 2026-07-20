/**
 * ============================================================
 *  App.tsx — the portrait frame and the screen switch
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Renders the letterboxed 9:16 portrait frame, the (future) game
 *    canvas mount point, and whichever chrome the current screen
 *    needs: Menu, or the in-match overlays (Hud, LiveBoard,
 *    PhaseBanner), or Results.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §12 Pillars 2/4: portrait is constitutional. The frame
 *      enforces 9:16 (matching CAMERA.DESIGN_WIDTH/HEIGHT in
 *      game/camera.ts) and letterboxes on wide displays — the world
 *      is NEVER wider for anyone (§6.3: identical framing; a wider
 *      desktop window must not show more terrain).
 *    - ARCHITECTURE §3: React owns chrome; Phaser owns the world;
 *      the GameHost bridges. The #game-mount div is Phaser's future
 *      home (Game Loop module) — React renders AROUND it and never
 *      into it.
 *
 *  WHAT IT MUST NEVER DO
 *    Hold gameplay state, or grow screen logic beyond "which chrome
 *    is visible" — that is all the App is for.
 * ============================================================
 */
import { Hud } from './ui/Hud.js';
import { LiveBoard } from './ui/LiveBoard.js';
import { Menu } from './ui/Menu.js';
import { PhaseBanner } from './ui/PhaseBanner.js';
import { Results } from './ui/Results.js';
import { useUiStore } from './state/store.js';
import { THEME } from './theme.js';
import type { GameIntents } from './state/store.js';

export function App({ intents }: { intents: GameIntents }): JSX.Element {
  const screen = useUiStore((s) => s.screen);
  return (
    // The letterbox: fills the display, centers the portrait frame.
    <div className="flex h-full w-full items-center justify-center" style={{ background: '#000' }}>
      {/* The frame: 9:16, mirroring the camera's design viewport —
          one aspect ratio, agreed between chrome and world. */}
      <div
        className="relative h-full max-h-full overflow-hidden"
        style={{ aspectRatio: '9 / 16', background: THEME.background }}
        data-testid="portrait-frame"
      >
        {/* Phaser's future mount (Game Loop module). Kept in the tree
            on every screen so match start never waits for a mount. */}
        <div id="game-mount" className="absolute inset-0" />

        {screen === 'menu' && <Menu intents={intents} />}
        {screen === 'playing' && (
          <>
            <Hud />
            <LiveBoard />
            <PhaseBanner />
          </>
        )}
        {screen === 'results' && <Results intents={intents} />}
      </div>
    </div>
  );
}
