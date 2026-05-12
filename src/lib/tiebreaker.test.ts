import { describe, it, expect } from "vitest";
import { rankTeams, topN, qualifyingSlugs, type H2H } from "./tiebreaker";
import type { TeamStanding } from "./types";

const t = (
  slug: TeamStanding["slug"],
  points: number,
  won: number,
  nrr: number,
  played = 14,
  noResult = 0
): TeamStanding => ({
  slug,
  played,
  won,
  lost: played - won - noResult,
  noResult,
  points,
  nrr,
});

describe("rankTeams — basic ordering", () => {
  it("orders strictly by points when distinct", () => {
    const ranked = rankTeams([
      t("rcb", 14, 7, 0.5),
      t("mi", 6, 3, 0.0),
      t("gt", 18, 9, -0.2),
    ]);
    expect(ranked.map((r) => r.slug)).toEqual(["gt", "rcb", "mi"]);
  });

  it("breaks point-ties by wins", () => {
    // Both have 13 points but rcb has 6 wins vs pbks 6 wins + NR.
    // Same wins → falls through to NRR.
    const ranked = rankTeams([
      t("rcb", 14, 7, 0.0),
      t("pbks", 14, 6, 0.5, 14, 2), // 6W, 0L, 2NR → 14 pts
    ]);
    // rcb has more wins → ranks higher despite identical points
    expect(ranked[0].slug).toBe("rcb");
  });

  it("breaks ties on points + wins by NRR", () => {
    const ranked = rankTeams([
      t("a", 14, 7, 0.082),
      t("b", 14, 7, 0.185),
      t("c", 14, 7, 1.103),
    ]);
    expect(ranked.map((r) => r.slug)).toEqual(["c", "b", "a"]);
  });
});

describe("rankTeams — head-to-head as 4th tiebreaker", () => {
  it("uses H2H only when points + wins + NRR all match", () => {
    // Identical on every measurable: H2H decides
    const h2h: H2H = { a: { b: 2 }, b: { a: 0 } };
    const ranked = rankTeams(
      [
        t("a", 14, 7, 0.5),
        t("b", 14, 7, 0.5),
      ],
      h2h
    );
    expect(ranked[0].slug).toBe("a");
  });

  it("ignores H2H when NRR already separates the teams", () => {
    const h2h: H2H = { a: { b: 0 }, b: { a: 2 } }; // b dominates h2h
    const ranked = rankTeams(
      [
        t("a", 14, 7, 1.0), // higher NRR
        t("b", 14, 7, 0.0),
      ],
      h2h
    );
    expect(ranked[0].slug).toBe("a"); // NRR wins, H2H not invoked
  });
});

describe("rankTeams — does not mutate input", () => {
  it("returns a new array, leaves original order intact", () => {
    const original = [
      t("rcb", 6, 3, -0.2),
      t("mi", 14, 7, 0.5),
    ];
    const snapshot = original.map((s) => s.slug);
    rankTeams(original);
    expect(original.map((s) => s.slug)).toEqual(snapshot);
  });
});

describe("topN and qualifyingSlugs", () => {
  it("topN returns the top N teams in order", () => {
    const ranked = topN(
      [
        t("a", 14, 7, 0.5),
        t("b", 12, 6, 1.0),
        t("c", 16, 8, 0.0),
        t("d", 10, 5, 2.0),
        t("e", 18, 9, 0.0),
      ],
      3
    );
    expect(ranked.map((r) => r.slug)).toEqual(["e", "c", "a"]);
  });

  it("qualifyingSlugs returns the playoff-qualifying set", () => {
    const set = qualifyingSlugs(
      [
        t("rcb", 14, 7, 1.103),
        t("srh", 14, 7, 0.737),
        t("gt", 14, 7, 0.228),
        t("pbks", 13, 6, 0.428, 14, 2),
        t("csk", 12, 6, 0.185),
        t("rr", 12, 6, 0.082),
      ],
      4
    );
    expect(set).toEqual(new Set(["rcb", "srh", "gt", "pbks"]));
  });
});

describe("rankTeams — IPL 2026 current standings sanity check", () => {
  it("reproduces the known May 11 ordering (RCB > SRH > GT > PBKS > CSK > RR > DC > KKR > MI > LSG)", () => {
    const standings: TeamStanding[] = [
      t("rcb", 14, 7, 1.103, 11),
      t("srh", 14, 7, 0.737, 11),
      t("gt", 14, 7, 0.228, 11),
      t("pbks", 13, 6, 0.428, 11, 1),
      t("csk", 12, 6, 0.185, 11),
      t("rr", 12, 6, 0.082, 11),
      t("dc", 10, 5, -0.993, 12),
      t("kkr", 9, 4, -0.169, 10, 1),
      t("mi", 6, 3, -0.585, 11),
      t("lsg", 6, 3, -0.907, 11),
    ];
    const ranked = rankTeams(standings).map((s) => s.slug);
    expect(ranked).toEqual([
      "rcb", "srh", "gt", "pbks", "csk", "rr", "dc", "kkr", "mi", "lsg",
    ]);
  });
});
