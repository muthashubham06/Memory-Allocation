/**
 * allocator.js
 * Best Fit / Worst Fit dynamic-partition allocation plus performance metrics
 * (mirrors memory_allocator.py). Contains no DOM code, so it can be unit-tested
 * in Node without a browser.
 */
(function (root) {
  "use strict";

  const V = typeof require !== "undefined" ? require("./validators.js") : root.Validators;

  /**
   * Shared engine. `mode` ("best" | "worst") only changes ONE comparison, so the
   * two algorithms can never drift apart.
   * @param {number[]} blocks     free block sizes in KB
   * @param {number[]} processes  process sizes in KB (allocated in order)
   * @param {"best"|"worst"} mode
   * @returns {Array<Object>} one record per process
   */
  function run(blocks, processes, mode) {
    V.validateNonEmptyLists(blocks, processes);

    const working = blocks.slice(); // private copy - caller's data is never modified
    const records = [];

    processes.forEach((pSize, i) => {
      let chosen = -1;

      for (let b = 0; b < working.length; b++) {
        if (working[b] < pSize) continue;            // too small -> skip
        if (chosen === -1) { chosen = b; continue; } // first candidate
        if (mode === "best" && working[b] < working[chosen]) chosen = b;  // smallest fit
        if (mode === "worst" && working[b] > working[chosen]) chosen = b; // largest fit
      }

      if (chosen === -1) {
        // Edge case: nothing is big enough -> report FAILED, keep going
        records.push({ processIndex: i + 1, processSize: pSize, blockIndex: null,
                       blockSizeBefore: null, remaining: null, allocated: false });
        return;
      }

      const before = working[chosen];
      working[chosen] = before - pSize; // split: leftover stays available
      records.push({ processIndex: i + 1, processSize: pSize, blockIndex: chosen + 1,
                     blockSizeBefore: before, remaining: working[chosen], allocated: true });
    });

    return records;
  }

  const bestFit = (blocks, processes) => run(blocks, processes, "best");
  const worstFit = (blocks, processes) => run(blocks, processes, "worst");

  /**
   * Performance parameters for one finished run.
   * Fragmentation = original size of USED blocks - everything allocated from them
   * (summing per-step leftovers would double-count reused blocks).
   */
  function summarize(algorithm, blocks, records) {
    const done = records.filter((r) => r.allocated);
    const failed = records.filter((r) => !r.allocated);

    const totalMemory = blocks.reduce((a, b) => a + b, 0);
    const totalAllocated = done.reduce((a, r) => a + r.processSize, 0);

    const touched = new Set(done.map((r) => r.blockIndex));
    let touchedOriginal = 0, unusedBlocks = 0;
    blocks.forEach((size, i) => (touched.has(i + 1) ? (touchedOriginal += size) : (unusedBlocks += size)));

    return {
      algorithm,
      totalMemory,
      totalAllocated,
      processesFulfilled: done.length,
      processesFailed: failed.length,
      utilizationPercent: totalMemory ? Math.round((totalAllocated / totalMemory) * 10000) / 100 : 0,
      internalFragmentation: touchedOriginal - totalAllocated,
      unusedBlocks,
    };
  }

  const api = { bestFit, worstFit, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Allocator = api;
})(typeof window !== "undefined" ? window : globalThis);
