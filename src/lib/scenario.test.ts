import { describe, it, expect } from "vitest";
import { encodeScenario, decodeScenario, buildShareUrl } from "./scenario";
import type { RemainingMatch, ScenarioMap, TeamSlug } from "./types";

const MATCHES: RemainingMatch[] = [
  { id: 56, date: "2026-05-12", venue: "X", home: "gt" as TeamSlug,   away: "srh" as TeamSlug },
  { id: 57, date: "2026-05-13", venue: "X", home: "rcb" as TeamSlug,  away: "kkr" as TeamSlug },
  { id: 58, date: "2026-05-14", venue: "X", home: "pbks" as TeamSlug, away: "mi" as TeamSlug  },
];

describe("encodeScenario / decodeScenario", () => {
  it("empty scenario encodes to all underscores", () => {
    expect(encodeScenario({}, MATCHES)).toBe("___");
  });

  it("home wins encodes as '0', away wins as '1'", () => {
    const s: ScenarioMap = {
      56: { winner: "gt" },   // home
      57: { winner: "kkr" },  // away
      58: { winner: "pbks" }, // home
    };
    expect(encodeScenario(s, MATCHES)).toBe("010");
  });

  it("round-trips: encode then decode yields the same picks", () => {
    const s: ScenarioMap = {
      56: { winner: "srh" },
      58: { winner: "mi" },
    };
    const encoded = encodeScenario(s, MATCHES);
    const decoded = decodeScenario(encoded, MATCHES);
    expect(decoded[56]?.winner).toBe("srh");
    expect(decoded[57]).toBeUndefined();
    expect(decoded[58]?.winner).toBe("mi");
  });

  it("decoding ignores trailing extra chars beyond match count", () => {
    const decoded = decodeScenario("011XX", MATCHES);
    expect(Object.keys(decoded).length).toBe(3);
  });
});

describe("buildShareUrl", () => {
  it("returns base URL for an empty scenario", () => {
    expect(buildShareUrl("https://ipl-pulse.vercel.app/", {}, MATCHES)).toBe(
      "https://ipl-pulse.vercel.app/"
    );
  });

  it("appends ?p= when picks are present", () => {
    const s: ScenarioMap = { 56: { winner: "gt" }, 57: { winner: "rcb" } };
    const url = buildShareUrl("https://ipl-pulse.vercel.app/", s, MATCHES);
    expect(url).toContain("?p=00_");
  });
});
