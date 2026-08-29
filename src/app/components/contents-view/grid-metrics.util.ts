/**
 * Pure geometry helper for the `resizable` `contents-view` layout. The component measures where
 * its content items actually sit (via `getBoundingClientRect`) and hands the per-axis spans here
 * to recover the grid the consumer's `contentsContainerClass` rendered — how many tracks (rows /
 * columns) there are and where the draggable gutter belongs between each adjacent pair. Kept
 * layout-agnostic and side-effect-free so it unit-tests like `redistributePx` (jsdom has no
 * layout, so the live measure path can't be integration-tested).
 */

/** One measured grid track (a row or a column). */
export interface GridTrack {
  /** leading-edge offset from the container's padding-box origin, px */
  start: number;
  /** trailing-edge offset from the same origin, px */
  end: number;
  /** `end - start` */
  size: number;
}

export interface GridAxis {
  tracks: GridTrack[];
  /** midpoint of the gap between each pair of consecutive tracks — `tracks.length - 1` entries,
   *  i.e. one per interior boundary a gutter can sit on */
  boundaries: number[];
}

/** px slack within which two item edges count as landing on the same grid line */
export const EDGE_TOLERANCE_PX = 2;

/**
 * Groups item spans (one axis of each item's rect, as `{ start, end }` offsets from a shared
 * origin) into the tracks they occupy, plus the midpoint between each adjacent pair. Items whose
 * leading edges fall within `tolerance` px share a track; a track spans the union of its items'
 * extents (so a row as tall as its tallest cell, a column as wide as its widest).
 */
export function clusterEdges(
  spans: readonly { start: number; end: number }[],
  tolerance = EDGE_TOLERANCE_PX,
): GridAxis {
  if (!spans.length) return { tracks: [], boundaries: [] };

  const tracks: GridTrack[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const last = tracks[tracks.length - 1];
    if (last && span.start <= last.start + tolerance) {
      last.end = Math.max(last.end, span.end);
      last.size = last.end - last.start;
    } else {
      tracks.push({ start: span.start, end: span.end, size: span.end - span.start });
    }
  }

  const boundaries = tracks.slice(1).map((track, i) => (tracks[i].end + track.start) / 2);
  return { tracks, boundaries };
}
