export type TeamSlug =
  | "rcb" | "srh" | "gt" | "pbks" | "csk"
  | "rr" | "dc" | "kkr" | "mi" | "lsg";

export interface Team {
  slug: TeamSlug;
  short: string;
  name: string;
  primary: string;
  secondary: string;
}

export interface TeamStanding {
  slug: TeamSlug;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
  nrr: number;
}

export interface RemainingMatch {
  id: number;
  date: string;
  venue: string;
  home: TeamSlug;
  away: TeamSlug;
}

/**
 * One innings of a T20 match — used for full NRR computation.
 * `allottedOvers` is the per-side max (typically 20). If the team was bowled out,
 * `allOut` must be true so the all-out rule applies (denominator = allottedOvers).
 */
export interface Innings {
  runs: number;
  oversFaced: number;   // decimal, e.g. 19.667 for "19.4 overs"
  allOut: boolean;
  allottedOvers: number;
}

/**
 * A user's choice for a remaining match. Cricket has two ways to win:
 *  - `runs`: team batting first sets a target, team batting second falls short
 *  - `wickets`: team batting second successfully chases (with N balls remaining)
 * If `outcome` is omitted the simulator samples a margin distribution.
 */
export type ScenarioPick = {
  winner: TeamSlug;
  outcome?:
    | { type: "runs"; marginRuns: number }
    | { type: "wickets"; ballsRemaining: number };
  /** @deprecated use `outcome` — kept for URL-decoded picks without margin info */
  marginRuns?: number;
};

export type ScenarioMap = Record<number, ScenarioPick | undefined>;
