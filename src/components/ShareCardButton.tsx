"use client";

import { useState } from "react";
import { Download, Check } from "lucide-react";
import { useScenarioStore } from "@/store/scenario";
import { REMAINING } from "@/lib/data";
import { encodeScenario } from "@/lib/scenario";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { TeamSlug } from "@/lib/types";

interface Props {
  /** Optional team focus — adds `?team=<slug>` so the OG card foregrounds that team. */
  team?: TeamSlug;
  /** Optional visual variant. Defaults to primary blue. */
  variant?: "primary" | "secondary";
  /** Optional label override. */
  label?: string;
}

/**
 * Primary share action — downloads a PNG of the current scenario suitable for
 * Reddit / Twitter / iMessage. When `team` is set the card foregrounds that team.
 */
export function ShareCardButton({ team, variant = "primary", label }: Props) {
  const picks = useScenarioStore((s) => s.picks);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleClick() {
    setState("loading");
    const encoded = encodeScenario(picks, REMAINING);
    const hasPicks = !!(encoded && /[01]/.test(encoded));
    const picksCount = Object.keys(picks).length;
    track("share_card_downloaded", {
      variant: team ? "team" : "global",
      team,
      picks_count: picksCount,
      has_picks: hasPicks,
    });
    try {
      const params = new URLSearchParams();
      if (hasPicks) params.set("p", encoded);
      if (team) params.set("team", team);
      const qs = params.toString();
      const url = qs ? `/api/og?${qs}` : "/api/og";
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const tag = team ?? (hasPicks ? encoded : "live");
      link.download = `ipl-pulse-${tag}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      setState("done");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("idle");
    }
  }

  const primary = variant === "primary";
  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-semibold transition-colors disabled:opacity-50",
        primary
          ? "bg-sky-600 border-sky-600 text-white hover:bg-sky-700"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      )}
      title="Download a PNG ready for Reddit / Twitter / iMessage"
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {state === "loading"
        ? "Generating…"
        : state === "done"
          ? "Downloaded"
          : (label ?? "Download share card")}
    </button>
  );
}
