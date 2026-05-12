import type { RemainingMatch, ScenarioMap, TeamSlug, TeamStanding } from "./types";
import { simulate } from "./simulate";
import { rankMatchesByImpact, type MatchImpact } from "./impact";

/** Remaining matches involving a given team. */
export function teamRemainingMatches(
  remaining: RemainingMatch[],
  slug: TeamSlug
): RemainingMatch[] {
  return remaining.filter((m) => m.home === slug || m.away === slug);
}

/** Opponent of `slug` in a given match. */
export function opponentOf(match: RemainingMatch, slug: TeamSlug): TeamSlug {
  return match.home === slug ? match.away : match.home;
}

export interface PathRow {
  /** Bitfield (LSB = first remaining match) — 1 = team wins, 0 = team loses. */
  outcomeMask: number;
  wins: number;
  losses: number;
  qualifyPct: number;
  newPoints: number;
}

/**
 * Enumerate all 2^N win/loss combinations of a team's remaining matches and
 * return the qualifying % under each. For a team with 3-4 remaining matches
 * this is 8-16 sims — well under a second total.
 *
 * Other teams' remaining matches stay 50/50 (or honor existing scenario picks).
 */
export function pathToPlayoffs(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  slug: TeamSlug,
  scenario: ScenarioMap = {},
  iterations = 1500,
  seed?: number
): PathRow[] {
  const teamMatches = teamRemainingMatches(remaining, slug);
  const N = teamMatches.length;
  const team = standings.find((s) => s.slug === slug)!;
  const rows: PathRow[] = [];

  for (let mask = 0; mask < 1 << N; mask++) {
    const overlay: ScenarioMap = { ...scenario };
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const m = teamMatches[i];
      if (mask & (1 << i)) {
        overlay[m.id] = { winner: slug };
        wins += 1;
      } else {
        overlay[m.id] = { winner: opponentOf(m, slug) };
      }
    }
    const r = simulate(standings, remaining, overlay, { iterations, seed });
    rows.push({
      outcomeMask: mask,
      wins,
      losses: N - wins,
      qualifyPct: r.qualifyPct[slug],
      newPoints: team.points + 2 * wins,
    });
  }
  return rows.sort((a, b) => b.wins - a.wins || b.qualifyPct - a.qualifyPct);
}

export type MarginMode = "runs" | "wickets";

export interface MarginThreshold {
  match: RemainingMatch;
  /** [{sample, pct}] across representative margins. `sample` is runs or balls-remaining. */
  winSamples: { sample: number; pct: number }[];
  /** Qualifying % if the team LOSES this match (margin held at a representative value). */
  lossPct: number;
}

/**
 * For each of a team's remaining matches, sample qualifying % across a few
 * representative win margins. Lets fans see "how much does margin matter
 * for my team?" at a glance, without dragging sliders.
 *
 * `mode = "runs"` samples win margins of 5, 20, 40, 70 runs (defending).
 * `mode = "wickets"` samples balls remaining of 2, 12, 30, 60 when chasing
 *   (the higher the number, the more dominant the chase, the bigger the
 *   NRR boost — small balls-remaining is a last-ball thriller).
 */
export function marginThresholdsFor(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  slug: TeamSlug,
  scenario: ScenarioMap = {},
  mode: MarginMode = "runs",
  iterations = 2500,
  seed?: number
): MarginThreshold[] {
  const matches = teamRemainingMatches(remaining, slug);
  const samples = mode === "runs" ? [5, 20, 40, 70] : [2, 12, 30, 60];

  return matches.map((m) => {
    const opp = opponentOf(m, slug);
    const winSamples = samples.map((s) => {
      const outcome = mode === "runs"
        ? { type: "runs" as const, marginRuns: s }
        : { type: "wickets" as const, ballsRemaining: s };
      const overlay: ScenarioMap = { ...scenario, [m.id]: { winner: slug, outcome } };
      const r = simulate(standings, remaining, overlay, { iterations, seed });
      return { sample: s, pct: r.qualifyPct[slug] };
    });
    // Loss case is symmetric: opponent wins by a representative margin (25 runs / 12 balls).
    const lossOutcome = mode === "runs"
      ? { type: "runs" as const, marginRuns: 25 }
      : { type: "wickets" as const, ballsRemaining: 12 };
    const lossOverlay: ScenarioMap = { ...scenario, [m.id]: { winner: opp, outcome: lossOutcome } };
    const lossSim = simulate(standings, remaining, lossOverlay, { iterations, seed });
    return { match: m, winSamples, lossPct: lossSim.qualifyPct[slug] };
  });
}

/**
 * Matches NOT involving `slug`, ranked by how much they swing `slug`'s
 * qualification odds. Useful for die-hard fans tracking the rival schedule.
 */
export function externalMatchesAffecting(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  slug: TeamSlug,
  scenario: ScenarioMap = {},
  iterations = 2000,
  seed?: number
): { impact: MatchImpact; teamDelta: number }[] {
  const all = rankMatchesByImpact(standings, remaining, scenario, iterations, seed);
  return all
    .filter((i) => i.match.home !== slug && i.match.away !== slug)
    .map((impact) => ({ impact, teamDelta: impact.perTeamDelta[slug] }))
    .sort((a, b) => Math.abs(b.teamDelta) - Math.abs(a.teamDelta));
}
