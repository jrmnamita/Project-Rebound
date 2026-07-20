/**
 * ============================================================
 *  LiveBoard.tsx — the always-visible match leaderboard
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Renders up to four compact rows — avatar, rank, score, lives —
 *    pinned to the frame's edge, updating whenever the store's board
 *    changes.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §9: "The live match leaderboard is permanently on screen:
 *    four rows — avatar, rank, score, lives... Watching yourself
 *    overtake second place while jumping for your life is a core
 *    thrill." Built list-shaped in solo Phase 1 (a row of one) so
 *    Phase 2 fills it with rivals instead of redesigning it —
 *    multiplayer-first structure (GDD §9). The 4-player cap is what
 *    keeps it readable in portrait (GDD §13: any future room-size
 *    experiment must keep this legible).
 *
 *  WHAT IT MUST NEVER DO
 *    Compute ranks. Rows arrive ordered from the host — ranking is a
 *    match rule, and rules do not live in the UI
 *    (CODING_STANDARDS §7).
 * ============================================================
 */
import { useUiStore } from '../state/store.js';
import { THEME } from '../theme.js';

export function LiveBoard(): JSX.Element | null {
  const board = useUiStore((s) => s.board);
  if (board.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute left-3 top-28 z-10 flex flex-col gap-1"
      data-testid="live-board"
    >
      {board.slice(0, 4).map((row, index) => (
        <div
          key={row.id}
          className="flex items-center gap-2 rounded-xl border px-2 py-1 text-xs backdrop-blur-sm"
          style={{
            background: THEME.surface,
            borderColor: row.isSelf ? THEME.accent : THEME.surfaceBorder,
            opacity: row.eliminated ? 0.45 : 1,
          }}
          data-testid={`board-row-${index}`}
        >
          <span className="font-black tabular-nums" style={{ color: THEME.textDim }}>
            {index + 1}
          </span>
          <span aria-hidden>{row.avatar}</span>
          <span className="max-w-16 truncate font-bold" style={{ color: THEME.textPrimary }}>
            {row.name}
          </span>
          <span className="ml-auto font-black tabular-nums" style={{ color: THEME.textPrimary }}>
            {Math.floor(row.score)}
          </span>
          <span className="tabular-nums" style={{ color: THEME.textDim }}>
            {row.eliminated ? '✕' : '♥'.repeat(row.lives)}
          </span>
        </div>
      ))}
    </div>
  );
}
