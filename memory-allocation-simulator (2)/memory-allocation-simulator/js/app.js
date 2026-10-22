/**
 * app.js
 * UI controller. Collects input, calls Validators / Allocator, renders output.
 * It contains NO allocation logic of its own.
 *
 * The five required GUI capabilities:
 *   1. Enter input            -> #blocks / #processes
 *   2. Select algorithm       -> Best Fit / Worst Fit buttons
 *   3. Execute simulation     -> button click handlers below
 *   4. View execution/results -> renderTable(), renderSummary(), renderMemoryMap()
 *   5. Compare both           -> runCompare() + renderComparison()
 */
(function () {
  "use strict";
  const { parseSizeList, InputValidationError } = window.Validators;
  const { bestFit, worstFit, summarize } = window.Allocator;

  const $ = (id) => document.getElementById(id);
  const COLORS = ["#2563eb", "#0d9488", "#7c3aed", "#b45309", "#db2777", "#4d7c0f", "#0369a1", "#9f1239"];

  /* ---------- input / error handling ---------- */
  function readInputs() {
    const blocks = parseSizeList($("blocks").value, "Memory Blocks");
    const processes = parseSizeList($("processes").value, "Process Sizes");
    return { blocks, processes };
  }
  function showError(msg, fieldIds) {
    const box = $("error");
    box.textContent = msg; box.hidden = false;
    ["blocks", "processes"].forEach((id) => $(id).classList.toggle("invalid", fieldIds.includes(id)));
  }
  function clearError() {
    $("error").hidden = true;
    ["blocks", "processes"].forEach((id) => $(id).classList.remove("invalid"));
  }
  /** Run `action` with validated input; show validation errors instead of crashing. */
  function guarded(action) {
    try {
      clearError();
      action(readInputs());
    } catch (e) {
      if (e instanceof InputValidationError) {
        showError(e.message, e.message.startsWith("Memory Blocks") ? ["blocks"]
                           : e.message.startsWith("Process Sizes") ? ["processes"] : []);
      } else { throw e; }
    }
  }

  /* ---------- rendering ---------- */
  function renderTable(runs) {
    const tbody = $("results-table").tBodies[0];
    tbody.innerHTML = "";
    runs.forEach(({ name, records }) => {
      records.forEach((r, i) => {
        const tr = tbody.insertRow();
        if (i === records.length - 1 && runs.length > 1) tr.className = "group-end";
        const cells = r.allocated
          ? [name, "P" + r.processIndex, r.processSize, "B" + r.blockIndex, r.blockSizeBefore, r.remaining, "Allocated"]
          : [name, "P" + r.processIndex, r.processSize, "-", "-", "-", "FAILED"];
        cells.forEach((c, ci) => {
          const td = tr.insertCell(); td.textContent = c;
          if (ci === 6) td.className = r.allocated ? "ok" : "fail";
        });
      });
    });
  }

  function statHtml(s, cls) {
    const item = (l, v) => `<div class="stat ${cls}"><div class="algo">${s.algorithm}</div><div class="label">${l}</div><div class="value">${v}</div></div>`;
    return item("Utilization", s.utilizationPercent + "%") +
           item("Fragmentation", s.internalFragmentation + " KB") +
           item("Allocated / Failed", `${s.processesFulfilled} / ${s.processesFailed}`);
  }
  function renderSummary(summaries) {
    $("summary").innerHTML = summaries.map((s) =>
      `<div class="stat-row">${statHtml(s, s.algorithm === "Worst Fit" ? "worst" : "")}</div>`).join("");
  }

  /** Draw each block as a bar split into the processes placed inside it. */
  function renderMemoryMap(blocks, runs) {
    const wrap = $("memory-map"); wrap.innerHTML = "";
    runs.forEach(({ name, records }) => {
      const title = document.createElement("div");
      title.className = "map-title"; title.textContent = name; wrap.appendChild(title);
      blocks.forEach((size, bi) => {
        const row = document.createElement("div"); row.className = "map-row";
        const bar = document.createElement("div"); bar.className = "map-bar";
        bar.style.width = Math.max(18, (size / Math.max(...blocks)) * 100) + "%";
        let used = 0;
        records.filter((r) => r.allocated && r.blockIndex === bi + 1).forEach((r) => {
          const seg = document.createElement("div"); seg.className = "seg";
          seg.style.width = (r.processSize / size) * 100 + "%";
          seg.style.background = COLORS[(r.processIndex - 1) % COLORS.length];
          seg.textContent = "P" + r.processIndex; seg.title = `P${r.processIndex}: ${r.processSize} KB`;
          bar.appendChild(seg); used += r.processSize;
        });
        if (size - used > 0) {
          const free = document.createElement("div"); free.className = "seg free";
          free.style.width = ((size - used) / size) * 100 + "%";
          free.textContent = size - used; bar.appendChild(free);
        }
        const lab = document.createElement("div"); lab.className = "legend"; lab.textContent = `B${bi + 1} (${size} KB)`;
        row.appendChild(bar); row.appendChild(lab); wrap.appendChild(row);
      });
    });
    $("map-card").hidden = false;
  }

  function renderComparison(b, w) {
    // [label, best value, worst value, "higher" | "lower" is better]
    const rows = [
      ["Total Memory (KB)", b.totalMemory, w.totalMemory, null],
      ["Memory Utilization (%)", b.utilizationPercent, w.utilizationPercent, "higher"],
      ["Internal Fragmentation (KB)", b.internalFragmentation, w.internalFragmentation, "lower"],
      ["Unused Block Space (KB)", b.unusedBlocks, w.unusedBlocks, null],
      ["Processes Fulfilled", b.processesFulfilled, w.processesFulfilled, "higher"],
      ["Processes Failed", b.processesFailed, w.processesFailed, "lower"],
    ];
    const tbody = $("compare-table").tBodies[0]; tbody.innerHTML = "";
    rows.forEach(([label, bv, wv, better]) => {
      const tr = tbody.insertRow();
      const p = tr.insertCell(); p.textContent = label; p.className = "param";
      const bc = tr.insertCell(); bc.textContent = bv;
      const wc = tr.insertCell(); wc.textContent = wv;
      if (better && bv !== wv) {
        const bestWins = better === "higher" ? bv > wv : bv < wv;
        (bestWins ? bc : wc).classList.add("win");
      }
    });

    let verdict;
    if (b.processesFulfilled > w.processesFulfilled || b.utilizationPercent > w.utilizationPercent) {
      verdict = `Best Fit placed ${b.processesFulfilled} process(es) at ${b.utilizationPercent}% utilization versus ${w.processesFulfilled} at ${w.utilizationPercent}% for Worst Fit.`;
      if (w.processesFailed > b.processesFailed) verdict += " Worst Fit used up its large blocks early, so a later process had no block big enough.";
      if (w.internalFragmentation < b.internalFragmentation) verdict += " Worst Fit's lower fragmentation figure only reflects that it allocated less memory overall - read fragmentation together with utilization.";
    } else if (w.processesFulfilled > b.processesFulfilled || w.utilizationPercent > b.utilizationPercent) {
      verdict = `Worst Fit performed better on this input: ${w.processesFulfilled} process(es) at ${w.utilizationPercent}% utilization versus ${b.processesFulfilled} at ${b.utilizationPercent}% for Best Fit.`;
    } else {
      verdict = "Both algorithms gave identical results on this input (there was no real choice between blocks, or every choice was equivalent).";
    }
    $("verdict").textContent = verdict;
    $("compare-card").hidden = false;
  }

  /* ---------- actions ---------- */
  function runSingle(name, fn) {
    guarded(({ blocks, processes }) => {
      const records = fn(blocks, processes);
      const summary = summarize(name, blocks, records);
      renderTable([{ name, records }]);
      renderSummary([summary]);
      renderMemoryMap(blocks, [{ name, records }]);
      $("compare-card").hidden = true;
    });
  }
  function runCompare() {
    guarded(({ blocks, processes }) => {
      const bRec = bestFit(blocks, processes), wRec = worstFit(blocks, processes);
      const bSum = summarize("Best Fit", blocks, bRec), wSum = summarize("Worst Fit", blocks, wRec);
      const runs = [{ name: "Best Fit", records: bRec }, { name: "Worst Fit", records: wRec }];
      renderTable(runs);
      renderSummary([bSum, wSum]);
      renderMemoryMap(blocks, runs);
      renderComparison(bSum, wSum);
    });
  }
  function reset() {
    $("blocks").value = ""; $("processes").value = "";
    clearError();
    $("results-table").tBodies[0].innerHTML = "";
    $("summary").innerHTML = '<p class="placeholder">Run an algorithm to see performance parameters.</p>';
    $("map-card").hidden = true; $("compare-card").hidden = true;
    $("blocks").focus();
  }
  function exitApp() {
    reset();
    document.body.innerHTML = '<main class="container"><section class="card"><h2>Simulator closed</h2><p>Reload the page to start again.</p></section></main>';
    window.close(); // works only if the tab was opened by a script; harmless otherwise
  }

  $("btn-best").addEventListener("click", () => runSingle("Best Fit", bestFit));
  $("btn-worst").addEventListener("click", () => runSingle("Worst Fit", worstFit));
  $("btn-compare").addEventListener("click", runCompare);
  $("btn-reset").addEventListener("click", reset);
  $("btn-exit").addEventListener("click", exitApp);
  ["blocks", "processes"].forEach((id) =>
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") runCompare(); }));
})();
