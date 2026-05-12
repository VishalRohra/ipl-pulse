import type { RemainingMatch, ScenarioMap, TeamSlug, TeamStanding } from "./types";
import { simulate } from "./simulate";

export interface MatchImpact {
  match: RemainingMatch;
  /** Sum of |Δ qualification %| across all teams when home wins vs away wins. */
  totalImpact: number;
  /** Per-team Δ% (away-wins minus home-wins). Positive = team prefers away win. */
  perTeamDelta: Record<TeamSlug, number>;
}

/**
 * "Drama meter" — score each remaining match by how much the qualification picture
 * shifts depending on its result. Higher score = more consequential match.
 *
 * Holds all OTHER matches at user-picked values (or 50/50 if unpicked) and varies
 * just this one match between two outcomes.
 */
export function rankMatchesByImpact(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  baseScenario: ScenarioMap = {},
  iterations = 1500,
  seed?: number
): MatchImpact[] {
  const impacts: MatchImpact[] = [];

  for (const m of remaining) {
    if (baseScenario[m.id]) continue; // skip matches already locked by user

    const homeWinsScenario = { ...baseScenario, [m.id]: { winner: m.home } };
    const awayWinsScenario = { ...baseScenario, [m.id]: { winner: m.away } };

    // Use the SAME seed for both branches — the only thing that differs between
    // them is this match's winner, so the resulting % delta isolates that effect.
    const ifHome = simulate(standings, remaining, homeWinsScenario, { iterations, seed });
    const ifAway = simulate(standings, remaining, awayWinsScenario, { iterations, seed });

    let total = 0;
    const perTeam: Record<string, number> = {};
    for (const s of standings) {
      const delta = ifAway.qualifyPct[s.slug] - ifHome.qualifyPct[s.slug];
      perTeam[s.slug] = delta;
      total += Math.abs(delta);
    }

    impacts.push({
      match: m,
      totalImpact: total / 2, // counted both directions for each team
      perTeamDelta: perTeam as Record<TeamSlug, number>,
    });
  }

  return impacts.sort((a, b) => b.totalImpact - a.totalImpact);
}
