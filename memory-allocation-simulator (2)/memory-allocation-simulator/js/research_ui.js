/**
 * research_ui.js
 * UI controller for Research Mode (Stage 3): tab switching, reading and validating the
 * experiment settings, running the experiment seed by seed (so the page stays responsive)
 * and rendering the results table, bar charts and verdict.
 * It contains NO allocation logic - that lives in research.js.
 */
(function () {
  "use strict";
  const { InputValidationError } = window.Validators;
  const R = window.Research;

  const $ = (id) => document.getElementById(id);
  const COLORS = { first: "#0d9488", best: "#2563eb", worst: "#b45309" };
  // [key, label, "min" | "max" is better, decimals]
  const METRICS = [
    ["utilization", "Utilization %", "max", 1],
    ["internalFrag", "Internal frag. %", "min", 1],
    ["externalFrag", "External frag. %", "min", 1],
    ["failureRate", "Failure rate %", "min", 1],
    ["searchSteps", "Search steps / request", "min", 1],
  ];
  let running = false;

  /* ---------- tabs ---------- */
  function showTab(which) {
    const research = which === "research";
    $("classic-view").hidden = research;
    $("research-view").hidden = !research;
    $("tab-classic").classList.toggle("active", !research);
    $("tab-research").classList.toggle("active", research);
    $("tab-classic").setAttribute("aria-selected", String(!research));
    $("tab-research").setAttribute("aria-selected", String(research));
  }

  /* ---------- input / error handling ---------- */
  const FIELDS = { heapSize: "r-heap", events: "r-events", seeds: "r-seeds", targetFill: "r-fill" };

  /** Strict whole-number parse; anything else becomes NaN so validateConfig rejects it. */
  const toInt = (text) => (/^\s*\d+\s*$/.test(text) ? parseInt(text, 10) : NaN);

  function readConfig() {
    return {
      scenario: $("r-scenario").value,
      heapSize: toInt($("r-heap").value),
      events: toInt($("r-events").value),
      seeds: toInt($("r-seeds").value),
      targetFill: toInt($("r-fill").value),
    };
  }
  function showError(msg) {
    const box = $("r-error"); box.textContent = msg; box.hidden = false;
    const labelToField = { "Heap size": "r-heap", "Events": "r-events", "Runs": "r-seeds", "Target fill": "r-fill" };
    Object.values(FIELDS).forEach((id) => $(id).classList.remove("invalid"));
    for (const [label, id] of Object.entries(labelToField)) if (msg.startsWith(label)) $(id).classList.add("invalid");
  }
  function clearError() {
    $("r-error").hidden = true;
    Object.values(FIELDS).forEach((id) => $(id).classList.remove("invalid"));
  }

  /* ---------- rendering ---------- */
  const fmt = (m, d) => `${m.mean.toFixed(d)} \u00b1 ${m.sd.toFixed(1)}`;

  function renderTable(res) {
    const tbody = $("r-table").tBodies[0]; tbody.innerHTML = "";
    const winner = {};
    METRICS.forEach(([k, , dir]) => {
      const vals = R.ALGORITHMS.map((a) => res[a][k].mean);
      winner[k] = dir === "max" ? Math.max(...vals) : Math.min(...vals);
    });
    R.ALGORITHMS.forEach((a) => {
      const tr = tbody.insertRow();
      const name = tr.insertCell(); name.textContent = R.ALGO_NAMES[a]; name.className = "param";
      METRICS.forEach(([k, , , d]) => {
        const td = tr.insertCell(); td.textContent = fmt(res[a][k], d);
        if (Math.abs(res[a][k].mean - winner[k]) < 1e-9) td.classList.add("win");
      });
    });
  }

  /** Simple CSS bar chart for one parameter (no chart library needed). */
  function renderCharts(res) {
    const wrap = $("r-charts"); wrap.innerHTML = "";
    [["failureRate", "Allocation failure rate (%)"], ["externalFrag", "External fragmentation (%)"], ["searchSteps", "Search cost (free blocks / request)"]]
      .forEach(([k, title]) => {
        const box = document.createElement("div"); box.className = "chart";
        const h = document.createElement("div"); h.className = "chart-title"; h.textContent = title; box.appendChild(h);
        const max = Math.max(...R.ALGORITHMS.map((a) => res[a][k].mean), 1e-9);
        R.ALGORITHMS.forEach((a) => {
          const row = document.createElement("div"); row.className = "bar-row";
          const lab = document.createElement("span"); lab.className = "bar-label"; lab.textContent = R.ALGO_NAMES[a];
          const track = document.createElement("div"); track.className = "bar-track";
          const bar = document.createElement("div"); bar.className = "bar-fill";
          bar.style.width = Math.max(2, (res[a][k].mean / max) * 100) + "%";
          bar.style.background = COLORS[a];
          const val = document.createElement("span"); val.className = "bar-value"; val.textContent = res[a][k].mean.toFixed(1);
          track.appendChild(bar); row.appendChild(lab); row.appendChild(track); row.appendChild(val); box.appendChild(row);
        });
        wrap.appendChild(box);
      });
  }

  function renderVerdict(res, cfg) {
    const A = R.ALGORITHMS, N = R.ALGO_NAMES;
    const by = (k, fn) => A.reduce((p, c) => (fn(res[c][k].mean, res[p][k].mean) ? c : p));
    const lowFail = by("failureRate", (x, y) => x < y), highFail = by("failureRate", (x, y) => x > y);
    const cheap = by("searchSteps", (x, y) => x < y);
    const lowExt = by("externalFrag", (x, y) => x < y);
    let text = `${N[lowFail]} had the lowest failure rate (${res[lowFail].failureRate.mean.toFixed(1)}%) and ` +
               `${N[highFail]} the highest (${res[highFail].failureRate.mean.toFixed(1)}%). ` +
               `${N[lowExt]} kept free memory least fragmented (external fragmentation ${res[lowExt].externalFrag.mean.toFixed(1)}%). ` +
               `${N[cheap]} was the cheapest to search (${res[cheap].searchSteps.mean.toFixed(1)} free blocks per request)`;
    if (cheap !== "best") text += `, while Best Fit needed ${(res.best.searchSteps.mean / res[cheap].searchSteps.mean).toFixed(1)}\u00d7 as many`;
    text += ". ";
    const gap = Math.abs(res.first.failureRate.mean - res.best.failureRate.mean);
    const spread = Math.max(res.first.failureRate.sd, res.best.failureRate.sd);
    if (gap <= 1.5 * spread) text += "First Fit and Best Fit are close on failures here (difference within about one standard deviation), so the choice between them is mainly speed versus memory.";
    text += ` (Settings: scenario ${cfg.scenario}, ${cfg.heapSize} B heap, ${cfg.events} events, ${cfg.seeds} runs, ${cfg.targetFill}% target fill.)`;
    $("r-verdict").textContent = text;
  }

  /* ---------- actions ---------- */
  function runExperiment() {
    if (running) return;
    let cfg;
    try { clearError(); cfg = R.validateConfig(readConfig()); }
    catch (e) { if (e instanceof InputValidationError) { showError(e.message); return; } throw e; }

    running = true; $("r-run").disabled = true;
    const perSeed = []; let seed = 1;
    const step = () => {
      perSeed.push(R.runSeed(cfg, seed));
      $("r-progress").textContent = `Running... ${seed} / ${cfg.seeds} runs`;
      if (seed < cfg.seeds) { seed++; setTimeout(step, 0); return; }   // yield so the page stays responsive
      const res = R.aggregate(perSeed);
      renderTable(res); renderCharts(res); renderVerdict(res, cfg);
      $("r-results-card").hidden = false;
      $("r-progress").textContent = `Done: ${cfg.seeds} runs x 3 algorithms.`;
      running = false; $("r-run").disabled = false;
    };
    setTimeout(step, 0);
  }

  function resetDefaults() {
    if (running) return;
    const d = R.DEFAULTS;
    $("r-scenario").value = d.scenario; $("r-heap").value = d.heapSize; $("r-events").value = d.events;
    $("r-seeds").value = d.seeds; $("r-fill").value = d.targetFill;
    clearError(); $("r-progress").textContent = ""; $("r-results-card").hidden = true;
  }

  $("tab-classic").addEventListener("click", () => showTab("classic"));
  $("tab-research").addEventListener("click", () => showTab("research"));
  $("r-run").addEventListener("click", runExperiment);
  $("r-defaults").addEventListener("click", resetDefaults);
  Object.values(FIELDS).forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") runExperiment(); }));
})();
