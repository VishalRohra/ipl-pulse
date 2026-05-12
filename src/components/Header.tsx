import { Activity } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-sky-600 text-white">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-sky-700 transition">
              IPL Pulse
            </h1>
            <p className="text-[11px] text-slate-500 -mt-0.5">
              Playoff scenarios · IPL 2026
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/"
            className="text-slate-500 hover:text-slate-900 transition text-xs"
          >
            open source ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
