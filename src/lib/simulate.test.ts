import { describe, it, expect } from "vitest";
import { simulate, mulberry32 } from "./simulate";
import standingsJson from "../../data/standings.json" with { type: "json" };
import remainingJson from "../../data/remaining.json" with { type: "json" };
import type { TeamStanding, TeamSlug, RemainingMatch } from "./types";

const STANDINGS = standingsJson.standings as TeamStanding[];
const REMAINING = remainingJson.matches as RemainingMatch[];

describe("simulate — sanity checks against IPL 2026 current state", () => {
  it("eliminated teams (MI, LSG) have ~0% qualification chance", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 5000,
      rng: mulberry32(42),
    });
    expect(r.qualifyPct.mi).toBeLessThan(2);
    expect(r.qualifyPct.lsg).toBeLessThan(2);
  });

  it("the top three teams in current standings all qualify >60% of the time", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 5000,
      rng: mulberry32(7),
    });
    // Whoever the current top 3 are — they should be heavy favorites.
    const sortedSlugs = [...STANDINGS]
      .sort((a, b) => b.points - a.points || b.nrr - a.nrr)
      .map((s) => s.slug);
    for (const slug of sortedSlugs.slice(0, 3)) {
      expect(r.qualifyPct[slug], `top-3 team ${slug}`).toBeGreaterThan(60);
    }
  });

  it("the team with the best NRR has a non-trivial #1-seed chance", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 10000,
      rng: mulberry32(99),
    });
    const bestNrrTeam = [...STANDINGS].sort((a, b) => b.nrr - a.nrr)[0].slug;
    expect(r.topSeedPct[bestNrrTeam]).toBeGreaterThan(5);
  });

  it("qualifyPct values sum to ~400 (4 spots × 100%)", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 5000,
      rng: mulberry32(1),
    });
    const total = (Object.values(r.qualifyPct) as number[]).reduce(
      (a, b) => a + b,
      0
    );
    expect(total).toBeCloseTo(400, 0);
  });
});

describe("simulate — scenario picks shift odds correctly", () => {
  it("forcing the leader to win all their remaining matches → leader qualifies ~100%", () => {
    const leader = [...STANDINGS].sort(
      (a, b) => b.points - a.points || b.nrr - a.nrr
    )[0].slug;
    const leaderMatches = REMAINING.filter(
      (m) => m.home === leader || m.away === leader
    );
    const scenario = Object.fromEntries(
      leaderMatches.map((m) => [m.id, { winner: leader }])
    );
    const r = simulate(STANDINGS, REMAINING, scenario, {
      iterations: 3000,
      rng: mulberry32(123),
    });
    expect(r.qualifyPct[leader]).toBeGreaterThan(95);
  });

  it("forcing a mid-table team to lose all their remaining → their odds shrink", () => {
    // Pick a non-eliminated, non-locked team in the middle (15-85% qualify range).
    const baseline = simulate(STANDINGS, REMAINING, {}, {
      iterations: 3000,
      rng: mulberry32(789),
    });
    const midTable = STANDINGS.find(
      (s) => baseline.qualifyPct[s.slug] > 15 && baseline.qualifyPct[s.slug] < 85
    );
    if (!midTable) return; // race state may have no qualifying team
    const matches = REMAINING.filter(
      (m) => m.home === midTable.slug || m.away === midTable.slug
    );
    if (matches.length === 0) return;
    const losing = Object.fromEntries(
      matches.map((m) => [
        m.id,
        { winner: m.home === midTable.slug ? m.away : m.home },
      ])
    );
    const r = simulate(STANDINGS, REMAINING, losing, {
      iterations: 3000,
      rng: mulberry32(789),
    });
    expect(r.qualifyPct[midTable.slug]).toBeLessThan(baseline.qualifyPct[midTable.slug]);
  });
});

describe("simulate — determinism with seeded RNG", () => {
  it("same seed produces same results", () => {
    const a = simulate(STANDINGS, REMAINING, {}, {
      iterations: 1000,
      rng: mulberry32(2024),
    });
    const b = simulate(STANDINGS, REMAINING, {}, {
      iterations: 1000,
      rng: mulberry32(2024),
    });
    expect(a.qualifyPct).toEqual(b.qualifyPct);
  });
});
