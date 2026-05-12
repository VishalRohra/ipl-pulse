import { Suspense } from "react";
import { Header } from "@/components/Header";
import { SimulatorPage } from "@/components/SimulatorPage";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
          <SimulatorPage />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
        Made with cricket-nerd love · NRR math is exact, simulation uses 50/50 priors.
      </footer>
    </>
  );
}
