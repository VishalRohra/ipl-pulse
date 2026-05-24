"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ipl-pulse:feedback-submitted";

const TOURNAMENTS = [
  "IPL 2027",
  "WPL 2027",
  "T20 World Cup 2026",
  "ICC Champions Trophy",
  "Big Bash (BBL)",
  "Pakistan Super League (PSL)",
  "ODI World Cup 2027",
  "Other (tell us below)",
];

const VIZ_TYPES = [
  "Playoff / qualification scenarios (like this one)",
  "Player form & matchup heatmaps",
  "Live in-match win probability",
  "Auction value vs on-field returns",
  "Head-to-head historical analyses",
  "Venue & toss impact",
  "Bowling vs batting matchup deep-dives",
];

/**
 * Inline feedback card — pops up after league stage ends (or on the page in
 * general) to ask returning visitors what they want next. Submissions are
 * captured to PostHog as the `feedback_submitted` event (visible in the same
 * project as other analytics). One-time per browser via localStorage.
 */
export function FeedbackCard() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [tournament, setTournament] = useState("");
  const [vizTypes, setVizTypes] = useState<string[]>([]);
  const [freetext, setFreetext] = useState("");

  // Hide if already submitted this session (avoid annoying returning visitors).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") setSubmitted(true);
  }, []);

  function toggleViz(v: string) {
    setVizTypes((prev) => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    track("feedback_submitted", {
      email: email || null,
      tournament: tournament || null,
      viz_types: vizTypes,
      freetext: freetext || null,
    });
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <Check className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-slate-900">Thanks for the feedback!</div>
          <div className="text-slate-600 text-xs">Already in the inbox — what gets built next is shaped by what people ask for.</div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-sky-600" />
        <h3 className="text-sm font-semibold text-slate-900">What should we build next?</h3>
        <span className="ml-auto text-xs text-slate-500 hidden sm:inline">2 questions, 30 seconds</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Which tournament next? <span className="text-slate-400 font-normal">(pick one)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TOURNAMENTS.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTournament(t)}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-md border-2 transition-colors",
                  tournament === t
                    ? "bg-sky-600 border-sky-600 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Which kinds of data viz would you want? <span className="text-slate-400 font-normal">(pick any)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {VIZ_TYPES.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => toggleViz(v)}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-md border-2 transition-colors text-left",
                  vizTypes.includes(v)
                    ? "bg-sky-600 border-sky-600 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="fb-freetext" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Anything else? <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="fb-freetext"
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            rows={2}
            placeholder="Specific stat, team obsession, missing feature, anything goes"
            className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email (optional, only if you want a reply)"
            className="flex-1 text-sm rounded-md border border-slate-300 bg-white px-3 py-1.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!tournament && vizTypes.length === 0 && !freetext.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-600 border border-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
