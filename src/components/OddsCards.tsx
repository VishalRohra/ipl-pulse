"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import { team } from "@/lib/data";
import { rankTeams } from "@/lib/tiebreaker";
import { cn } from "@/lib/utils";

interface Props {
  standings: TeamStanding[];
  qualifyPct: Record<TeamSlug, number>;
  baselinePct: Record<TeamSlug, number>;
  picksActive: boolean;
}

/**
 * Big "playoff %" cards — one per team. Order is fixed by the CURRENT
 * standings rank so the cards never reshuffle as the user toggles picks
 * (which was the source of the visible jitter on click).
 */
export function OddsCards({ standings, qualifyPct, baselinePct, picksActive }: Props) {
  const sorted = useMemo(
    () => rankTeams(standings).map((s) => team(s.slug)),
    [standings]
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {sorted.map((t) => {
        const pct = qualifyPct[t.slug];
        const base = baselinePct[t.slug];
        const delta = pct - base;
        const status =
          pct >= 99 ? "lock" :
          pct >= 50 ? "in"   :
          pct >  1  ? "live" : "out";

        return (
          <Link
            href={`/teams/${t.slug}`}
            key={t.slug}
            className={cn(
              "group rounded-xl p-3 border bg-white relative overflow-hidden block hover:shadow-md hover:-translate-y-0.5 hover:border-sky-400 transition-all cursor-pointer",
              status === "lock" ? "border-emerald-300 ring-1 ring-emerald-200" :
              status === "in"   ? "border-sky-200" :
              status === "live" ? "border-amber-200" :
                                  "border-slate-200 opacity-80"
            )}
          >
            <div
              className="absolute top-0 left-0 h-1 transition-[width] duration-200"
              style={{ width: `${pct}%`, background: t.primary }}
            />
            <div className="flex items-center gap-2 mb-1.5 mt-1">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: t.primary }}
              />
              <span className="font-semibold text-sm text-slate-900">{t.short}</span>
              {status === "lock" && (
                <span className="text-[10px] font-bold uppercase text-emerald-600">Locked</span>
              )}
              {status === "out" && (
                <span className="text-[10px] font-bold uppercase text-slate-400">Out</span>
              )}
              <ChevronRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-sky-600 transition" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "tabular-nums font-bold text-2xl",
                  status === "lock" ? "text-emerald-600" :
                  status === "in"   ? "text-slate-900" :
                  status === "live" ? "text-amber-700" :
                                      "text-slate-400"
                )}
              >
                {pct.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">%</span>
              {/* Always-rendered delta slot — keeps card height stable whether picks
                  are active or not. Invisible when there's nothing to show. */}
              <span
                className={cn(
                  "ml-auto text-xs font-semibold tabular-nums min-w-[3.5rem] text-right",
                  picksActive && Math.abs(delta) >= 0.5
                    ? (delta > 0 ? "text-emerald-600" : "text-rose-600")
                    : "text-transparent select-none"
                )}
                aria-hidden={!(picksActive && Math.abs(delta) >= 0.5)}
              >
                {picksActive && Math.abs(delta) >= 0.5
                  ? `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`
                  : "▲ 0.0"}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
