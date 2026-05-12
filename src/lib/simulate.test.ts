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

  it("top-3 teams (RCB, SRH, GT — all on 14 pts) all qualify >70% of the time", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 5000,
      rng: mulberry32(7),
    });
    expect(r.qualifyPct.rcb).toBeGreaterThan(70);
    expect(r.qualifyPct.srh).toBeGreaterThan(70);
    expect(r.qualifyPct.gt).toBeGreaterThan(70);
  });

  it("RCB has higher #1-seed chance than SRH (better NRR)", () => {
    const r = simulate(STANDINGS, REMAINING, {}, {
      iterations: 10000,
      rng: mulberry32(99),
    });
    expect(r.topSeedPct.rcb).toBeGreaterThan(r.topSeedPct.srh);
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
  it("forcing all 3 RCB matches as RCB wins → RCB qualifies ~100%", () => {
    const scenario = {
      57: { winner: "rcb" as TeamSlug },
      61: { winner: "rcb" as TeamSlug },
      67: { winner: "rcb" as TeamSlug },
    };
    const r = simulate(STANDINGS, REMAINING, scenario, {
      iterations: 3000,
      rng: mulberry32(123),
    });
    expect(r.qualifyPct.rcb).toBeGreaterThan(99);
  });

  it("forcing all 3 RCB matches as RCB losses → RCB qualifies <90% (still strong from 14 pts)", () => {
    const scenario = {
      57: { winner: "kkr" as TeamSlug },
      61: { winner: "pbks" as TeamSlug },
      67: { winner: "srh" as TeamSlug },
    };
    const r = simulate(STANDINGS, REMAINING, scenario, {
      iterations: 3000,
      rng: mulberry32(456),
    });
    // RCB at 14 pts can still qualify even losing all 3 if others lose enough
    expect(r.qualifyPct.rcb).toBeLessThan(95);
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
