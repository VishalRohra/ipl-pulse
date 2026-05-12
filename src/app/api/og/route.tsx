import { ImageResponse } from "next/og";
import { STANDINGS, REMAINING, TEAMS, SIM_SEED } from "@/lib/data";
import { simulate } from "@/lib/simulate";
import { rankTeams } from "@/lib/tiebreaker";
import { decodeScenario } from "@/lib/scenario";
import { pathToPlayoffs, externalMatchesAffecting } from "@/lib/team-helpers";
import type { TeamSlug } from "@/lib/types";

export const runtime = "edge";

const TEAM_BY_SLUG = Object.fromEntries(TEAMS.map((t) => [t.slug, t]));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const encoded = url.searchParams.get("p") ?? "";
  const focus = url.searchParams.get("team");
  const scenario = decodeScenario(encoded, REMAINING);

  if (focus && TEAM_BY_SLUG[focus]) {
    return renderTeamCard(focus as TeamSlug, scenario, Object.keys(scenario).length);
  }
  return renderGlobalCard(scenario, Object.keys(scenario).length);
}

/* ───────────── Global card: full 10-team race ───────────── */
function renderGlobalCard(
  scenario: Record<number, { winner: TeamSlug } | undefined>,
  picksCount: number
) {
  const result = simulate(STANDINGS, REMAINING, scenario, { iterations: 10000, seed: SIM_SEED });
  const baseline = simulate(STANDINGS, REMAINING, {}, { iterations: 10000, seed: SIM_SEED });

  const ranked = rankTeams(STANDINGS).map((s) => {
    const pct = result.qualifyPct[s.slug];
    const base = baseline.qualifyPct[s.slug];
    return { ...s, pct, delta: pct - base, team: TEAM_BY_SLUG[s.slug] };
  });

  const headline = picksCount > 0
    ? `Scenario · ${picksCount} of ${REMAINING.length} matches picked`
    : "Live playoff race";

  return new ImageResponse(
    (
      <div style={cardShell}>
        <Header />
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 18, display: "flex" }}>
          {headline}
        </div>
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
              <div key={row.slug} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16 }}>
                <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: row.team.primary, flexShrink: 0 }} />
                <div style={{ display: "flex", width: 64, fontWeight: 700, fontSize: 15, color: "#334155" }}>{row.team.short}</div>
                <div style={{ flex: 1, height: 14, background: "#e2e8f0", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                  <div style={{ display: "flex", width: `${row.pct}%`, background: row.team.primary, height: "100%" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", width: 60, fontWeight: 700, fontSize: 16, color: numColor }}>
                  {row.pct.toFixed(1)}%
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", width: 70, fontSize: 13, fontWeight: 600, color: row.delta > 0 ? "#059669" : row.delta < 0 ? "#dc2626" : "#94a3b8" }}>
                  {deltaText}
                </div>
              </div>
            );
          })}
        </div>
        <Footer right="Top 4 qualify · 10K Monte Carlo runs" />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/* ───────────── Team card: identity + path + rooting interest ───────────── */
