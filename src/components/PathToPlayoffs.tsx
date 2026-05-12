"use client";

import { useMemo } from "react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import { REMAINING, team, SIM_SEED } from "@/lib/data";
import { pathToPlayoffs, teamRemainingMatches, opponentOf } from "@/lib/team-helpers";
import { useScenarioStore } from "@/store/scenario";
import { cn, formatMatchDate } from "@/lib/utils";

interface Props {
  standings: TeamStanding[];
  slug: TeamSlug;
}

export function PathToPlayoffs({ standings, slug }: Props) {
  const picks = useScenarioStore((s) => s.picks);
  const matches = useMemo(() => teamRemainingMatches(REMAINING, slug), [slug]);
  const rows = useMemo(
    () => pathToPlayoffs(standings, REMAINING, slug, picks, 3000, SIM_SEED),
    [standings, slug, picks]
  );

  if (matches.length === 0) {
    return null;
  }

  const t = team(slug);
  const N = matches.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Path to playoffs</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Every combination of {t.short}'s remaining {N} match{N === 1 ? "" : "es"} —
          other matches stay 50/50.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              {matches.map((m) => {
                const opp = team(opponentOf(m, slug));
                return (
                  <th key={m.id} className="px-3 py-2 text-center font-medium">
                    vs {opp.short}
                    <div className="text-[10px] text-slate-400 normal-case font-normal">
                      {formatMatchDate(m.date, { month: "short", day: "numeric" })}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">{t.short} qualify %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.outcomeMask} className="border-t border-slate-100">
                {matches.map((m, i) => {
                  const won = !!(row.outcomeMask & (1 << i));
                  return (
                    <td key={m.id} className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold",
                          won ? "text-white" : "bg-slate-100 text-slate-400"
                        )}
                        style={won ? { background: t.primary } : undefined}
                      >
                        {won ? "W" : "L"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">{row.newPoints}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-bold",
                    row.qualifyPct >= 99 ? "text-emerald-600" :
                    row.qualifyPct >= 50 ? "text-sky-700" :
                    row.qualifyPct >  1  ? "text-amber-700" :
                                            "text-slate-400"
                  )}
                >
                  {row.qualifyPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
