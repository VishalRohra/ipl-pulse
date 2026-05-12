import { ImageResponse } from "next/og";
import { STANDINGS, REMAINING, TEAMS, SIM_SEED } from "@/lib/data";
import { simulate } from "@/lib/simulate";
import { rankTeams } from "@/lib/tiebreaker";
import { decodeScenario } from "@/lib/scenario";

export const runtime = "edge";

const TEAM_BY_SLUG = Object.fromEntries(TEAMS.map((t) => [t.slug, t]));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const encoded = url.searchParams.get("p") ?? "";
  const focus = url.searchParams.get("team");
  const scenario = decodeScenario(encoded, REMAINING);
  const result = simulate(STANDINGS, REMAINING, scenario, { iterations: 10000, seed: SIM_SEED });
  const baseline = simulate(STANDINGS, REMAINING, {}, { iterations: 10000, seed: SIM_SEED });

  const ranked = rankTeams(STANDINGS).map((s) => {
    const pct = result.qualifyPct[s.slug];
    const base = baseline.qualifyPct[s.slug];
    return { ...s, pct, delta: pct - base, team: TEAM_BY_SLUG[s.slug] };
  });

  const picksCount = Object.keys(scenario).length;
  const headline = focus
    ? `${TEAM_BY_SLUG[focus]?.name ?? "Team"} · playoff path`
    : picksCount > 0
      ? `Scenario · ${picksCount} of ${REMAINING.length} matches picked`
      : "Live playoff race";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #f1f5f9 0%, #e0f2fe 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "44px 56px",
          fontFamily: "system-ui, sans-serif",
          color: "#0f172a",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 8, background: "#0284c7",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 20, fontWeight: 700, marginRight: 12,
            }}
          >
            ⚡
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>IPL Pulse</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Playoff scenarios · IPL 2026</span>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", display: "flex" }}>
            ipl-pulse.vercel.app
          </div>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 18, color: "#0f172a", display: "flex" }}>
          {headline}
        </div>

        {/* Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((row) => {
            const status =
              row.pct >= 99 ? "lock" :
              row.pct >= 50 ? "in" :
              row.pct >  1  ? "live" : "out";
            const numColor =
              status === "lock" ? "#059669" :
              status === "in"   ? "#0f172a" :
              status === "live" ? "#b45309" : "#94a3b8";
            const deltaText =
              picksCount > 0 && Math.abs(row.delta) >= 0.5
                ? `${row.delta > 0 ? "▲" : "▼"} ${Math.abs(row.delta).toFixed(1)}`
                : "";
            return (
              <div
                key={row.slug}
                style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 12, height: 12, borderRadius: 999,
                    background: row.team.primary, flexShrink: 0,
                  }}
                />
                <div style={{ display: "flex", width: 64, fontWeight: 700, fontSize: 15, color: "#334155" }}>
                  {row.team.short}
                </div>
                <div
                  style={{
                    flex: 1, height: 14, background: "#e2e8f0", borderRadius: 999,
                    overflow: "hidden", display: "flex",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: `${row.pct}%`,
                      background: row.team.primary,
                      height: "100%",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex", justifyContent: "flex-end",
                    width: 60, fontWeight: 700, fontSize: 16, color: numColor, fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.pct.toFixed(1)}%
                </div>
                <div
                  style={{
                    display: "flex", justifyContent: "flex-end",
                    width: 70, fontSize: 13,
                    fontWeight: 600, color: row.delta > 0 ? "#059669" : row.delta < 0 ? "#dc2626" : "#94a3b8",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {deltaText}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "auto", paddingTop: 16, fontSize: 12, color: "#94a3b8",
            display: "flex", justifyContent: "space-between",
          }}
        >
          <span>Top 4 qualify · {result.iterations.toLocaleString()} Monte Carlo runs</span>
          <span>r/IPL · made with cricket-nerd love</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