function renderTeamCard(
  slug: TeamSlug,
  scenario: Record<number, { winner: TeamSlug } | undefined>,
  picksCount: number
) {
  const t = TEAM_BY_SLUG[slug];
  const standing = STANDINGS.find((s) => s.slug === slug)!;
  const ranked = rankTeams(STANDINGS);
  const currentRank = ranked.findIndex((r) => r.slug === slug) + 1;

  // Live qualifying %
  const result = simulate(STANDINGS, REMAINING, scenario, { iterations: 8000, seed: SIM_SEED });
  const pct = result.qualifyPct[slug];

  // Path to playoffs — aggregate by # wins
  const path = pathToPlayoffs(STANDINGS, REMAINING, slug, scenario, 1200, SIM_SEED);
  const byWins = new Map<number, number[]>();
  for (const row of path) {
    if (!byWins.has(row.wins)) byWins.set(row.wins, []);
    byWins.get(row.wins)!.push(row.qualifyPct);
  }
  const pathRows = Array.from(byWins.entries())
    .map(([wins, pcts]) => ({
      wins,
      pct: pcts.reduce((a, b) => a + b, 0) / pcts.length,
    }))
    .sort((a, b) => b.wins - a.wins);
  const N = path[0]?.wins !== undefined ? Math.max(...path.map((p) => p.wins)) : 0;

  // Schedule watch — top external match
  const externals = externalMatchesAffecting(STANDINGS, REMAINING, slug, scenario, 1200, SIM_SEED);
  const topExternal = externals[0];
  const rootForTeam = topExternal
    ? (topExternal.teamDelta > 0 ? topExternal.impact.match.away : topExternal.impact.match.home)
    : null;
  const rootForT = rootForTeam ? TEAM_BY_SLUG[rootForTeam] : null;

  const status =
    pct >= 99 ? "lock" :
    pct >= 50 ? "in" :
    pct >  1  ? "live" : "out";
  const numColor =
    status === "lock" ? "#059669" :
    status === "in"   ? "#0f172a" :
    status === "live" ? "#b45309" : "#94a3b8";

  return new ImageResponse(
    (
      <div style={cardShell}>
        <Header />

        {/* Team identity row */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 18,
            padding: "16px 20px", borderRadius: 14,
            background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`,
            color: "white", marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ fontSize: 13, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>
              Currently #{currentRank} · {standing.points} pts · {standing.won}W-{standing.lost}L
            </span>
            <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
              {t.name}
            </span>
            <span style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>
              {picksCount > 0 ? `Scenario · ${picksCount} of ${REMAINING.length} matches picked` : "Live playoff path"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {pct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 14, opacity: 0.85 }}>to qualify</span>
          </div>
        </div>

        {/* Path-to-playoffs aggregated rows */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex" }}>
            Path to playoffs — {t.short}'s {N} remaining match{N === 1 ? "" : "es"}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {pathRows.map((row) => {
              const rowColor =
                row.pct >= 95 ? "#059669" :
                row.pct >= 50 ? "#0284c7" :
                row.pct >  1  ? "#b45309" : "#94a3b8";
              return (
                <div key={row.wins} style={{ display: "flex", alignItems: "center", fontSize: 18 }}>
                  <span style={{ display: "flex", width: 200, fontWeight: 600, color: "#334155" }}>
                    Win {row.wins} of {N}
                  </span>
                  <div style={{ flex: 1, display: "flex", height: 16, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ display: "flex", width: `${row.pct}%`, background: rowColor, height: "100%" }} />
                  </div>
                  <span style={{ display: "flex", width: 70, justifyContent: "flex-end", fontWeight: 800, color: rowColor, fontVariantNumeric: "tabular-nums" }}>
                    {row.pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule watch hint */}
        {rootForT && topExternal && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fde68a", fontSize: 15 }}>
            <span style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: rootForT.primary, flexShrink: 0 }} />
            <span style={{ display: "flex", color: "#92400e" }}>
              Root for {rootForT.short} vs {TEAM_BY_SLUG[topExternal.impact.match.home === rootForTeam ? topExternal.impact.match.away : topExternal.impact.match.home].short}
              {" "}— {t.short} gains {Math.abs(topExternal.teamDelta).toFixed(1)}% if {rootForT.short} wins
            </span>
          </div>
        )}

        <Footer right={`ipl-pulse.vercel.app/teams/${slug}`} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/* ───────────── Shared chrome ───────────── */
const cardShell: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "linear-gradient(135deg, #f1f5f9 0%, #e0f2fe 100%)",
  display: "flex",
  flexDirection: "column",
  padding: "44px 56px",
  fontFamily: "system-ui, sans-serif",
  color: "#0f172a",
};

function Header() {
  return (
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
  );
}

function Footer({ right }: { right: string }) {
  return (
    <div style={{ marginTop: "auto", paddingTop: 16, fontSize: 12, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
      <span>r/IPL · made with cricket-nerd love · NRR-aware sim</span>
      <span>{right}</span>
    </div>
  );
}
