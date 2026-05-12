"use client";

import { useEffect, useMemo, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
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
      loadFromMap(decodeScenario(encoded, REMAINING));
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
        <div className="flex flex-wrap items-baseline gap-3 mb-1">
          <h2 className="text-xl font-semibold text-slate-900">Playoff race</h2>
          <span className="text-xs text-slate-500">
            {COMPLETED_THROUGH} of {TOTAL_LEAGUE_MATCHES} matches done · as of {asOfDate} IST
          </span>
        </div>
        {/* Reserve the second-line height so adding "recalculating…" doesn't shift layout. */}
        <p className="text-sm text-slate-600 min-h-[1.5rem]">
          Click winners of remaining matches below to see how playoff odds shift across all 10 teams.
          {isStale && <span className="ml-2 text-sky-600">recalculating…</span>}
        </p>
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
