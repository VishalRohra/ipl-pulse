import type { Innings } from "./types";

/**
 * Cricket overs are written as "X.Y" where Y is balls (0–5), not a decimal.
 * "19.4 overs" means 19 overs and 4 balls = 19 + 4/6 ≈ 19.6667 decimal overs.
 *
 * Accepts: number (already decimal), "19", "19.4", "0.3"
 * Returns decimal overs.
 */
export function parseOvers(input: number | string): number {
  if (typeof input === "number") return input;
  const trimmed = input.trim();
  if (!trimmed) throw new Error("parseOvers: empty input");
  if (!trimmed.includes(".")) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new Error(`parseOvers: invalid input "${input}"`);
    return n;
  }
  const [whole, balls] = trimmed.split(".");
  const w = Number(whole);
  const b = Number(balls);
  if (!Number.isFinite(w) || !Number.isFinite(b)) {
    throw new Error(`parseOvers: invalid input "${input}"`);
  }
  if (b < 0 || b > 5) {
    throw new Error(`parseOvers: balls must be 0–5, got ${b} in "${input}"`);
  }
  return w + b / 6;
}

/** Decimal overs back to "X.Y" form. 19.6667 → "19.4". */
export function formatOvers(decimal: number): string {
  const whole = Math.floor(decimal);
  const balls = Math.round((decimal - whole) * 6);
  if (balls === 6) return `${whole + 1}.0`;
  return `${whole}.${balls}`;
}

/**
 * The all-out rule: if a team is bowled out before completing its allotted overs,
 * NRR uses the FULL allotted overs as the denominator, not the overs actually faced.
 * This makes a collapse more punishing — and is the rule most amateur calculators miss.
 */
export function effectiveOvers(faced: number, allOut: boolean, allotted: number): number {
  return allOut ? allotted : faced;
}

/**
 * Cumulative components needed to compute NRR exactly.
 * RF = runs scored across all innings the team batted.
 * OF = effective overs faced across those innings (with all-out adjustment).
 * RA = runs conceded across all innings the team bowled.
 * OB = effective overs bowled across those innings (with all-out adjustment).
 */
export interface NrrComponents {
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
}

/**
 * Compute NRR from cumulative components.
 * NRR = (RF / OF) − (RA / OB), per ICC.
 */
export function nrrFromComponents(c: NrrComponents): number {
  if (c.oversFor === 0 || c.oversAgainst === 0) return 0;
  return c.runsFor / c.oversFor - c.runsAgainst / c.oversAgainst;
}

/**
 * Add one match's contribution to a team's running NRR components.
 * `batting` is what THIS team did with the bat; `bowling` is what the opponent did.
 */
export function addMatch(
  acc: NrrComponents,
  batting: Innings,
  bowling: Innings
): NrrComponents {
  return {
    runsFor: acc.runsFor + batting.runs,
    oversFor: acc.oversFor + effectiveOvers(batting.oversFaced, batting.allOut, batting.allottedOvers),
    runsAgainst: acc.runsAgainst + bowling.runs,
    oversAgainst: acc.oversAgainst + effectiveOvers(bowling.oversFaced, bowling.allOut, bowling.allottedOvers),
  };
}

export const ZERO_NRR: NrrComponents = {
  runsFor: 0,
  oversFor: 0,
  runsAgainst: 0,
  oversAgainst: 0,
};

/**
 * Approximate cumulative NRR components from a published NRR + matches played.
 *
 * We don't have per-match scorecards baked in, so we back-derive plausible
 * cumulative numbers using two simplifying assumptions:
 *  - Both sides faced the full 20 overs on average (OF ≈ OB ≈ matches × 20).
 *  - Average innings runs ≈ `avgInningsRuns` (default 175, IPL 2026 ~ballpark).
 *
 * The split: RF − RA is the only thing NRR pins down. We choose RF and RA
 * such that their average lands at `avgInningsRuns × matches`, and their
 * difference equals `nrr × matches × 20`.
 *
 * This is an *estimate*. For the cricket-nerd NRR-sensitivity feature we expose
 * results based on this, with a banner clarifying the approximation. To make it
 * exact, replace this with components scraped from per-match scorecards.
 */
export function approximateComponents(
  nrr: number,
  matchesCounted: number,
  avgInningsRuns = 175
): NrrComponents {
  if (matchesCounted <= 0) return ZERO_NRR;
  const overs = matchesCounted * 20;
  const totalRuns = avgInningsRuns * matchesCounted * 2;
  const diff = nrr * overs;
  const runsFor = (totalRuns + diff) / 2;
  const runsAgainst = (totalRuns - diff) / 2;
  return { runsFor, oversFor: overs, runsAgainst, oversAgainst: overs };
}

/**
 * Hypothetical "team T wins by M runs, batting first, both sides go 20 overs."
 *
 * Returns the team's new NRR after layering this match onto its prior components.
 * `parScore` defaults to 180 (close to IPL 2026 average first-innings score).
 *
 * This is the engine behind the NRR-sensitivity panel: vary M, recompute NRR,
 * see when the team crosses a threshold (e.g. another team's NRR for tiebreaker).
 */
export function nrrAfterWinByRuns(
  current: NrrComponents,
  marginRuns: number,
  parScore = 180
): number {
  const winnerScore = parScore;
  const loserScore = parScore - marginRuns;
  const next = addMatch(
    current,
    { runs: winnerScore, oversFaced: 20, allOut: false, allottedOvers: 20 },
    { runs: loserScore, oversFaced: 20, allOut: false, allottedOvers: 20 }
  );
  return nrrFromComponents(next);
}

/**
 * Hypothetical "team T wins by W wickets, chasing target T, completing in O overs."
 *
 * If chasing a 180 target and winning by 7 wickets in 17 overs, the chase team's
 * scored 180 (or target+1, treated as target here for clean math) in 17 overs.
 * The bowling side's denominator is their full 20 overs (since they bowled out).
 */
export function nrrAfterWinByWickets(
  current: NrrComponents,
  target: number,
  oversToWin: number
): number {
  const next = addMatch(
    current,
    { runs: target, oversFaced: oversToWin, allOut: false, allottedOvers: 20 },
    { runs: target - 1, oversFaced: 20, allOut: false, allottedOvers: 20 }
  );
  return nrrFromComponents(next);
}
