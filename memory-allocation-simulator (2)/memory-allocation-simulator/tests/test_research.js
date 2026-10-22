/**
 * Unit tests for Research Mode - run with:  node tests/test_research.js
 */
const assert = require("assert");
const R = require("../js/research.js");
const V = require("../js/validators.js");
const A = require("../js/allocator.js");

const tests = {
  first_fit_takes_first_block_that_fits() {
    const h = new R.Heap(1000, "first");
    h.blocks = [{ size: 100, free: true, req: 0 }, { size: 300, free: true, req: 0 }, { size: 200, free: true, req: 0 }];
    h.alloc(150);
    assert.strictEqual(h.blocks[1].free, false); // the 300-byte block, not the later 200-byte one
  },
  best_fit_takes_smallest_block_that_fits() {
    const h = new R.Heap(1000, "best");
    h.blocks = [{ size: 400, free: true, req: 0 }, { size: 160, free: true, req: 0 }, { size: 200, free: true, req: 0 }];
    h.alloc(150);
    assert.strictEqual(h.blocks[1].free, false); // 160 is the tightest fit
  },
  worst_fit_takes_largest_block() {
    const h = new R.Heap(1000, "worst");
    h.blocks = [{ size: 400, free: true, req: 0 }, { size: 160, free: true, req: 0 }, { size: 200, free: true, req: 0 }];
    h.alloc(150);
    assert.strictEqual(h.blocks[0].free, false);
  },
  alloc_fails_when_no_block_is_large_enough() {
    const h = new R.Heap(100, "best");
    assert.strictEqual(h.alloc(500), null);
  },
  small_leftover_is_not_split() {
    const h = new R.Heap(104, "first");
    const b = h.alloc(100);               // aligned to 104, nothing left to split
    assert.strictEqual(h.blocks.length, 1);
    assert.strictEqual(b.size, 104);
  },
  free_merges_adjacent_free_blocks() {
    const h = new R.Heap(1000, "first");
    const a = h.alloc(100), b = h.alloc(200), c = h.alloc(300);
    h.free(a); h.free(c); h.free(b);      // release in an awkward order
    assert.strictEqual(h.blocks.length, 1);
    assert.strictEqual(h.blocks[0].size, 1000);
    assert.strictEqual(h.blocks[0].free, true);
  },
  same_seed_gives_same_result() {
    const cfg = { scenario: "A", heapSize: 16384, events: 500, seeds: 1, targetFill: 75 };
    assert.deepStrictEqual(R.runSeed(cfg, 7), R.runSeed(cfg, 7));
  },
  matches_report_values_for_scenario_A() {
    const cfg = { scenario: "A", heapSize: 16384, events: 10000, seeds: 30, targetFill: 75 };
    const r = R.runExperiment(cfg);
    const near = (x, y) => Math.abs(x - y) < 0.05;
    assert.ok(near(r.best.failureRate.mean, 3.26));
    assert.ok(near(r.worst.failureRate.mean, 30.17));
    assert.ok(near(r.first.searchSteps.mean, 11.35));
  },
  worst_fit_is_worst_and_first_fit_is_cheapest() {
    for (const scenario of ["A", "B"]) {
      const r = R.runExperiment({ scenario, heapSize: 16384, events: 3000, seeds: 5, targetFill: 75 });
      assert.ok(r.worst.failureRate.mean > r.best.failureRate.mean, `${scenario}: worst fit should fail more`);
      assert.ok(r.worst.externalFrag.mean > r.best.externalFrag.mean);
      assert.ok(r.first.searchSteps.mean < r.best.searchSteps.mean);
    }
  },
  config_validation_rejects_bad_settings() {
    const ok = { scenario: "A", heapSize: 16384, events: 1000, seeds: 3, targetFill: 75 };
    assert.doesNotThrow(() => R.validateConfig(ok));
    const bad = [{ scenario: "Z" }, { heapSize: NaN }, { heapSize: 100 }, { events: 5 }, { seeds: 0 },
                 { seeds: 101 }, { targetFill: 99 }, { targetFill: 1.5 }];
    for (const patch of bad)
      assert.throws(() => R.validateConfig({ ...ok, ...patch }), V.InputValidationError, JSON.stringify(patch));
  },
  stage2_results_unchanged() {
    const b = [100, 500, 200, 300, 600], p = [212, 417, 112, 426];
    assert.strictEqual(A.summarize("Best Fit", b, A.bestFit(b, p)).utilizationPercent, 68.65);
    assert.strictEqual(A.summarize("Worst Fit", b, A.worstFit(b, p)).utilizationPercent, 43.59);
  },
};

let pass = 0;
for (const [name, fn] of Object.entries(tests)) { fn(); pass++; console.log("PASS  " + name); }
console.log(`\n${pass}/${Object.keys(tests).length} tests passed.`);
