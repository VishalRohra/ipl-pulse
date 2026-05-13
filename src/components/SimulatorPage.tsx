"use client";

import { useEffect, useMemo, useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";
import { relativeTimeFrom } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useScenarioStore } from "@/store/scenario";
import { simulate } from "@/lib/simulate";
import { decodeScenario } from "@/lib/scenario";
import {
  STANDINGS,
  REMAINING,
  COMPLETED_THROUGH,
  TOTAL_LEAGUE_MATCHES,
  STANDINGS_AS_OF,
  SIM_SEED,
  SIM_ITERATIONS,
} from "@/lib/data";
import { PointsTable } from "./PointsTable";
import { OddsCards } from "./OddsCards";
import { ScenarioPicker } from "./ScenarioPicker";
import { DramaMeter } from "./DramaMeter";
import { NRRSensitivity } from "./NRRSensitivity";

export function SimulatorPage() {
  const picks = useScenarioStore((s) => s.picks);
  const loadFromMap = useScenarioStore((s) => s.loadFromMap);
  const params = useSearchParams();

  // Hydrate scenario from URL `?p=…` once on mount.
  useEffect(() => {
    const encoded = params.get("p");
    if (encoded) {
      const decoded = decodeScenario(encoded, REMAINING);
      loadFromMap(decoded);
      track("scenario_loaded_from_url", {
        picks_count: Object.keys(decoded).length,
        encoded,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Baseline (no picks) — recomputed only on standings change (effectively never
  // during a session, since standings are static). Same seed as "current" so
  // the delta isn't muddied by RNG noise.
  const baseline = useMemo(
    () => simulate(STANDINGS, REMAINING, {}, { iterations: SIM_ITERATIONS, seed: SIM_SEED }),
    []
  );

  // Defer the per-pick recompute so clicks register instantly.
  const deferredPicks = useDeferredValue(picks);
  const isStale = picks !== deferredPicks;

  const result = useMemo(
    () => simulate(STANDINGS, REMAINING, deferredPicks, { iterations: SIM_ITERATIONS, seed: SIM_SEED }),
    [deferredPicks]
  );

  const picksActive = Object.keys(picks).length > 0;

  const asOfDate = new Date(STANDINGS_AS_OF).toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Re-render the relative timestamp every minute so "5 minutes ago" stays current.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const relativeAsOf = relativeTimeFrom(STANDINGS_AS_OF, now);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
        <div className="flex flex-wrap items-baseline gap-3 mb-1">
          <h2 className="text-xl font-semibold text-slate-900">Playoff race</h2>
          <span className="text-xs text-slate-500">
            {COMPLETED_THROUGH} of {TOTAL_LEAGUE_MATCHES} matches done
          </span>
        </div>
        <p className="text-sm text-slate-600 min-h-[1.5rem]">
          Click winners of remaining matches below to see how playoff odds shift across all 10 teams.
          {isStale && <span className="ml-2 text-sky-600">recalculating…</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Data updated <strong className="text-slate-700">{relativeAsOf}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>Snapshot: {asOfDate} IST</span>
          <span className="text-slate-300">·</span>
          <span>Auto-refreshes every 10 min during match windows from{" "}
            <a className="text-sky-700 hover:underline" href="https://en.wikipedia.org/wiki/2026_Indian_Premier_League" target="_blank" rel="noreferrer">Wikipedia</a>
          </span>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_minmax(280px,360px)] gap-4 items-start">
        <PointsTable
          standings={STANDINGS}
          qualifyPct={result.qualifyPct}
          baselinePct={baseline.qualifyPct}
        />
        <DramaMeter standings={STANDINGS} />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Click a team for a focused playoff path
          </h2>
          <span className="text-xs text-slate-500 hidden sm:inline">
            10K Monte Carlo runs · same picks always give the same numbers
          </span>
        </div>
        <OddsCards
          standings={STANDINGS}
          qualifyPct={result.qualifyPct}
          baselinePct={baseline.qualifyPct}
          picksActive={picksActive}
        />
      </div>

      <ScenarioPicker />

      <NRRSensitivity standings={STANDINGS} />
    </div>
  );
}
