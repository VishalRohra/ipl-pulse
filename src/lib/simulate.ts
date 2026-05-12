import type {
  RemainingMatch,
  ScenarioMap,
  TeamSlug,
  TeamStanding,
} from "./types";
import { approximateComponents } from "./nrr";
import { rankTeams, type H2H } from "./tiebreaker";

/**
 * Box–Muller normal sampler. Used for match-margin sampling.
 * Returns one N(mean, std) sample per call.
 */
function sampleNormal(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/** Mulberry32 — small, fast, seeded PRNG for deterministic test runs. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulateOptions {
  /** Number of Monte Carlo iterations. 3000 is a good interactive default. */
  iterations?: number;
  /** Standard deviation of margin distribution in runs. ~25 for T20. */
  marginStd?: number;
  /** Average first-innings score in runs (for NRR-impact accounting). */
  parScore?: number;
  /** Number of playoff spots. IPL = 4. */
  playoffSpots?: number;
  /** Optional H2H records used as a 4th tiebreaker. */
  h2h?: H2H;
  /** Optional seeded RNG. Prefer `seed` for stable cross-page numbers. */
  rng?: () => number;
  /** Integer seed for the internal RNG. Pass the same seed for identical numbers
   *  across re-renders / different pages — eliminates "noisy %" perception. */
  seed?: number;
  /** Optional per-team prior win probability for unscored matches. */
  priors?: Partial<Record<TeamSlug, number>>;
}

export interface SimulationResult {
  qualifyPct: Record<TeamSlug, number>;
  topSeedPct: Record<TeamSlug, number>;
  iterations: number;
}

/**
 * Monte Carlo: simulate the remaining matches `iterations` times,
 * return per-team % chance to qualify and to finish #1.
 *
 * Performance: this version uses typed arrays and in-place mutation to
 * avoid the GC pressure of Map.clone + object spread per iteration.
 * On a modern laptop: 10K iterations × 15 matches ≈ 30ms.
 */
