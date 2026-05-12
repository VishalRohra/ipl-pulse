import type { TeamStanding, TeamSlug } from "./types";

/**
 * Head-to-head record between teams in the current season.
 * `h2h[a][b]` = number of times team `a` has beaten team `b`.
 * Used as the 4th tiebreaker per IPL rules.
 */
export type H2H = Partial<Record<TeamSlug, Partial<Record<TeamSlug, number>>>>;

/**
 * Sort teams using IPL playoff-qualification ordering rules.
 * Order of comparators (each only invoked if the previous was a tie):
 *   1. Points (more is better)
 *   2. Wins (more is better)
 *   3. NRR (higher is better)
 *   4. Head-to-head record among the tied subset (more wins is better)
 *
 * The 5th IPL rule (least bowler-concedes-per-match) is intentionally omitted —
 * it has effectively never determined an IPL playoff spot in modern history,
 * and we don't have ball-by-ball data to compute it.
 *
 * Returns a NEW sorted array — does not mutate input.
 */
export function rankTeams(standings: TeamStanding[], h2h?: H2H): TeamStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.won !== b.won) return b.won - a.won;
    if (a.nrr !== b.nrr) return b.nrr - a.nrr;
    if (h2h) {
      const aOverB = h2h[a.slug]?.[b.slug] ?? 0;
      const bOverA = h2h[b.slug]?.[a.slug] ?? 0;
      if (aOverB !== bOverA) return bOverA - aOverB;
    }
    return 0;
  });
  return sorted;
}

/** Convenience: top-N by IPL ordering. Default 4 = playoff spots. */
export function topN(
  standings: TeamStanding[],
  n = 4,
  h2h?: H2H
): TeamStanding[] {
  return rankTeams(standings, h2h).slice(0, n);
}

/** Convenience: set of team slugs that would qualify for playoffs. */
export function qualifyingSlugs(
  standings: TeamStanding[],
  spots = 4,
  h2h?: H2H
): Set<TeamSlug> {
  return new Set(topN(standings, spots, h2h).map((t) => t.slug));
}
