/**
 * Auto-scraper for the IPL points table and remaining-fixtures list.
 *
 * Source-of-truth: the Wikipedia points table on `2026_Indian_Premier_League`.
 * The table is the *integrated* state — never try to derive standings from
 * individual match reports (we did that once and DC ended up off by 2 points).
 *
 * Wikipedia is volunteer-edited but reliably updated within hours of each
 * match. If a scrape fails or returns inconsistent data, we abort without
 * touching the JSON — better stale than wrong.
 *
 * Usage:  pnpm scrape
 *
 * Run nightly via Vercel Cron or GitHub Actions.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const standingsPath = join(__dirname, "..", "data", "standings.json");
const remainingPath = join(__dirname, "..", "data", "remaining.json");

const WIKI_URL = "https://en.wikipedia.org/wiki/2026_Indian_Premier_League";
const UA = "Mozilla/5.0 (compatible; IPL-Pulse-Scraper/1.0)";

// Wikipedia uses full team names; map to our slugs.
const NAME_TO_SLUG: Record<string, string> = {
  "Royal Challengers Bengaluru": "rcb",
  "Sunrisers Hyderabad": "srh",
  "Gujarat Titans": "gt",
  "Punjab Kings": "pbks",
  "Chennai Super Kings": "csk",
  "Rajasthan Royals": "rr",
  "Delhi Capitals": "dc",
  "Kolkata Knight Riders": "kkr",
  "Mumbai Indians": "mi",
  "Lucknow Super Giants": "lsg",
};

interface ParsedStanding {
  slug: string;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
  nrr: number;
}

async function fetchHtml(): Promise<string> {
  const res = await fetch(WIKI_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikipedia returned HTTP ${res.status}`);
  return res.text();
}

/**
 * Wikipedia's IPL points table is a `<table class="wikitable">` containing
 * a header row with `<abbr title="Net run rate">` and one row per team.
 * We isolate that table by anchor, then walk the rows.
 */
function parsePointsTable(html: string): ParsedStanding[] {
  // Find the table that contains the NRR column header
  const nrrAnchor = html.indexOf('title="Net run rate"');
  if (nrrAnchor < 0) throw new Error("NRR column not found — Wikipedia structure may have changed");

  // Walk back to the enclosing <table> open tag, forward to the matching </table>.
  const tableStart = html.lastIndexOf("<table", nrrAnchor);
  const tableEnd = html.indexOf("</table>", nrrAnchor);
  if (tableStart < 0 || tableEnd < 0) throw new Error("Could not isolate points table");
  const tableHtml = html.slice(tableStart, tableEnd + "</table>".length);

  // Each team row has a <th scope="row"> containing the team name link.
  // We capture name + the eight following <td> cells (pos already in the same row).
  const out: ParsedStanding[] = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(tableHtml))) {
    const row = m[1];
    // skip header rows
    if (!/<th scope="row"/.test(row)) continue;
    // Team name comes from the wiki link's `title` attribute inside the row header
    // — eliminated teams have an extra `(E)` span before </th> so don't anchor on </a>.
    const nameMatch = row.match(/<th scope="row"[^>]*>[\s\S]*?title="([^"]+)"/);
    if (!nameMatch) continue;
    const slug = NAME_TO_SLUG[nameMatch[1]];
    if (!slug) continue;
    // Extract all <td>...</td> innerText values, in order.
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let td: RegExpExecArray | null;
    while ((td = tdRegex.exec(row))) {
      cells.push(td[1].replace(/<[^>]+>/g, "").trim());
    }
    // Normalize Unicode minus (U+2212) → ASCII hyphen so negative NRRs parse.
    const numeric = cells
      .map((c) => c.replace(/−/g, "-"))
      .filter((c) => /^-?[\d.]+$/.test(c));
    if (numeric.length < 6) continue;
    // First numeric is the position; next six are P/W/L/NR/Pts/NRR.
    const [played, won, lost, nr, pts, nrr] = numeric.slice(1, 7).map(parseFloat);
    out.push({
      slug,
      played, won, lost, noResult: nr, points: pts, nrr,
    });
  }
  return out;
}

