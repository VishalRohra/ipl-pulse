"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Client-side PostHog provider.
 *
 * Reads `NEXT_PUBLIC_POSTHOG_KEY` and (optionally) `NEXT_PUBLIC_POSTHOG_HOST`
 * from the environment. If the key isn't set, this is a no-op — useful for
 * local dev where you usually don't want to pollute production analytics.
 *
 * Pageviews are captured manually because Next.js App Router doesn't fire
 * the same events as Pages Router, and we want the URL to include search
 * params (so we can see e.g. /?p=01_1__ scenario-share traffic).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    if (posthog.__loaded) return; // re-mount safe
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // We capture pageviews ourselves below, so PostHog's default doesn't double-fire.
      capture_pageview: false,
      capture_pageleave: true,
      // Anonymize IPs server-side; this is a public, non-PII site.
      respect_dnt: true,
      person_profiles: "identified_only",
    });
    // Tag every event so this site is filterable inside a multi-app PostHog
    // project (e.g. sharing the project with founderwiki.co). Use the filter
    // `app = ipl-pulse` in any PostHog insight/dashboard.
    posthog.register({ app: "ipl-pulse" });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || !ph || !posthog.__loaded) return;
    const qs = searchParams?.toString();
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${pathname}${qs ? `?${qs}` : ""}`
        : `${pathname}${qs ? `?${qs}` : ""}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}
