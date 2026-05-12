import { simulate, mulberry32 } from "../src/lib/simulate";
import standingsJson from "../data/standings.json" with { type: "json" };
import remainingJson from "../data/remaining.json" with { type: "json" };
import type { TeamStanding, RemainingMatch } from "../src/lib/types";

const t0 = performance.now();
const result = simulate(
  standingsJson.standings as TeamStanding[],
  remainingJson.matches as RemainingMatch[],
  {},
  { iterations: 50_000, rng: mulberry32(2026) }
);
const ms = performance.now() - t0;

const order = [
  "rcb", "srh", "gt", "pbks", "csk", "rr", "dc", "kkr", "mi", "lsg",
] as const;

console.log(`50K simulations took ${ms.toFixed(0)}ms\n`);
console.log("Team | Qualify %  | Top-1 %");
console.log("-----|------------|--------");
for (const slug of order) {
  const q = result.qualifyPct[slug].toFixed(1).padStart(5);
  const top = result.topSeedPct[slug].toFixed(1).padStart(5);
  console.log(`${slug.padEnd(4)} |   ${q}%    |  ${top}%`);
}
