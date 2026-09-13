import CursorGrid from './reactbits/CursorGrid';

/**
 * Full-bleed backdrop for the landing page: warm cream background with a
 * dark CursorGrid lattice — squares light up only near the pointer.
 * NOTE: gridOpacity is intentionally 0 — that setting draws a permanent
 * straight-line grid across the whole screen at all times, which is NOT
 * what was asked for and is what caused the "component looks replaced by
 * straight lines" confusion last round. Only the hover-reactive squares
 * should ever be visible.
 */
export default function GridBackdrop() {
  return (
    <div className="grid-backdrop" aria-hidden="true">
      <CursorGrid
        cellSize={88}
        color="#2E2620"
        radius={170}
        falloff="smooth"
        holdTime={350}
        fadeDuration={900}
        lineWidth={1.8}
        maxOpacity={0.95}
        fillOpacity={0}
        gridOpacity={0}
        cellRadius={6}
        clickPulse
        pulseSpeed={550}
      />
    </div>
  );
}
