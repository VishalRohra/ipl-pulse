"use client";

import { useMemo } from "react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import { REMAINING, team, SIM_SEED } from "@/lib/data";
import { marginThresholdsFor, opponentOf } from "@/lib/team-helpers";
import { useScenarioStore } from "@/store/scenario";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

interface Props {
  standings: TeamStanding[];
  slug: TeamSlug;
}

/**
 * "How much does the margin matter for THIS team?" — for each of their
 * remaining matches, sample qualifying % at four win margins + one loss.
 * Surfaces NRR cliff-edges that close-points teams care about most.
 */
export function MarginThresholds({ standings, slug }: Props) {
  const picks = useScenarioStore((s) => s.picks);
  const rows = useMemo(
    () => marginThresholdsFor(standings, REMAINING, slug, picks, 2500, SIM_SEED),
    [standings, slug, picks]
  );

  if (rows.length === 0) return null;
  const t = team(slug);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Target className="h-4 w-4 text-sky-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          How much does margin matter for {t.short}?
        </h3>
      </div>
      <div className="px-4 py-3 text-xs text-slate-600">
        For each remaining {t.short} match, here's their playoff % at different win margins —
        plus what happens if they lose. When two columns look the same, the result matters far
        more than the margin. When they diverge, NRR is doing the work.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Match</th>
              <th className="px-3 py-2 text-right font-medium" colSpan={4}>If {t.short} wins by…</th>
              <th className="px-3 py-2 text-right font-medium">If {t.short} loses</th>
            </tr>
            <tr className="text-[10px]">
              <th className="px-3 pb-2 text-left text-slate-400 font-normal">opponent · date</th>
              <th className="px-3 pb-2 text-right text-slate-400 font-normal">5</th>
              <th className="px-3 pb-2 text-right text-slate-400 font-normal">20</th>
              <th className="px-3 pb-2 text-right text-slate-400 font-normal">40</th>
              <th className="px-3 pb-2 text-right text-slate-400 font-normal">70</th>
              <th className="px-3 pb-2 text-right text-slate-400 font-normal">by 25</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const opp = team(opponentOf(row.match, slug));
              return (
                <tr key={row.match.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900 text-sm">vs {opp.short}</div>
                    <div className="text-[11px] text-slate-400">
                      #{row.match.id} · {new Date(row.match.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </td>
                  {row.winSamples.map((s) => (
                    <td key={s.margin} className="px-3 py-2.5 text-right tabular-nums">
                      <span
                        className={cn(
                          "font-bold text-sm",
                          s.pct >= 95 ? "text-emerald-600" :
                          s.pct >= 50 ? "text-sky-700" :
                          s.pct >  1  ? "text-amber-700" : "text-slate-400"
                        )}
                      >
                        {s.pct.toFixed(0)}%
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={cn(
                        "font-bold text-sm",
                        row.lossPct >= 95 ? "text-emerald-600" :
                        row.lossPct >= 50 ? "text-sky-700" :
                        row.lossPct >  1  ? "text-amber-700" : "text-rose-600"
                      )}
                    >
                      {row.lossPct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
        % shown is the playoff probability if just this match resolves as described — other matches stay 50/50 (or honor your home-page picks).
      </div>
    </div>
  );
}
