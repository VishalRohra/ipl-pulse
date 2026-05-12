import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { TeamView } from "@/components/TeamView";
import { TEAMS, team } from "@/lib/data";
import type { TeamSlug } from "@/lib/types";

const VALID = new Set(TEAMS.map((t) => t.slug));

export function generateStaticParams() {
  return TEAMS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!VALID.has(slug as TeamSlug)) return {};
  const t = team(slug as TeamSlug);
  const title = `${t.name} — IPL 2026 playoff path`;
  const description = `What does ${t.short} need to qualify? Every win/loss combination of their remaining matches and the resulting playoff odds.`;
  const ogUrl = `/api/og?team=${slug}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogUrl, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [ogUrl] },
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID.has(slug as TeamSlug)) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
          <TeamView slug={slug as TeamSlug} />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
        Made with cricket-nerd love · NRR math is exact, simulation uses 50/50 priors.
      </footer>
    </>
  );
}
