import type { Annotation } from "./types";
/** Point cues last until the next cue; explicit segment ends are exclusive. */
export function activeVideoAnnotations(
  notes: Annotation[],
  seconds: number | null,
): string[] {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return [];
  const timed = notes
    .filter((n) => n.videoSeconds !== undefined)
    .sort((a, b) => a.videoSeconds! - b.videoSeconds!);
  const ends = new Map<number, number>();
  let next = Infinity;
  for (let i = timed.length - 1; i >= 0; i--) {
    const start = timed[i].videoSeconds!;
    if (!ends.has(start)) {
      ends.set(start, next);
      next = start;
    }
  }
  return timed
    .filter(
      (n) =>
        seconds >= n.videoSeconds! &&
        seconds < (n.videoEndSeconds ?? ends.get(n.videoSeconds!)!),
    )
    .map((n) => n.id);
}
