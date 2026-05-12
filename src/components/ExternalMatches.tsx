"use client";

import { useMemo } from "react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import { REMAINING, team, SIM_SEED } from "@/lib/data";
import { externalMatchesAffecting } from "@/lib/team-helpers";
import { useScenarioStore } from "@/store/scenario";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  standings: TeamStanding[];
  slug: TeamSlug;
  topN?: number;
}

/**
 * "Matches you don't play that still decide your fate" — the schedule-watching
 * panel for die-hard fans. Ranks non-team matches by how much they swing
 * THIS team's qualifying %.
 */
export function ExternalMatches({ standings, slug, topN = 5 }: Props) {
  const picks = useScenarioStore((s) => s.picks);
  const t = team(slug);
  const rows = useMemo(
    () => externalMatchesAffecting(standings, REMAINING, slug, picks, 2000, SIM_SEED).slice(0, topN),
    [standings, slug, picks, topN]
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No external matches left to swing {t.short}'s fate — your scenario has them all locked.
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => Math.abs(r.teamDelta)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Eye className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Schedule watch — matches that matter to {t.short}
        </h3>
      </div>
      <div className="px-4 py-3 text-xs text-slate-600">
        These are matches {t.short} <em>isn't</em> playing, ranked by how much they move {t.short}'s playoff odds.
        The "rooting interest" column tells you who you should be cheering for as a {t.short} fan.
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map(({ impact, teamDelta }) => {
          const home = team(impact.match.home);
          const away = team(impact.match.away);
          const date = new Date(impact.match.date).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric",
          });
          // Positive teamDelta means away winning helps THIS team
          const rootFor = teamDelta > 0 ? away : home;
          const widthPct = max > 0 ? (Math.abs(teamDelta) / max) * 100 : 0;

          return (
            <li key={impact.match.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="text-slate-400 font-mono text-xs shrink-0">#{impact.match.id}</span>
                  <span className="font-semibold text-slate-900 truncate">
                    {home.short} vs {away.short}
                  </span>
                  <span className="text-slate-500 text-xs hidden sm:inline">· {date}</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums shrink-0",
                    Math.abs(teamDelta) < 0.5 ? "text-slate-400" :
                    teamDelta > 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  ±{Math.abs(teamDelta).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                <div
                  className="h-full transition-[width] duration-200"
                  style={{ width: `${widthPct}%`, background: rootFor.primary }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Root for{" "}
                <span className="font-semibold text-slate-900">{rootFor.short}</span>
                {" "}— {t.short} gains {Math.abs(teamDelta).toFixed(1)}% if they win
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
