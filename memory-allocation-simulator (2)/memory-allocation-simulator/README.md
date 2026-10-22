# Memory Allocation Simulator - Best Fit vs Worst Fit (HTML / CSS / JS)

Web version of the Operating System Self-Learning Activity - 1 (Shah & Anchor Kutchhi Engineering College, 2026-27).
Authors: Parth Bidve (03), Shubham Mutha (30)

| Stage | What was added |
|-------|----------------|
| Stage 1 | Theory, Best Fit / Worst Fit, research-paper review, GUI design |
| Stage 2 | Working web model: validated input, both algorithms, results table, memory map, comparison |
| Stage 3 | **Research Mode** - dynamic heap (allocate + free + merge) with First Fit, Best Fit and Worst Fit, new parameters, repeated experiments |

## Run
Double-click `index.html` (any modern browser). No installation, no internet, no server needed.
The whole simulator is plain HTML, CSS and JavaScript - nothing to install. (The files in `tests/` are optional unit tests for developers; they need Node.js and are not needed to use the simulator.)

## Two modes (tabs at the top of the page)

### Classic Mode (Stage 2)
1. Enter input - two comma-separated fields (sizes in KB)
2. Select algorithm - Best Fit / Worst Fit buttons
3. Execute - click a button (or press Enter to compare)
4. View results - per-process table, summary cards, visual memory map
5. Compare - "Compare Both" shows a side-by-side table with the better value highlighted

Parameters: memory utilization %, internal fragmentation (KB), unused block space (KB), processes fulfilled / failed.

### Research Mode (Stage 3)
Implements one research approach from Al Abdi, Alqudah & Helmy, *Dynamic Memory Management Evaluation for IoT-Based Operating Systems*
(Contiki-NG heap study): the allocation strategy is a replaceable part of a heap that handles **both allocation and release**, and every strategy is evaluated on the **same** workload.

* Strategies: First Fit, Best Fit, Worst Fit
* One contiguous heap, block splitting (minimum leftover 16 B, 8 B alignment), release with merging of free neighbours
* Seeded random workloads (scenario A: mixed sensor node, B: small-packet heavy), results averaged over several runs (mean +/- SD)
* Parameters: utilization %, internal fragmentation %, external fragmentation %, allocation failure rate %, search steps per request
* Settings are validated (heap 2048-1,048,576 B, events 100-50,000, runs 1-100, target fill 10-95 %)

Default settings (16 KB heap, 10,000 events, 30 runs, 75 % target fill) give, for scenario A:

| Algorithm | Utilization % | External frag. % | Failure rate % | Search steps |
|-----------|--------------:|-----------------:|---------------:|-------------:|
| First Fit | 72.7 | 72.6 | 3.7 | 11.4 |
| Best Fit  | 72.8 | 71.7 | 3.3 | 20.1 |
| Worst Fit | 60.7 | 96.1 | 30.2 | 88.1 |

Limitation: this is a software model of a heap, not the real Contiki-NG heap module, and the workloads are synthetic.

## Files
| File | Responsibility |
|------|----------------|
| `index.html`        | Page structure: tabs, Classic Mode, Research Mode |
| `css/style.css`     | All styling (responsive) |
| `js/validators.js`  | Input parsing and validation (empty, non-numeric, zero/negative, stray commas, limits) |
| `js/allocator.js`   | Classic Best Fit / Worst Fit engine and metrics (no DOM code) |
| `js/app.js`         | Classic Mode UI controller |
| `js/research.js`    | Research Mode engine: heap, strategies, workloads, metrics (no DOM code) |
| `js/research_ui.js` | Research Mode UI controller: tabs, settings, table, charts, verdict |
| `tests/test_allocator.js` | 9 unit tests for Classic Mode |
| `tests/test_research.js`  | 11 unit tests for Research Mode |
| `docs/`             | Screenshots |

## Screenshots
![Research Mode](docs/research_mode.png)
