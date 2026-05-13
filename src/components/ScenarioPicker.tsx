"use client";

import { useScenarioStore } from "@/store/scenario";
import { REMAINING } from "@/lib/data";
import { MatchCard } from "./MatchCard";
import { ShareCardButton } from "./ShareCardButton";
import { RotateCcw } from "lucide-react";
import { track } from "@/lib/analytics";
import type { TeamSlug } from "@/lib/types";

export function ScenarioPicker() {
  const picks = useScenarioStore((s) => s.picks);
  const setPick = useScenarioStore((s) => s.setPick);
  const reset = useScenarioStore((s) => s.reset);

  const pickedCount = Object.keys(picks).length;

  function handlePick(matchId: number, winner: TeamSlug | null) {
    setPick(matchId, winner);
    if (winner) {
      track("match_picked", { match_id: matchId, winner, source: "home" });
    }
  }

  function handleReset() {
    track("scenario_reset", { picks_count: pickedCount, source: "home" });
    reset();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pick remaining matches</h2>
          <p className="text-xs text-slate-500">
            {pickedCount} of {REMAINING.length} picked · unpicked matches simulate 50/50
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleReset}
            disabled={pickedCount === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <ShareCardButton />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {REMAINING.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            pickedWinner={picks[m.id]?.winner ?? null}
            onPick={(w) => handlePick(m.id, w)}
          />
        ))}
      </div>
    </div>
  );
}
