import type { RemainingMatch, ScenarioMap, TeamSlug } from "./types";

/**
 * URL-friendly scenario encoding.
 *
 * For N remaining matches we use an N-character string keyed by match index:
 *   '0' → home team wins
 *   '1' → away team wins
 *   '_' → no pick (let Monte Carlo decide)
 *
 * Margins are deliberately NOT encoded in the URL — they would balloon length,
 * and Reddit shares typically only care about which team wins each match.
 *
 * Example with 15 remaining matches: `?p=01_10_0__111_0` (16 chars).
 */
const PICK_HOME = "0";
const PICK_AWAY = "1";
const PICK_NONE = "_";

export function encodeScenario(
  scenario: ScenarioMap,
  remaining: RemainingMatch[]
): string {
  return remaining
    .map((m) => {
      const pick = scenario[m.id];
      if (!pick) return PICK_NONE;
      if (pick.winner === m.home) return PICK_HOME;
      if (pick.winner === m.away) return PICK_AWAY;
      return PICK_NONE;
    })
    .join("");
}

export function decodeScenario(
  encoded: string,
  remaining: RemainingMatch[]
): ScenarioMap {
  const out: ScenarioMap = {};
  if (!encoded) return out;
  for (let i = 0; i < remaining.length && i < encoded.length; i++) {
    const ch = encoded[i];
    const m = remaining[i];
    let winner: TeamSlug | null = null;
    if (ch === PICK_HOME) winner = m.home;
    else if (ch === PICK_AWAY) winner = m.away;
    if (winner) out[m.id] = { winner };
  }
  return out;
}

/** Construct a shareable absolute URL with the scenario encoded as `?p=…`. */
export function buildShareUrl(
  baseUrl: string,
  scenario: ScenarioMap,
  remaining: RemainingMatch[]
): string {
  const encoded = encodeScenario(scenario, remaining);
  if (!encoded || encoded.split("").every((c) => c === PICK_NONE)) {
    return baseUrl;
  }
  const url = new URL(baseUrl);
  url.searchParams.set("p", encoded);
  return url.toString();
}
