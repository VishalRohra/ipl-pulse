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

export interface MarginThreshold {
  match: RemainingMatch;
  /** [{margin, pct}] across representative margins (winner = focus team). */
  winSamples: { margin: number; pct: number }[];
  /** Qualifying % if the team LOSES this match (all margins similar — sample at 25 runs). */
  lossPct: number;
}

/**
 * For each of a team's remaining matches, sample qualifying % across a few
 * representative win margins (and one loss). Lets fans see "how much does
 * margin matter for my team?" at a glance, without dragging sliders.
 */
export function marginThresholdsFor(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  slug: TeamSlug,
  scenario: ScenarioMap = {},
  iterations = 2500,
  seed?: number
): MarginThreshold[] {
  const matches = teamRemainingMatches(remaining, slug);
  const winMargins = [5, 20, 40, 70];

  return matches.map((m) => {
    const opp = opponentOf(m, slug);
    const winSamples = winMargins.map((margin) => {
      const overlay: ScenarioMap = { ...scenario, [m.id]: { winner: slug, marginRuns: margin } };
      const r = simulate(standings, remaining, overlay, { iterations, seed });
      return { margin, pct: r.qualifyPct[slug] };
    });
    const lossOverlay: ScenarioMap = { ...scenario, [m.id]: { winner: opp, marginRuns: 25 } };
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
