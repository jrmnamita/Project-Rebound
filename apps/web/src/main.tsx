/**
 * ============================================================
 *  main.tsx — the web client's entry point
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Mounts <App/> and constructs the real GameHost (Game Loop
 *    module) once the game-mount element exists, delegating the
 *    UI's GameIntents to it. Entry points stay boring — everything
 *    interesting lives in the modules this file wires together.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §3: the GameHost is the only bridge between UI
 *    and simulation; this is where the bridge is built and injected.
 * ============================================================
 */
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { GameHost } from './game/host.js';
import type { GameIntents } from './state/store.js';
import './index.css';

/**
 * The host needs the #game-mount div, which exists only after the
 * first render — so intents delegate lazily: the host is created on
 * the first intent (always a user tap, comfortably post-render).
 */
let host: GameHost | null = null;
function ensureHost(): GameHost {
  if (host === null) {
    const mount = document.getElementById('game-mount');
    if (mount === null) {
      // Honest failure (CODING_STANDARDS §10): a missing mount is a
      // broken build, not a recoverable hiccup.
      throw new Error('main.tsx: #game-mount missing — App must render it');
    }
    host = new GameHost(mount);
  }
  return host;
}

const intents: GameIntents = {
  startPractice: () => ensureHost().startPractice(),
  rematch: () => ensureHost().rematch(),
  backToMenu: () => ensureHost().backToMenu(),
};

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('main.tsx: #root element missing from index.html');
}
createRoot(rootElement).render(<App intents={intents} />);
