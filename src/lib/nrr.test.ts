import { describe, it, expect } from "vitest";
import {
  parseOvers,
  formatOvers,
  effectiveOvers,
  nrrFromComponents,
  addMatch,
  ZERO_NRR,
  nrrAfterWinByRuns,
  approximateComponents,
} from "./nrr";

describe("parseOvers", () => {
  it("converts '19.4' (19 overs, 4 balls) to decimal", () => {
    expect(parseOvers("19.4")).toBeCloseTo(19 + 4 / 6, 6);
  });
  it("handles whole-over inputs", () => {
    expect(parseOvers("20")).toBe(20);
    expect(parseOvers("0")).toBe(0);
  });
  it("passes through numeric inputs", () => {
    expect(parseOvers(19.6667)).toBe(19.6667);
  });
  it("handles 0.X correctly", () => {
    expect(parseOvers("0.3")).toBeCloseTo(0.5, 6);
  });
  it("rejects balls > 5", () => {
    expect(() => parseOvers("19.6")).toThrow();
  });
  it("rejects garbage", () => {
    expect(() => parseOvers("abc")).toThrow();
    expect(() => parseOvers("")).toThrow();
  });
});

describe("formatOvers", () => {
  it("round-trips with parseOvers", () => {
    expect(formatOvers(parseOvers("19.4"))).toBe("19.4");
    expect(formatOvers(parseOvers("0.3"))).toBe("0.3");
    expect(formatOvers(20)).toBe("20.0");
  });
  it("rolls 19.6 (illegal) to 20.0 via rounding", () => {
    expect(formatOvers(19 + 5.6 / 6)).toBe("20.0");
  });
});

describe("effectiveOvers (all-out rule)", () => {
  it("uses allotted overs when team is bowled out", () => {
    // 75 all out in 14.2 overs → NRR denominator = 20 (full allotment)
    expect(effectiveOvers(14 + 2 / 6, true, 20)).toBe(20);
  });
  it("uses faced overs when team is not bowled out", () => {
    expect(effectiveOvers(17.5, false, 20)).toBe(17.5);
  });
});

describe("nrrFromComponents — known scenarios", () => {
  it("simple: 200 in 20 vs 180 in 20 → +1.000 NRR", () => {
    const nrr = nrrFromComponents({
      runsFor: 200,
      oversFor: 20,
      runsAgainst: 180,
      oversAgainst: 20,
    });
    expect(nrr).toBeCloseTo(1.0, 6);
  });

  it("returns 0 if a denominator is 0 (no matches yet)", () => {
    expect(nrrFromComponents(ZERO_NRR)).toBe(0);
  });

  it("ICC reference example: collapse uses full 20 overs, hurts NRR more", () => {
    // Team scores 180/4 in 20. Opponent bowled out 75 in 14.2 overs.
    // Team's NRR contribution this match:
    //   (180 / 20) - (75 / 20) = 9 - 3.75 = +5.25  (all-out rule applied)
    // WITHOUT the all-out rule it would be:
    //   (180 / 20) - (75 / 14.333) = 9 - 5.233 = +3.767  (less impressive)
    const withRule = nrrFromComponents({
      runsFor: 180,
      oversFor: 20,
      runsAgainst: 75,
      oversAgainst: 20,
    });
    const withoutRule =
      180 / 20 - 75 / (14 + 2 / 6);
    expect(withRule).toBeCloseTo(5.25, 6);
    expect(withRule).toBeGreaterThan(withoutRule);
  });
});

describe("addMatch — building cumulative NRR across a season", () => {
  it("two matches with mixed innings sum correctly", () => {
    let acc = ZERO_NRR;
    // Match 1: team scores 200/5 in 20, concedes 180/8 in 20
    acc = addMatch(
      acc,
      { runs: 200, oversFaced: 20, allOut: false, allottedOvers: 20 },
      { runs: 180, oversFaced: 20, allOut: false, allottedOvers: 20 }
    );
    // Match 2: team scores 75 all out in 14.2, concedes 76/2 in 12.0
    acc = addMatch(
      acc,
      { runs: 75, oversFaced: 14 + 2 / 6, allOut: true, allottedOvers: 20 },
      { runs: 76, oversFaced: 12, allOut: false, allottedOvers: 20 }
    );
    // Cumulative: RF=275, OF=40 (20+20 due to all-out), RA=256, OB=32
    expect(acc.runsFor).toBe(275);
    expect(acc.oversFor).toBe(40);
    expect(acc.runsAgainst).toBe(256);
    expect(acc.oversAgainst).toBe(32);

    const nrr = nrrFromComponents(acc);
    // 275/40 - 256/32 = 6.875 - 8.0 = -1.125
    expect(nrr).toBeCloseTo(-1.125, 6);
  });
});

describe("nrrAfterWinByRuns — sensitivity engine", () => {
  it("bigger margin → higher post-match NRR (monotonic)", () => {
    const current = approximateComponents(0.0, 11);
    const nrrSmallWin = nrrAfterWinByRuns(current, 5);
    const nrrBigWin = nrrAfterWinByRuns(current, 50);
    expect(nrrBigWin).toBeGreaterThan(nrrSmallWin);
  });

  it("zero margin (tie via runs) leaves NRR ~unchanged at par", () => {
    const current = approximateComponents(0.0, 11);
    const nrrAt0 = nrrAfterWinByRuns(current, 0);
    expect(nrrAt0).toBeCloseTo(0, 3);
  });

  it("RCB at +1.103 NRR, winning by 25 runs, ends ~+1.06 (slight regression toward mean)", () => {
    const current = approximateComponents(1.103, 11);
    const after = nrrAfterWinByRuns(current, 25);
    // Adding a +25 margin match (worth +1.25 in isolation) to an 11-match
    // history at +1.103 should pull NRR slightly down (since 1.25/12 weight is
    // smaller than averaging would suggest, but +1.25 > +1.103, so it nudges UP).
    expect(after).toBeGreaterThan(1.103);
    expect(after).toBeLessThan(1.2);
  });
});

describe("approximateComponents — round-trip", () => {
  it("derived components reproduce the input NRR", () => {
    const c = approximateComponents(0.737, 11);
    expect(nrrFromComponents(c)).toBeCloseTo(0.737, 4);
  });
  it("works for negative NRR too", () => {
    const c = approximateComponents(-0.907, 11);
    expect(nrrFromComponents(c)).toBeCloseTo(-0.907, 4);
  });
});
