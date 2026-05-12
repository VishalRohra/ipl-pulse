/**
 * Manual standings updater — apply one completed match to data/standings.json
 * without scraping. Use until the auto-scraper is wired in.
 *
 * Usage:
 *   pnpm update <winner_slug> <loser_slug> <margin>
 *   pnpm update dc pbks 3w     # DC beat PBKS by 3 wickets
 *   pnpm update rcb mi 18r     # RCB beat MI by 18 runs
 *   pnpm update kkr csk nr     # No result — both teams get 1 point
 *
 * The script:
 *   - Increments played/won/lost/points
 *   - Nudges NRR (rough — exact backfill needs innings totals)
 *   - Bumps completedThrough and asOf
 *   - You'll still want to manually adjust NRR precisely from Cricinfo's official table
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "..", "data", "standings.json");

const [winner, loser, marginRaw] = process.argv.slice(2);
if (!winner || !loser || !marginRaw) {
  console.error("Usage: pnpm update <winner_slug> <loser_slug> <margin>");
  console.error("  margin examples: '3w' (wickets), '18r' (runs), 'nr' (no result)");
  process.exit(1);
}

const json = JSON.parse(readFileSync(path, "utf-8"));
const w = json.standings.find((s: { slug: string }) => s.slug === winner);
const l = json.standings.find((s: { slug: string }) => s.slug === loser);
if (!w || !l) {
  console.error(`Unknown slug: ${!w ? winner : loser}`);
  process.exit(1);
}

const isNoResult = marginRaw.toLowerCase() === "nr";
if (isNoResult) {
  w.played += 1; w.noResult += 1; w.points += 1;
  l.played += 1; l.noResult += 1; l.points += 1;
} else {
  const numeric = parseFloat(marginRaw);
  const isWickets = /w/i.test(marginRaw);
  w.played += 1; w.won += 1; w.points += 2;
  l.played += 1; l.lost += 1;

  // NRR nudge: very rough. For runs margin: +/- (margin/20)/(matches+1) shift.
  // For wickets margin: smaller NRR shift (~0.05–0.10 per match typically).
  const matchesW = (w.played - w.noResult);
  const matchesL = (l.played - l.noResult);
  const shift = isWickets ? 0.06 : (numeric / 20) / matchesW;
  w.nrr = +(w.nrr * (matchesW - 1) / matchesW + shift).toFixed(3);
  l.nrr = +(l.nrr * (matchesL - 1) / matchesL - shift).toFixed(3);
}

json.completedThrough += 1;
json.asOf = new Date().toISOString();

writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
console.log(`Applied match #${json.completedThrough}: ${winner.toUpperCase()} ${isNoResult ? "drew with" : "beat"} ${loser.toUpperCase()} (${marginRaw}).`);
console.log("Don't forget to remove the played match from data/remaining.json.");
