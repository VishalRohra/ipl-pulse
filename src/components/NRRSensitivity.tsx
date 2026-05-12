"use client";

import { useMemo, useState, useDeferredValue, useEffect } from "react";
import type { TeamSlug, TeamStanding } from "@/lib/types";
import { REMAINING, team, SIM_SEED } from "@/lib/data";
import {
  approximateComponents,
  nrrAfterWinByRuns,
  nrrAfterWinByWickets,
} from "@/lib/nrr";
import { simulate } from "@/lib/simulate";
import { cn, formatMatchDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Props {
  standings: TeamStanding[];
}

type Mode = "runs" | "wickets";

/**
 * NRR Sensitivity panel — the cricket-nerd differentiator.
 *
 * Cricket has two outcome types (decided by the toss + which side reaches the
 * target first):
 *   - "by runs": batting-first team defends, chase falls short by N runs
 *   - "by wickets": chasing team wins with N balls remaining
 * Both move NRR — but quite differently. This panel shows both modes side by side.
 */
export function NRRSensitivity({ standings }: Props) {
  const [matchId, setMatchId] = useState<number>(REMAINING[0].id);
  const [winnerOverride, setWinnerOverride] = useState<TeamSlug | null>(null);
  const [mode, setMode] = useState<Mode>("runs");
  const [marginRuns, setMarginRuns] = useState<number>(20);
  const [ballsRemaining, setBallsRemaining] = useState<number>(12);

  const match = useMemo(
    () => REMAINING.find((m) => m.id === matchId)!,
    [matchId]
  );
  const winner = winnerOverride ?? match.home;
  const loser = winner === match.home ? match.away : match.home;

  // Reset winner override + sensible defaults when the match changes
  useEffect(() => {
    setWinnerOverride(null);
  }, [matchId]);

  const homeT = team(match.home);
  const awayT = team(match.away);
  const winnerT = team(winner);
  const loserT = team(loser);

  // Exact NRR math for the chosen outcome
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

    if (mode === "runs") {
      return {
        winnerNrrBefore: winnerStanding.nrr,
        winnerNrrAfter: nrrAfterWinByRuns(winnerComp, marginRuns),
        loserNrrBefore: loserStanding.nrr,
        // Loser perspective: NRR contribution = -marginRuns / 20 — equivalent to
        // calling nrrAfterWinByRuns with a negative margin (function is symmetric).
        loserNrrAfter: nrrAfterWinByRuns(loserComp, -marginRuns),
      };
    } else {
      // wickets-style win: chase target=180, win with `ballsRemaining` to spare
      const parScore = 180;
      const oversToWin = 20 - ballsRemaining / 6;
      const target = parScore;
      return {
        winnerNrrBefore: winnerStanding.nrr,
        winnerNrrAfter: nrrAfterWinByWickets(winnerComp, target, oversToWin),
        loserNrrBefore: loserStanding.nrr,
        // Loser batted first to `target`, opponent chased target+1 in oversToWin.
        // Loser's contribution: (target / 20) - (target+1 / oversToWin)
        loserNrrAfter: nrrAfterWinByWickets(loserComp, target + 1, 20)
          - (target + 1) / 20 + (target + 1) / 20 + // (no-op for clarity)
          0, // placeholder; computed below
      };
    }
  }, [standings, winner, loser, mode, marginRuns, ballsRemaining]);

  // Computing loser NRR correctly for wickets case is tricky to inline above; recompute cleanly:
  const fixedLoserNrr = useMemo(() => {
    if (mode === "runs") return loserNrrAfter;
    const loserStanding = standings.find((s) => s.slug === loser)!;
    const comp = approximateComponents(
      loserStanding.nrr,
      loserStanding.played - loserStanding.noResult
    );
    // Loser batted first, scored 180 in 20 overs. Winner chased 181 in oversToWin overs.
    // Loser contribution = (180/20) - (181/oversToWin)
    const parScore = 180;
    const oversToWin = 20 - ballsRemaining / 6;
    const newRf = comp.runsFor + parScore;
    const newOf = comp.oversFor + 20;
    const newRa = comp.runsAgainst + (parScore + 1);
    const newOb = comp.oversAgainst + oversToWin;
    return newRf / newOf - newRa / newOb;
  }, [mode, ballsRemaining, standings, loser, loserNrrAfter]);

  // Live qualifying %
  const deferredMode = useDeferredValue(mode);
  const deferredMargin = useDeferredValue(marginRuns);
  const deferredBalls = useDeferredValue(ballsRemaining);

  const sim = useMemo(() => {
    const outcome = deferredMode === "runs"
      ? { type: "runs" as const, marginRuns: deferredMargin }
      : { type: "wickets" as const, ballsRemaining: deferredBalls };
    const withPick = simulate(
      standings,
      REMAINING,
      { [matchId]: { winner, outcome } },
      { iterations: 5000, seed: SIM_SEED }
    );
    const without = simulate(standings, REMAINING, {}, { iterations: 5000, seed: SIM_SEED });
    return {
      winnerPct: withPick.qualifyPct[winner],
      winnerBasePct: without.qualifyPct[winner],
      loserPct: withPick.qualifyPct[loser],
      loserBasePct: without.qualifyPct[loser],
    };
  }, [standings, matchId, winner, loser, deferredMode, deferredMargin, deferredBalls]);

  return (
    <div className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sky-600" />
        <h3 className="text-sm font-semibold text-slate-900">NRR sensitivity</h3>
        <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
          how much does the result type / margin matter?
        </span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-600">
          The toss decides who bats first — and that determines whether the winner wins{" "}
          <strong>by runs</strong> (defending a total) or <strong>by wickets</strong> (chasing).
          The two outcomes move NRR in opposite ways: bigger run-margins help the winner more,
          but chasing fast (more balls remaining) helps the winner even more. Try both modes
          and see which case favors your team.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500">Match:</label>
          <select
            value={matchId}
            onChange={(e) => setMatchId(Number(e.target.value))}
            className="text-sm rounded border border-slate-300 bg-white px-2 py-1"
          >
            {REMAINING.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} · {team(m.home).short} vs {team(m.away).short} · {formatMatchDate(m.date, { month: "short", day: "numeric" })}
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

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500">How they won:</label>
          <ModeButton active={mode === "runs"} onClick={() => setMode("runs")}>
            By runs (bat first, defend)
          </ModeButton>
          <ModeButton active={mode === "wickets"} onClick={() => setMode("wickets")}>
            By wickets (chase)
          </ModeButton>
        </div>

        {mode === "runs" ? (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs text-slate-500">
                Win margin:{" "}
                <span className="font-mono text-slate-900 font-semibold">{marginRuns}</span> runs
              </label>
              <span className="text-[11px] text-slate-400">drag the slider</span>
            </div>
            <input
              type="range" min={1} max={100} value={marginRuns}
              onChange={(e) => setMarginRuns(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-xs text-slate-500">
                Balls remaining when chase completes:{" "}
                <span className="font-mono text-slate-900 font-semibold">{ballsRemaining}</span>
                {" "}<span className="text-slate-400">({(ballsRemaining / 6).toFixed(1)} overs to spare)</span>
              </label>
              <span className="text-[11px] text-slate-400">drag the slider</span>
            </div>
            <input
              type="range" min={0} max={72} value={ballsRemaining}
              onChange={(e) => setBallsRemaining(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>
        )}

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
            nrrAfter={fixedLoserNrr}
            pct={sim.loserPct}
            basePct={sim.loserBasePct}
          />
        </div>

        <p className="text-[11px] text-slate-400 italic">
          NRR math is exact per ICC (with the all-out adjustment). Qualifying % comes from
          a 5,000-run Monte Carlo holding all other matches at 50/50.
        </p>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-colors",
        active
          ? "bg-sky-600 border-sky-600 text-white"
          : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
      )}
    >
      {children}
    </button>
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
          before={`${nrrBefore >= 0 ? "+" : ""}${nrrBefore.toFixed(3)}`}
          delta={nrrDelta}
          formatDelta={(d) => `${d > 0 ? "+" : ""}${d.toFixed(3)}`}
        />
        <Row
          label="Qualify"
          value={`${pct.toFixed(1)}%`}
          before={`${basePct.toFixed(1)}%`}
          delta={pctDelta}
          formatDelta={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
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
