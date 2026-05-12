import teamsJson from "../../data/teams.json" with { type: "json" };
import standingsJson from "../../data/standings.json" with { type: "json" };
import remainingJson from "../../data/remaining.json" with { type: "json" };
import type { Team, TeamSlug, TeamStanding, RemainingMatch } from "./types";

export const TEAMS = teamsJson.teams as Team[];
export const STANDINGS = standingsJson.standings as TeamStanding[];
export const REMAINING = remainingJson.matches as RemainingMatch[];
export const STANDINGS_AS_OF = standingsJson.asOf;
export const COMPLETED_THROUGH = standingsJson.completedThrough;
export const TOTAL_LEAGUE_MATCHES = standingsJson.totalLeagueMatches;
export const PLAYOFF_SPOTS = standingsJson.playoffSpots;

/** Fixed seed for the Monte Carlo simulator. Same picks → same numbers, every time. */
export const SIM_SEED = 2026;
/** Iterations used by the live UI. Higher = more precise but slower; 10K → ±1%. */
export const SIM_ITERATIONS = 10_000;

const teamMap = new Map<TeamSlug, Team>();
for (const team of TEAMS) teamMap.set(team.slug, team);

export function team(slug: TeamSlug): Team {
  const t = teamMap.get(slug);
  if (!t) throw new Error(`Unknown team slug: ${slug}`);
  return t;
}
