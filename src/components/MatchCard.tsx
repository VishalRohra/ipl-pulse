"use client";

import type { RemainingMatch, TeamSlug } from "@/lib/types";
import { team } from "@/lib/data";
import { cn } from "@/lib/utils";

/** True if the match date matches "today" in IST (where IPL is played). */
function isToday(dateStr: string): boolean {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return dateStr === today;
}

interface Props {
  match: RemainingMatch;
  pickedWinner: TeamSlug | null;
  onPick: (winner: TeamSlug | null) => void;
}

export function MatchCard({ match, pickedWinner, onPick }: Props) {
  const home = team(match.home);
  const away = team(match.away);
  const date = new Date(match.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  function TeamButton({ slug, label, color }: { slug: TeamSlug; label: string; color: string }) {
    const isPicked = pickedWinner === slug;
    return (
      <button
        onClick={() => onPick(isPicked ? null : slug)}
        className={cn(
          "flex-1 px-2 py-2 text-sm font-semibold rounded-md border-2 transition-colors",
          isPicked
            ? "text-white border-transparent"
            : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300"
        )}
        style={isPicked ? { background: color } : undefined}
        aria-pressed={isPicked}
      >
        {label}
      </button>
    );
  }

  const live = isToday(match.date);

  return (
    <div className={cn(
      "rounded-lg border bg-white p-3 shadow-sm transition",
      live ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200"
    )}>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono">#{match.id}</span>
          {live && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold uppercase text-[9px] tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> Live
            </span>
          )}
        </div>
        <span>{date} · {match.venue}</span>
      </div>
      <div className="flex items-stretch gap-2">
        <TeamButton slug={match.home} label={home.short} color={home.primary} />
        <span className="text-slate-300 text-xs self-center">vs</span>
        <TeamButton slug={match.away} label={away.short} color={away.primary} />
      </div>
    </div>
  );
}
