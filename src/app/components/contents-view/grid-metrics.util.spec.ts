import { clusterEdges, trackIndex } from './grid-metrics.util';

describe('clusterEdges', () => {
  it('is empty for no spans', () => {
    expect(clusterEdges([])).toEqual({ tracks: [], boundaries: [] });
  });

  it('returns one track and no boundaries for a single column/row', () => {
    const axis = clusterEdges([
      { start: 0, end: 300 },
      { start: 0, end: 300 },
    ]);
    expect(axis.tracks).toEqual([{ start: 0, end: 300, size: 300 }]);
    expect(axis.boundaries).toEqual([]);
  });

  it('splits two tracks and puts the boundary in the middle of the gap', () => {
    const axis = clusterEdges([
      { start: 0, end: 300 },
      { start: 316, end: 616 },
    ]);
    expect(axis.tracks.map((t) => t.size)).toEqual([300, 300]);
    expect(axis.boundaries).toEqual([308]); // midpoint of the 300–316 gap
  });

  it('groups near-equal starts within tolerance into one track (sub-pixel grid line)', () => {
    const axis = clusterEdges([
      { start: 0, end: 300 },
      { start: 1.4, end: 302 },
      { start: 320, end: 600 },
    ]);
    expect(axis.tracks.length).toBe(2);
    expect(axis.tracks[0]).toEqual({ start: 0, end: 302, size: 302 });
  });

  it('handles three tracks with a boundary between each pair', () => {
    const axis = clusterEdges([
      { start: 0, end: 100 },
      { start: 120, end: 220 },
      { start: 240, end: 340 },
    ]);
    expect(axis.tracks.length).toBe(3);
    expect(axis.boundaries).toEqual([110, 230]);
  });

  it('unions spans of differing extent within a track (a row as tall as its tallest cell)', () => {
    const axis = clusterEdges([
      { start: 0, end: 200 },
      { start: 0, end: 240 }, // taller sibling in the same row
      { start: 260, end: 460 },
    ]);
    expect(axis.tracks.length).toBe(2);
    expect(axis.tracks[0].end).toBe(240);
    expect(axis.boundaries).toEqual([250]);
  });

  it('is order-independent', () => {
    const a = clusterEdges([
      { start: 240, end: 340 },
      { start: 0, end: 100 },
      { start: 120, end: 220 },
    ]);
    expect(a.tracks.map((t) => t.start)).toEqual([0, 120, 240]);
  });
});

describe('trackIndex', () => {
  const axis = clusterEdges([
    { start: 0, end: 100 },
    { start: 120, end: 220 },
    { start: 240, end: 340 },
  ]);

  it("finds the track an item's leading edge belongs to", () => {
    expect(trackIndex(axis, 0)).toBe(0);
    expect(trackIndex(axis, 120)).toBe(1);
    expect(trackIndex(axis, 241.3)).toBe(2); // sub-pixel off its grid line
  });

  it('is -1 for an axis with no tracks', () => {
    expect(trackIndex(clusterEdges([]), 0)).toBe(-1);
  });
});
