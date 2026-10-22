/**
 * research.js
 * Research Mode (Stage 3): dynamic heap evaluation of First Fit, Best Fit and Worst Fit.
 *
 * Research approach taken from Al Abdi, Alqudah & Helmy, "Dynamic Memory Management
 * Evaluation for IoT-Based Operating Systems" - the allocation strategy is a replaceable
 * part of a heap that serves BOTH allocation and release requests, and every strategy is
 * evaluated on the same workload.
 *
 * Contains no DOM code, so it can be unit-tested in Node (tests/test_research.js).
 */
(function (root) {
  "use strict";

  const V = typeof require !== "undefined" ? require("./validators.js") : root.Validators;

  const ALIGN = 8;       // allocation granularity (bytes)
  const MIN_SPLIT = 16;  // a leftover smaller than this is NOT split -> internal fragmentation
  const ALGORITHMS = ["first", "best", "worst"];
  const ALGO_NAMES = { first: "First Fit", best: "Best Fit", worst: "Worst Fit" };

  /** Request-size mixes: [probability, minBytes, maxBytes]. */
  const SCENARIOS = {
    A: { label: "A: Mixed sensor node",  mix: [[0.60, 16, 64], [0.30, 96, 256], [0.10, 512, 1024]] },
    B: { label: "B: Small-packet heavy", mix: [[0.85, 16, 48], [0.13, 64, 160], [0.02, 512, 768]] },
  };

  const DEFAULTS = { scenario: "A", heapSize: 16384, events: 10000, seeds: 30, targetFill: 75 };
  const LIMITS = {
    heapSize: [2048, 1048576],  // bytes (largest request in any scenario is 1024 B)
    events: [100, 50000],
    seeds: [1, 100],
    targetFill: [10, 95],       // percent
  };

  const alignUp = (n) => Math.ceil(n / ALIGN) * ALIGN;

  /** Small seeded random-number generator -> experiments are repeatable. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * One contiguous heap kept as an address-ordered list of blocks.
   * The strategy ("first" | "best" | "worst") is the ONLY thing that differs between runs.
   */
  class Heap {
    constructor(size, strategy) {
      this.size = size;
      this.strategy = strategy;
      this.blocks = [{ size, free: true, req: 0 }];
      this.steps = 0; // free blocks examined so far (search-cost counter)
    }

    /** @returns {Object|null} the allocated block, or null if no free block is large enough */
    alloc(req) {
      const need = alignUp(req);
      let pick = -1;
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        if (!b.free) continue;
        this.steps++;
        if (b.size < need) continue;                                   // too small -> skip
        if (this.strategy === "first") { pick = i; break; }            // first that fits
        if (pick === -1) { pick = i; continue; }                       // first candidate
        if (this.strategy === "best" && b.size < this.blocks[pick].size) pick = i;   // smallest fit
        if (this.strategy === "worst" && b.size > this.blocks[pick].size) pick = i;  // largest fit
      }
      if (pick === -1) return null;

      const chosen = this.blocks[pick];
      const left = chosen.size - need;
      if (left >= MIN_SPLIT) {                                         // split; leftover stays free
        chosen.size = need;
        this.blocks.splice(pick + 1, 0, { size: left, free: true, req: 0 });
      }
      chosen.free = false;
      chosen.req = req;
      return chosen;
    }

    /** Release a block and merge it with free neighbours (coalescing). */
    free(block) {
      const i = this.blocks.indexOf(block);
      block.free = true; block.req = 0;
      if (i + 1 < this.blocks.length && this.blocks[i + 1].free) {
        block.size += this.blocks[i + 1].size;
        this.blocks.splice(i + 1, 1);
      }
      if (i > 0 && this.blocks[i - 1].free) {
        this.blocks[i - 1].size += block.size;
        this.blocks.splice(i, 1);
      }
    }

    /** Snapshot used to compute the performance parameters. */
    stats() {
      let live = 0, allocated = 0, freeTotal = 0, largestFree = 0;
      for (const b of this.blocks) {
        if (b.free) { freeTotal += b.size; if (b.size > largestFree) largestFree = b.size; }
        else { live += b.req; allocated += b.size; }
      }
      return { live, internal: allocated - live, freeTotal, largestFree };
    }
  }

  /** Pre-generate the event sequence so all strategies replay the SAME workload. */
  function makeEvents(rnd, mix, count) {
    const events = [];
    for (let i = 0; i < count; i++) {
      const allocR = rnd();
      const r = rnd();
      let size = 0, acc = 0;
      for (const [p, lo, hi] of mix) {
        acc += p;
        if (r <= acc) { size = lo + Math.floor(rnd() * (hi - lo + 1)); break; }
      }
      if (!size) size = mix[mix.length - 1][1];
      events.push({ allocR, size, pickR: rnd() });
    }
    return events;
  }

  /** Run one strategy over one event list; returns the performance parameters. */
  function simulate(strategy, heapSize, events, targetFill) {
    const heap = new Heap(heapSize, strategy);
    const live = [];
    let liveBytes = 0, allocs = 0, fails = 0, searchSteps = 0;
    let utilSum = 0, intSum = 0, extSum = 0, extCount = 0;

    for (const e of events) {
      // steady-state load: allocate more often below the target fill, free more often above it
      const pAlloc = liveBytes < targetFill * heapSize ? 0.6 : 0.4;
      if (e.allocR < pAlloc || live.length === 0) {
        allocs++;
        const before = heap.steps;
        const block = heap.alloc(e.size);
        searchSteps += heap.steps - before;
        if (block) { live.push(block); liveBytes += e.size; } else { fails++; }
      } else {
        const idx = Math.floor(e.pickR * live.length);
        liveBytes -= live[idx].req;
        heap.free(live[idx]);
        live[idx] = live[live.length - 1];
        live.pop();
      }
      const st = heap.stats();
      utilSum += st.live / heapSize;
      intSum += st.internal / heapSize;
      if (st.freeTotal > 0) { extSum += 1 - st.largestFree / st.freeTotal; extCount++; }
    }

    const n = events.length;
    return {
      utilization: (100 * utilSum) / n,
      internalFrag: (100 * intSum) / n,
      externalFrag: extCount ? (100 * extSum) / extCount : 0,
      failureRate: allocs ? (100 * fails) / allocs : 0,
      searchSteps: allocs ? searchSteps / allocs : 0,
    };
  }

  /** @throws {InputValidationError} with a message that can be shown to the user */
  function validateConfig(cfg) {
    const E = V.InputValidationError;
    if (!SCENARIOS[cfg.scenario]) throw new E("Scenario: please choose scenario A or B.");
    const fields = [["heapSize", "Heap size (bytes)"], ["events", "Events"], ["seeds", "Runs"], ["targetFill", "Target fill (%)"]];
    for (const [key, label] of fields) {
      const v = cfg[key];
      if (typeof v !== "number" || !Number.isInteger(v)) throw new E(`${label}: please enter a whole number.`);
      const [lo, hi] = LIMITS[key];
      if (v < lo || v > hi) throw new E(`${label}: must be between ${lo} and ${hi}.`);
    }
    return cfg;
  }

  /** Run all three strategies for ONE seed. Returns { first, best, worst }. */
  function runSeed(cfg, seed) {
    const events = makeEvents(mulberry32(1000 + seed), SCENARIOS[cfg.scenario].mix, cfg.events);
    const out = {};
    for (const a of ALGORITHMS) out[a] = simulate(a, cfg.heapSize, events, cfg.targetFill / 100);
    return out;
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

  /** Combine per-seed results into mean and standard deviation per strategy and parameter. */
  function aggregate(perSeed) {
    const result = {};
    for (const a of ALGORITHMS) {
      result[a] = {};
      for (const k of Object.keys(perSeed[0][a])) {
        const vals = perSeed.map((r) => r[a][k]);
        result[a][k] = { mean: mean(vals), sd: sd(vals) };
      }
    }
    return result;
  }

  /** Convenience: validate, run every seed and aggregate (the UI calls runSeed itself to stay responsive). */
  function runExperiment(cfg) {
    validateConfig(cfg);
    const perSeed = [];
    for (let s = 1; s <= cfg.seeds; s++) perSeed.push(runSeed(cfg, s));
    return aggregate(perSeed);
  }

  const api = { Heap, SCENARIOS, DEFAULTS, LIMITS, ALGORITHMS, ALGO_NAMES, mulberry32, makeEvents,
                simulate, validateConfig, runSeed, aggregate, runExperiment };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Research = api;
})(typeof window !== "undefined" ? window : globalThis);
