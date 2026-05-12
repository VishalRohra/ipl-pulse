"use client";

import { useMemo, useState, useDeferredValue } from "react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import {
  REMAINING,
  team,
  SIM_SEED,
} from "@/lib/data";
import { approximateComponents, nrrAfterWinByRuns } from "@/lib/nrr";
import { simulate } from "@/lib/simulate";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Props {
  standings: TeamStanding[];
}

/**
 * NRR Sensitivity panel — the cricket-nerd differentiator.
 *
 * For a chosen remaining match + winner + margin (runs):
 *  - shows both teams' NRR after the match (NRR math is exact)
 *  - shows both teams' resulting playoff %
 *  - all updates live as the user drags the margin slider
 *
 * This is what every other IPL predictor handwaves: margin actually changes NRR,
 * which is the tiebreaker that decides who advances when points tie.
 */
export function NRRSensitivity({ standings }: Props) {
  const [matchId, setMatchId] = useState<number>(REMAINING[0].id);
  const [winnerOverride, setWinnerOverride] = useState<TeamSlug | null>(null);
  const [margin, setMargin] = useState<number>(20);

  const match = useMemo(
    () => REMAINING.find((m) => m.id === matchId)!,
    [matchId]
  );
  const winner = winnerOverride ?? match.home;
  const loser = winner === match.home ? match.away : match.home;

  // Reset winner override when match changes
  const homeT = team(match.home);
  const awayT = team(match.away);
  const winnerT = team(winner);
  const loserT = team(loser);

  // Exact NRR math: layer this match's runs onto each team's prior components.
  const { winnerNrrBefore, winnerNrrAfter, loserNrrBefore, loserNrrAfter } = useMemo(() => {
    const winnerStanding = standings.find((s) => s.slug === winner)!;
    const loserStanding = standings.find((s) => s.slug === loser)!;
    const winnerComp = approximateComponents(
      winnerStanding.nrr,
      winnerStanding.played - winnerStanding.noResult
    );
    const loserComp = approximateComponents(
      loserStanding.nrr,
      loserStanding.played - loserStanding.noResult
    );
    return {
      winnerNrrBefore: winnerStanding.nrr,
      winnerNrrAfter: nrrAfterWinByRuns(winnerComp, margin),
      loserNrrBefore: loserStanding.nrr,
      // Losing by `margin` runs = winning by `-margin` (the loser's view).
      loserNrrAfter: nrrAfterWinByRuns(loserComp, -margin),
    };
  }, [standings, winner, loser, margin]);

  // Simulated qualifying % at this margin vs. without picking the match
  const deferredMargin = useDeferredValue(margin);
  const sim = useMemo(() => {
    const withPick = simulate(
      standings,
      REMAINING,
      { [matchId]: { winner, marginRuns: deferredMargin } },
      { iterations: 5000, seed: SIM_SEED }
    );
    const without = simulate(standings, REMAINING, {}, { iterations: 5000, seed: SIM_SEED });
    return {
      winnerPct: withPick.qualifyPct[winner],
      winnerBasePct: without.qualifyPct[winner],
      loserPct: withPick.qualifyPct[loser],
      loserBasePct: without.qualifyPct[loser],
    };
  }, [standings, matchId, winner, loser, deferredMargin]);

  return (
    <div className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sky-600" />
        <h3 className="text-sm font-semibold text-slate-900">NRR sensitivity</h3>
        <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
          how much does win margin matter?
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-slate-600 mb-2">
            NRR is the tiebreaker when teams finish on equal points. A 30-run win bumps NRR
            far more than a last-ball thriller — and that gap can be the difference between
            playoffs and elimination. Pick a match below and drag the slider to see exactly
            how the winning margin moves both teams' NRR and qualification odds.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500">Match:</label>
          <select
            value={matchId}
            onChange={(e) => { setMatchId(Number(e.target.value)); setWinnerOverride(null); }}
            className="text-sm rounded border border-slate-300 bg-white px-2 py-1"
          >
            {REMAINING.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} · {team(m.home).short} vs {team(m.away).short} · {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500">Winner:</label>
          <button
            onClick={() => setWinnerOverride(match.home)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-colors",
              winner === match.home ? "text-white border-transparent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
            style={winner === match.home ? { background: homeT.primary } : undefined}
          >
            {homeT.short}
          </button>
          <button
            onClick={() => setWinnerOverride(match.away)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-colors",
              winner === match.away ? "text-white border-transparent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
            style={winner === match.away ? { background: awayT.primary } : undefined}
          >
            {awayT.short}
          </button>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-xs text-slate-500">
              Win margin: <span className="font-mono text-slate-900 font-semibold">{margin}</span> runs
            </label>
            <span className="text-[11px] text-slate-400">drag the slider</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <TeamPanel
            label={`${winnerT.short} (winner)`}
            color={winnerT.primary}
            nrrBefore={winnerNrrBefore}
            nrrAfter={winnerNrrAfter}
            pct={sim.winnerPct}
            basePct={sim.winnerBasePct}
          />
          <TeamPanel
            label={`${loserT.short} (loser)`}
            color={loserT.primary}
            nrrBefore={loserNrrBefore}
            nrrAfter={loserNrrAfter}
            pct={sim.loserPct}
            basePct={sim.loserBasePct}
          />
        </div>

        <p className="text-[11px] text-slate-400 italic">
          NRR math is exact (per ICC rules, with the all-out adjustment). Qualifying %
          comes from a 5,000-run Monte Carlo holding all other matches at 50/50.
        </p>
      </div>
    </div>
  );
}

function TeamPanel({
  label, color, nrrBefore, nrrAfter, pct, basePct,
}: {
  label: string; color: string;
  nrrBefore: number; nrrAfter: number;
  pct: number; basePct: number;
}) {
  const nrrDelta = nrrAfter - nrrBefore;
  const pctDelta = pct - basePct;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </div>
      <div className="space-y-1.5">
        <Row
          label="NRR"
          value={`${nrrAfter >= 0 ? "+" : ""}${nrrAfter.toFixed(3)}`}
          delta={nrrDelta}
          formatDelta={(d) => `${d > 0 ? "+" : ""}${d.toFixed(3)}`}
          before={`${nrrBefore >= 0 ? "+" : ""}${nrrBefore.toFixed(3)}`}
        />
        <Row
          label="Qualify"
          value={`${pct.toFixed(1)}%`}
          delta={pctDelta}
          formatDelta={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
          before={`${basePct.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

function Row({
  label, value, before, delta, formatDelta,
}: {
  label: string; value: string; before: string;
  delta: number; formatDelta: (d: number) => string;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className="text-slate-400 text-xs line-through">{before}</span>
        <span className="font-semibold text-slate-900">{value}</span>
        <span
          className={cn(
            "text-[11px] font-semibold min-w-[3.5rem] text-right",
            Math.abs(delta) < 0.005 ? "text-transparent" :
            delta > 0 ? "text-emerald-600" : "text-rose-600"
          )}
        >
          {formatDelta(delta)}
        </span>
      </span>
    </div>
  );
}