export function simulate(
  standings: TeamStanding[],
  remaining: RemainingMatch[],
  scenario: ScenarioMap = {},
  options: SimulateOptions = {}
): SimulationResult {
  const iterations = options.iterations ?? 3000;
  const marginStd = options.marginStd ?? 25;
  const parScore = options.parScore ?? 180;
  const playoffSpots = options.playoffSpots ?? 4;
  const rng = options.rng ?? (options.seed !== undefined ? mulberry32(options.seed) : Math.random);

  const N = standings.length;
  const slugIndex = new Map<TeamSlug, number>();
  for (let i = 0; i < N; i++) slugIndex.set(standings[i].slug, i);

  // Initial NRR components (RF, OF, RA, OB) per team — derived once from current NRR.
  const rf0 = new Float64Array(N);
  const of0 = new Float64Array(N);
  const ra0 = new Float64Array(N);
  const ob0 = new Float64Array(N);
  const points0 = new Int32Array(N);
  const won0 = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const s = standings[i];
    const c = approximateComponents(s.nrr, s.played - s.noResult);
    rf0[i] = c.runsFor;
    of0[i] = c.oversFor;
    ra0[i] = c.runsAgainst;
    ob0[i] = c.oversAgainst;
    points0[i] = s.points;
    won0[i] = s.won;
  }

  // Pre-resolve match data into parallel typed arrays for the hot loop.
  // For picks with explicit outcomes, pre-compute the exact innings totals
  // (winnerScore, winnerOvers, loserScore, loserOvers) so the inner loop
  // doesn't branch on outcome type.
  const M = remaining.length;
  const homeIdx = new Int32Array(M);
  const awayIdx = new Int32Array(M);
  const pickedWinnerIdx = new Int32Array(M); // -1 = no pick
  const pickedMarginRuns = new Float64Array(M); // NaN = sample, finite = exact-runs pick
  const pickedWinnerScore = new Float64Array(M);  // valid only if pickedExact[m] = 1
  const pickedWinnerOvers = new Float64Array(M);
  const pickedLoserScore = new Float64Array(M);
  const pickedLoserOvers = new Float64Array(M);
  const pickedExact = new Uint8Array(M); // 1 = use the exact innings totals above
  const pHomeWins = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    homeIdx[m] = slugIndex.get(remaining[m].home)!;
    awayIdx[m] = slugIndex.get(remaining[m].away)!;
    const pick = scenario[remaining[m].id];
    if (pick) {
      pickedWinnerIdx[m] = slugIndex.get(pick.winner)!;
      pickedMarginRuns[m] = pick.marginRuns ?? NaN;
      const out = pick.outcome;
      if (out?.type === "runs") {
        pickedExact[m] = 1;
        pickedWinnerScore[m] = parScore;
        pickedWinnerOvers[m] = 20;
        pickedLoserScore[m] = Math.max(parScore - out.marginRuns, 0);
        pickedLoserOvers[m] = 20;
      } else if (out?.type === "wickets") {
        pickedExact[m] = 1;
        // Loser batted first to par, winner chased and won with `ballsRemaining` to spare.
        pickedLoserScore[m] = parScore;
        pickedLoserOvers[m] = 20;
        pickedWinnerScore[m] = parScore + 1;
        pickedWinnerOvers[m] = 20 - out.ballsRemaining / 6;
      }
    } else {
      pickedWinnerIdx[m] = -1;
      pickedMarginRuns[m] = NaN;
    }
    if (options.priors) {
      const ph = options.priors[remaining[m].home] ?? 0.5;
      const pa = options.priors[remaining[m].away] ?? 0.5;
      pHomeWins[m] = ph + pa === 0 ? 0.5 : ph / (ph + pa);
    } else {
      pHomeWins[m] = 0.5;
    }
  }

  // Working buffers reused across iterations — no allocations in the hot loop.
  const rf = new Float64Array(N);
  const of = new Float64Array(N);
  const ra = new Float64Array(N);
  const ob = new Float64Array(N);
  const points = new Int32Array(N);
  const won = new Int32Array(N);
  const lost = new Int32Array(N);
  const playedDelta = new Int32Array(N);

  const qualifyHits = new Int32Array(N);
  const topSeedHits = new Int32Array(N);

  // Reusable standings array for tiebreaker sorting (one TeamStanding per team).
  const sortBuf: TeamStanding[] = new Array(N);
  for (let i = 0; i < N; i++) {
    sortBuf[i] = { ...standings[i] };
  }

  for (let it = 0; it < iterations; it++) {
    // Reset working buffers from initial state.
    rf.set(rf0);
    of.set(of0);
    ra.set(ra0);
    ob.set(ob0);
    points.set(points0);
    won.set(won0);
    lost.fill(0);
    playedDelta.fill(0);

    for (let m = 0; m < M; m++) {
      const h = homeIdx[m];
      const a = awayIdx[m];

      let winnerIdx: number;
      let winnerScore: number;
      let winnerOvers: number;
      let loserScore: number;
      let loserOvers: number;

      const pi = pickedWinnerIdx[m];
      if (pi >= 0 && pickedExact[m] === 1) {
        // Exact innings totals already computed (runs- or wickets-style win).
        winnerIdx = pi;
        winnerScore = pickedWinnerScore[m];
        winnerOvers = pickedWinnerOvers[m];
        loserScore = pickedLoserScore[m];
        loserOvers = pickedLoserOvers[m];
      } else {
        // No exact outcome: sample a winner (if not picked) and a runs margin.
        if (pi >= 0) {
          winnerIdx = pi;
        } else {
          winnerIdx = rng() < pHomeWins[m] ? h : a;
        }
        const margin = Number.isNaN(pickedMarginRuns[m])
          ? Math.abs(sampleNormal(pi >= 0 ? 15 : 0, marginStd, rng))
          : pickedMarginRuns[m];
        winnerScore = parScore;
        winnerOvers = 20;
        loserScore = Math.max(parScore - margin, 0);
        loserOvers = 20;
      }
      const loserIdx = winnerIdx === h ? a : h;

      points[winnerIdx] += 2;
      won[winnerIdx] += 1;
      lost[loserIdx] += 1;
      playedDelta[winnerIdx] += 1;
      playedDelta[loserIdx] += 1;

      rf[winnerIdx] += winnerScore;
      of[winnerIdx] += winnerOvers;
      ra[winnerIdx] += loserScore;
      ob[winnerIdx] += loserOvers;
      rf[loserIdx] += loserScore;
      of[loserIdx] += loserOvers;
      ra[loserIdx] += winnerScore;
      ob[loserIdx] += winnerOvers;
    }

    // Materialize standings into the reusable sort buffer.
    for (let i = 0; i < N; i++) {
      const init = standings[i];
      const s = sortBuf[i];
      s.played = init.played + playedDelta[i];
      s.won = won[i];
      s.lost = init.lost + lost[i];
      s.noResult = init.noResult;
      s.points = points[i];
      s.nrr = of[i] === 0 || ob[i] === 0 ? 0 : rf[i] / of[i] - ra[i] / ob[i];
    }

    const ranked = rankTeams(sortBuf, options.h2h);
    for (let r = 0; r < ranked.length; r++) {
      const idx = slugIndex.get(ranked[r].slug)!;
      if (r < playoffSpots) qualifyHits[idx] += 1;
      if (r === 0) topSeedHits[idx] += 1;
    }
  }

  const qualifyPct = {} as Record<TeamSlug, number>;
  const topSeedPct = {} as Record<TeamSlug, number>;
  for (let i = 0; i < N; i++) {
    const slug = standings[i].slug;
    qualifyPct[slug] = (100 * qualifyHits[i]) / iterations;
    topSeedPct[slug] = (100 * topSeedHits[i]) / iterations;
  }

  return { qualifyPct, topSeedPct, iterations };
}
