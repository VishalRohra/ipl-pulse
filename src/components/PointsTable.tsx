"use client";

import type { TeamStanding, TeamSlug } from "@/lib/types";
import { team } from "@/lib/data";
import { rankTeams } from "@/lib/tiebreaker";
import { cn } from "@/lib/utils";

interface Props {
  standings: TeamStanding[];
  qualifyPct?: Record<TeamSlug, number>;
  baselinePct?: Record<TeamSlug, number>;
  playoffSpots?: number;
}

export function PointsTable({
  standings,
  qualifyPct,
  baselinePct,
  playoffSpots = 4,
}: Props) {
  const ranked = rankTeams(standings);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
          <tr>
            <th className="px-3 py-2.5 text-left w-8">#</th>
            <th className="px-2 py-2.5 text-left">Team</th>
            <th className="px-2 py-2.5 text-right w-10">P</th>
            <th className="px-2 py-2.5 text-right w-10">W</th>
            <th className="px-2 py-2.5 text-right w-10">L</th>
            <th className="px-2 py-2.5 text-right w-10">NR</th>
            <th className="px-2 py-2.5 text-right w-12 font-semibold">Pts</th>
            <th className="px-3 py-2.5 text-right w-20 font-semibold">NRR</th>
            {qualifyPct && (
              <th className="px-3 py-2.5 text-right w-32 font-semibold text-sky-700">
                Playoff %
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => {
            const t = team(row.slug);
            const inPlayoffs = i < playoffSpots;
            const pct = qualifyPct?.[row.slug];
            const base = baselinePct?.[row.slug];
            const delta = pct !== undefined && base !== undefined ? pct - base : 0;
            return (
              <tr
                key={row.slug}
                className={cn(
                  "border-t border-slate-100 transition-colors",
                  inPlayoffs ? "bg-sky-50/50" : "bg-white"
                )}
              >
                <td className="px-3 py-2.5 text-slate-400 font-mono tabular-nums">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: t.primary }}
                    />
                    <span className="font-semibold text-slate-900">{t.short}</span>
                    <span className="text-slate-500 hidden md:inline truncate">{t.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{row.played}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{row.won}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{row.lost}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">{row.noResult}</td>
                <td className="px-2 py-2.5 text-right tabular-nums font-bold text-slate-900">{row.points}</td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums font-semibold",
                    row.nrr >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {row.nrr >= 0 ? "+" : ""}
                  {row.nrr.toFixed(3)}
                </td>
                {pct !== undefined && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span
                        className={cn(
                          "font-bold",
                          pct >= 99 ? "text-emerald-600" :
                          pct >= 50 ? "text-sky-700" :
                          pct >  1  ? "text-amber-700" :
                                      "text-slate-400"
                        )}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      {Math.abs(delta) >= 0.5 ? (
                        <span
                          className={cn(
                            "text-[11px] font-semibold w-12 text-left",
                            delta > 0 ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[11px] w-12" aria-hidden />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
