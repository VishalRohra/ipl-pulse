"use client";

import { useScenarioStore } from "@/store/scenario";
import { REMAINING } from "@/lib/data";
import { MatchCard } from "./MatchCard";
import { RotateCcw, Share2, Check, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { buildShareUrl, encodeScenario } from "@/lib/scenario";

export function ScenarioPicker() {
  const picks = useScenarioStore((s) => s.picks);
  const setPick = useScenarioStore((s) => s.setPick);
  const reset = useScenarioStore((s) => s.reset);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const pickedCount = Object.keys(picks).length;
  const encoded = encodeScenario(picks, REMAINING);

  async function handleShare() {
    const base =
      typeof window !== "undefined"
        ? window.location.origin + window.location.pathname
        : "";
    const url = buildShareUrl(base, picks, REMAINING);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = pickedCount > 0 ? `?p=${encoded}` : "";
      const res = await fetch(`/api/og${params}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ipl-pulse-${pickedCount > 0 ? encoded : "live"}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloading(false);
    }
  }

  function redditShareUrl() {
    if (typeof window === "undefined") return "";
    const shareUrl = buildShareUrl(window.location.origin, picks, REMAINING);
    const title = pickedCount > 0
      ? `IPL 2026: my playoff scenario with ${pickedCount} of ${REMAINING.length} matches picked`
      : "IPL 2026: live playoff odds with NRR-aware simulation";
    return `https://www.reddit.com/r/IPL/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;
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
            onClick={reset}
            disabled={pickedCount === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            title="Download PNG share card"
          >
            <Download className="h-3 w-3" /> {downloading ? "Generating…" : "Share card"}
          </button>
          <a
            href={redditShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
            title="Post to r/IPL"
          >
            <ExternalLink className="h-3 w-3" /> r/IPL
          </a>
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-sky-600 border border-sky-600 text-white hover:bg-sky-700 transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {REMAINING.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            pickedWinner={picks[m.id]?.winner ?? null}
            onPick={(w) => setPick(m.id, w)}
          />
        ))}
      </div>
    </div>
  );
}
