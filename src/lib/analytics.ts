"use client";

import posthog from "posthog-js";

/**
 * Thin wrapper around posthog.capture so callers don't have to think about
 * whether PostHog is loaded (e.g. local dev without the env var, or before
 * the provider has finished hydrating).
 *
 * Custom events to layer on top of autocapture for a clean funnel:
 *   - scenario_loaded_from_url   — user arrived with `?p=...`
 *   - match_picked               — they picked a winner for a remaining match
 *   - scenario_reset             — they cleared all picks
 *   - share_card_downloaded      — they generated a share PNG
 *   - team_viewed                — they landed on a /teams/<slug> page
 */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // posthog-js sets `__loaded` after init; bail silently if it never ran.
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}
