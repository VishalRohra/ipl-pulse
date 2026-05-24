"use client";

import { useEffect, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import type { TeamSlug } from "@/lib/types";
import { STANDINGS, REMAINING, team, SIM_SEED, SIM_ITERATIONS } from "@/lib/data";
import { rankTeams } from "@/lib/tiebreaker";
import { simulate } from "@/lib/simulate";
import { useScenarioStore } from "@/store/scenario";
import { teamRemainingMatches, opponentOf } from "@/lib/team-helpers";
import { track } from "@/lib/analytics";
import { PathToPlayoffs } from "./PathToPlayoffs";
import { MarginThresholds } from "./MarginThresholds";
import { ExternalMatches } from "./ExternalMatches";
import { ShareCardButton } from "./ShareCardButton";
import { ChevronLeft } from "lucide-react";
import { cn, formatMatchDate } from "@/lib/utils";

interface Props {
  slug: TeamSlug;
}

export function TeamView({ slug }: Props) {
  const t = team(slug);
  const picks = useScenarioStore((s) => s.picks);
  const deferredPicks = useDeferredValue(picks);

  useEffect(() => {
    track("team_viewed", { team: slug });
  }, [slug]);

  const standing = STANDINGS.find((s) => s.slug === slug)!;
  const ranked = useMemo(() => rankTeams(STANDINGS), []);
  const currentRank = ranked.findIndex((r) => r.slug === slug) + 1;
  const remainingForTeam = useMemo(() => teamRemainingMatches(REMAINING, slug), [slug]);

  const result = useMemo(
    () => simulate(STANDINGS, REMAINING, deferredPicks, { iterations: SIM_ITERATIONS, seed: SIM_SEED }),
    [deferredPicks]
  );
  const baseline = useMemo(
    () => simulate(STANDINGS, REMAINING, {}, { iterations: SIM_ITERATIONS, seed: SIM_SEED }),
    []
  );

  const pct = result.qualifyPct[slug];
  const basePct = baseline.qualifyPct[slug];
  const delta = pct - basePct;
  const picksActive = Object.keys(picks).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition"
        >
          <ChevronLeft className="h-3 w-3" /> Back to all teams
        </Link>
        <ShareCardButton team={slug} label={`Share ${t.short}'s scenario`} />
      </div>

      <section
        className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}
      >
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-wide opacity-80">Currently #{currentRank}</p>
          <h2 className="text-3xl font-bold mt-1">{t.name}</h2>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mt-3">
            <div>
              <span className="text-3xl font-bold tabular-nums">{pct.toFixed(1)}%</span>
              <span className="text-sm opacity-80 ml-1">to qualify</span>
              {picksActive && Math.abs(delta) >= 0.5 && (
                <span
                  className={cn(
                    "ml-3 text-sm font-semibold",
                    delta > 0 ? "text-emerald-200" : "text-rose-200"
                  )}
                >
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} vs neutral
                </span>
              )}
            </div>
            <div className="text-sm opacity-90">
              {standing.points} pts · {standing.won}W-{standing.lost}L · NRR {standing.nrr >= 0 ? "+" : ""}{standing.nrr.toFixed(3)}
            </div>
          </div>
        </div>
      </section>

      {remainingForTeam.length > 0 && (
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{t.short}'s remaining matches</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click a winner — your pick syncs to the home page scenario.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {remainingForTeam.map((m) => {
            const opp = team(opponentOf(m, slug));
            const isHome = m.home === slug;
            const pick = picks[m.id]?.winner;
            return (
              <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="text-slate-400 text-xs">
                    #{m.id} · {formatMatchDate(m.date)} · {m.venue}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {isHome ? `${t.short} (H) vs ${opp.short}` : `${opp.short} (H) vs ${t.short}`}
                  </div>
                </div>
                <PickRow matchId={m.id} slug={slug} oppSlug={opp.slug} pick={pick ?? null} t={t} opp={opp} />
              </li>
            );
          })}
        </ul>
      </section>
      )}

      <PathToPlayoffs standings={STANDINGS} slug={slug} />

      <MarginThresholds standings={STANDINGS} slug={slug} />

      <ExternalMatches standings={STANDINGS} slug={slug} />
    </div>
  );
}

function PickRow({
  matchId,
  slug,
  oppSlug,
  pick,
  t,
  opp,
}: {
  matchId: number;
  slug: TeamSlug;
  oppSlug: TeamSlug;
  pick: TeamSlug | null;
  t: ReturnType<typeof team>;
  opp: ReturnType<typeof team>;
}) {
  const setPick = useScenarioStore((s) => s.setPick);

  function btn(target: TeamSlug, label: string, color: string) {
    const isPicked = pick === target;
    function handleClick() {
      const next = isPicked ? null : target;
      setPick(matchId, next);
      if (next) {
        track("match_picked", { match_id: matchId, winner: next, source: "team_page", focus_team: slug });
      }
    }
    return (
      <button
        onClick={handleClick}
        className={cn(
          "px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-colors",
          isPicked
            ? "text-white border-transparent"
            : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
        )}
        style={isPicked ? { background: color } : undefined}
        aria-pressed={isPicked}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {btn(slug, t.short, t.primary)}
      <span className="text-slate-300 text-xs">or</span>
      {btn(oppSlug, opp.short, opp.primary)}
    </div>
  );
}
