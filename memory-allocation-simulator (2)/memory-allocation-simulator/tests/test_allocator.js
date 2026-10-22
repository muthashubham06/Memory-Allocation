/**
 * Unit tests - run with:  node tests/test_allocator.js
 */
const assert = require("assert");
const A = require("../js/allocator.js");
const V = require("../js/validators.js");

const tests = {
  best_fit_textbook_example() {
    const r = A.bestFit([100, 500, 200, 300, 600], [212])[0];
    assert.strictEqual(r.allocated, true);
    assert.strictEqual(r.blockIndex, 4);   // 300 KB block
    assert.strictEqual(r.remaining, 88);
  },
  worst_fit_textbook_example() {
    const r = A.worstFit([100, 500, 200, 300, 600], [212])[0];
    assert.strictEqual(r.blockIndex, 5);   // 600 KB block
    assert.strictEqual(r.remaining, 388);
  },
  allocation_failure_edge_case() {
    const r = A.bestFit([50, 80], [999])[0];
    assert.strictEqual(r.allocated, false);
    assert.strictEqual(r.blockIndex, null);
  },
  exact_fit_leaves_zero_remaining() {
    assert.strictEqual(A.bestFit([128], [128])[0].remaining, 0);
  },
  best_fit_summary_matches_python_version() {
    const b = [100, 500, 200, 300, 600];
    const s = A.summarize("Best Fit", b, A.bestFit(b, [212, 417, 112, 426]));
    assert.strictEqual(s.totalMemory, 1700);
    assert.strictEqual(s.utilizationPercent, 68.65);
    assert.strictEqual(s.internalFragmentation, 433);
  },
  worst_fit_runs_out_of_large_blocks() {
    const b = [100, 500, 200, 300, 600];
    const s = A.summarize("Worst Fit", b, A.worstFit(b, [212, 417, 112, 426]));
    assert.strictEqual(s.processesFailed, 1);
    assert.strictEqual(s.utilizationPercent, 43.59);
    assert.strictEqual(s.internalFragmentation, 359);
  },
  summary_correct_when_one_block_reused() {
    const s = A.summarize("Best Fit", [1000], A.bestFit([1000], [200, 300, 150]));
    assert.strictEqual(s.internalFragmentation, 350); // not double-counted
  },
  input_is_not_modified() {
    const b = [100, 200]; A.bestFit(b, [50]);
    assert.deepStrictEqual(b, [100, 200]);
  },
  validation_rejects_bad_input() {
    for (const bad of ["", "   ", "100, abc", "100,,200", "100, 0", "-5", "1.5", "12abc"])
      assert.throws(() => V.parseSizeList(bad, "Field"), V.InputValidationError, `should reject "${bad}"`);
    assert.deepStrictEqual(V.parseSizeList(" 100 , 200 ", "Field"), [100, 200]);
  },
};

let pass = 0;
for (const [name, fn] of Object.entries(tests)) { fn(); pass++; console.log("PASS  " + name); }
console.log(`\n${pass}/${Object.keys(tests).length} tests passed.`);