/**
 * Sanity-check the parsed table.
 *
 * IMPORTANT: when Wikipedia is fresh and our local remaining.json still
 * contains the just-played match, naive `played + ALL_remaining` over-counts
 * by 1. We compute `matchesDone` first, then validate against the *unplayed*
 * remaining matches (id > matchesDone). That way the bookkeeping holds
 * during the small window between Wikipedia updating and us pruning.
 */
function validate(parsed: ParsedStanding[], remainingMatches: { id: number; home: string; away: string }[]) {
  if (parsed.length !== 10) {
    throw new Error(`Expected 10 teams, got ${parsed.length}`);
  }
  const totalPlayed = parsed.reduce((s, t) => s + t.played, 0);
  if (totalPlayed % 2 !== 0) {
    throw new Error(`Inconsistent: total team-games = ${totalPlayed} (must be even)`);
  }
  const matchesDone = totalPlayed / 2;
  const unplayed = remainingMatches.filter((m) => m.id > matchesDone);

  for (const t of parsed) {
    const remForTeam = unplayed.filter((m) => m.home === t.slug || m.away === t.slug).length;
    if (t.played + remForTeam !== 14) {
      throw new Error(
        `${t.slug}: played=${t.played} + remaining(after prune)=${remForTeam} = ${t.played + remForTeam}, expected 14`
      );
    }
  }
  for (const t of parsed) {
    if (t.points !== 2 * t.won + t.noResult) {
      throw new Error(`${t.slug}: points=${t.points} ≠ 2W+NR (${2 * t.won + t.noResult})`);
    }
  }
  return matchesDone;
}

async function main() {
  console.log(`Fetching ${WIKI_URL}…`);
  const html = await fetchHtml();
  const parsed = parsePointsTable(html);
  console.log(`Parsed ${parsed.length} team rows.`);

  // Load current remaining + standings so we can validate + diff
  const current = JSON.parse(readFileSync(standingsPath, "utf-8"));
  const remainingJson = JSON.parse(readFileSync(remainingPath, "utf-8"));
  const matchesDone = validate(parsed, remainingJson.matches);

  // Find completedThrough: the highest played match ID = sum_played / 2.
  // We also prune remaining-matches whose ID falls within the played range.
  const newRemaining = remainingJson.matches.filter(
    (m: { id: number }) => m.id > matchesDone
  );

  const next = {
    ...current,
    asOf: new Date().toISOString(),
    completedThrough: matchesDone,
    standings: parsed,
  };

  // Show diff
  console.log("\nStandings diff vs current:");
  for (const newRow of parsed) {
    const old = current.standings.find((s: { slug: string }) => s.slug === newRow.slug);
    if (!old) {
      console.log(`  + ${newRow.slug}: NEW`);
      continue;
    }
    const changes: string[] = [];
    if (old.points !== newRow.points) changes.push(`pts ${old.points}→${newRow.points}`);
    if (old.won !== newRow.won) changes.push(`W ${old.won}→${newRow.won}`);
    if (old.lost !== newRow.lost) changes.push(`L ${old.lost}→${newRow.lost}`);
    if (Math.abs(old.nrr - newRow.nrr) > 0.0005) changes.push(`NRR ${old.nrr.toFixed(3)}→${newRow.nrr.toFixed(3)}`);
    if (changes.length > 0) {
      console.log(`  · ${newRow.slug.padEnd(5)} ${changes.join(", ")}`);
    }
  }

  const droppedIds = remainingJson.matches
    .filter((m: { id: number }) => m.id <= matchesDone)
    .map((m: { id: number }) => m.id);
  if (droppedIds.length > 0) {
    console.log(`\nDropping completed matches from remaining: ${droppedIds.join(", ")}`);
  }

  writeFileSync(standingsPath, JSON.stringify(next, null, 2) + "\n");
  writeFileSync(
    remainingPath,
    JSON.stringify({ ...remainingJson, matches: newRemaining }, null, 2) + "\n"
  );
  console.log(`\nWrote standings (${matchesDone} matches done) + ${newRemaining.length} remaining.`);
}

main().catch((err) => {
  console.error("Scrape failed:", err.message);
  console.error("Standings/remaining JSON NOT modified.");
  process.exit(1);
});
