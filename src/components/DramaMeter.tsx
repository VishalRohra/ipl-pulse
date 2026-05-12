"use client";

import { useMemo, useState } from "react";
import type { TeamStanding } from "@/lib/types";
import { REMAINING, team, SIM_SEED } from "@/lib/data";
import { rankMatchesByImpact } from "@/lib/impact";
import { useScenarioStore } from "@/store/scenario";
import { Flame, Info } from "lucide-react";
import { cn, formatMatchDate } from "@/lib/utils";

interface Props {
  standings: TeamStanding[];
  topN?: number;
}

export function DramaMeter({ standings, topN = 5 }: Props) {
  const picks = useScenarioStore((s) => s.picks);
  const [showInfo, setShowInfo] = useState(false);

  const impacts = useMemo(
    () => rankMatchesByImpact(standings, REMAINING, picks, 3000, SIM_SEED),
    [standings, picks]
  );

  const top = impacts.slice(0, topN);
  if (top.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Every remaining match is locked in your scenario — nothing left to swing.
      </div>
    );
  }
  const max = top[0].maxSwing;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-900">Drama meter</h3>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="ml-auto text-slate-400 hover:text-slate-700 transition"
          aria-label="What does this measure?"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      {showInfo && (
        <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 text-xs text-slate-700 leading-relaxed">
          For each match, we simulated <strong>both outcomes</strong> (home wins vs away wins)
          and measured how much each team's playoff % moves between the two worlds.
          The number shown is the <strong>biggest single-team swing</strong> — e.g. "12% for RCB"
          means RCB's playoff odds change by 12 percentage points depending on this one result.
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {top.map((imp) => {
          const home = team(imp.match.home);
          const away = team(imp.match.away);
          const date = formatMatchDate(imp.match.date);
          const widthPct = max > 0 ? (imp.maxSwing / max) * 100 : 0;

          // Find the team with the largest signed delta
          const sortedDeltas = Object.entries(imp.perTeamDelta).sort(
            (a, b) => Math.abs(b[1]) - Math.abs(a[1])
          );
          const [topSlug, topDelta] = sortedDeltas[0];
          const topTeam = team(topSlug as keyof typeof imp.perTeamDelta);
          // The "winner that helps the top team" is the away team if topDelta > 0
          // (delta is defined as ifAway - ifHome), else the home team.
          const helpedBy = topDelta > 0 ? imp.match.away : imp.match.home;
          const helpedByTeam = team(helpedBy);

          return (
            <li key={imp.match.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="text-slate-400 font-mono text-xs shrink-0">#{imp.match.id}</span>
                  <span className="font-semibold text-slate-900 truncate">
                    {home.short} vs {away.short}
                  </span>
                  <span className="text-slate-500 text-xs hidden sm:inline">· {date}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                  ±{imp.maxSwing.toFixed(1)}% for {topTeam.short}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-200"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{topTeam.short}</span>'s playoff %{" "}
                rises {Math.abs(topDelta).toFixed(1)} points if{" "}
                <span className="font-semibold text-slate-700">{helpedByTeam.short}</span>{" "}
                wins
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
