"use client";

import { create } from "zustand";
import type { ScenarioMap, TeamSlug } from "@/lib/types";

interface ScenarioStore {
  picks: ScenarioMap;
  setPick: (matchId: number, winner: TeamSlug | null) => void;
  reset: () => void;
  loadFromMap: (map: ScenarioMap) => void;
}

export const useScenarioStore = create<ScenarioStore>((set) => ({
  picks: {},
  setPick: (matchId, winner) =>
    set((state) => {
      const next = { ...state.picks };
      if (winner === null) {
        delete next[matchId];
      } else {
        next[matchId] = { winner };
      }
      return { picks: next };
    }),
  reset: () => set({ picks: {} }),
  loadFromMap: (map) => set({ picks: map }),
}));
