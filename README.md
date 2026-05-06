# NSICX Inflation Expectations Dashboard

**Live dashboard:** https://jasonzhixinglu.github.io/nsicx-dashboard/

An interactive companion to the working paper *A Composite Term Structure of Japan's Inflation Expectations* (Lu & Teoh, IMF Working Paper). The dashboard hosts two views, switched via a link in the header:

- **Japan composite** (default landing) — the six-source composite from the paper.
- **Multi-country** — the same Nelson–Siegel internally consistent expectations (NSICX) framework applied to 15 G20 economies using a single source (Consensus Economics) for cross-country comparability. Within-CY Consensus forecasts are mapped directly into the NSICX measurement equation via the deterministic no-arbitrage transition F — we do not strip out realized YTD inflation. See `public/data/multicountry/methodology.pdf` for the derivation.

The header toggle switches between dark and light mode; preference is persisted in `localStorage`. Active dashboard, active tab, and selector state (vintage, view mode, etc.) are persisted within a session via `sessionStorage`.

> IMF Working Paper forthcoming. [PAPER LINK]

## Dashboards and tabs

### Japan composite (`?dashboard=japan` or default)

| Tab | Contents |
|---|---|
| Overview | Chart A (whisker plot of NSICX instantaneous-forward expectations vs realized CPI YoY, selectable by vintage) and Chart B (term-structure snapshot for the selected vintage) |
| Charts | NS factor paths with 68/95% credible intervals, ex-ante real interest rates with BoJ event markers, BEI vs NSICX-implied expectations |
| About | Paper abstract, authors |

### Multi-country (`?dashboard=multi`)

| Tab | Contents |
|---|---|
| Country view | Chart A whisker + Chart B term structure for a single country (regional country dropdown, per-country target, KeyResults sidebar) |
| Comparisons | **Forwards** (cross-country bar chart of forward-rate changes between two user-selected vintages with `to > from`, selectable window: 1y / 1y1y / 2y3y / 5y5y), **Anchoring** (trend level vs target: Apr LT t25 deviation from each country's central-bank target with optional Jan robustness; trend sensitivity to surprises: β from regressing the long end on a survey surprise, with optional raw-revisions robustness; continuous HSL color encoding), **Snapshots** (15-country grid of model term structure + Consensus survey overlays for a chosen vintage; toggle Avg-rates vs Forward-rates view) |
| About | Methodology, authors |

URL state persisted: `?dashboard=multi&country=usa` etc.

## Data

### Japan composite — `public/data/`

Files used by the Japan composite views:

| File | Contents |
|---|---|
| `whisker_data.json` | CPI series, NSICX state estimates, whisker fan data |
| `ns_factors_data.json` | Smoothed NSICX factor paths with 68/95% credible intervals |
| `real_rates_data.json` | Ex-ante real rate series and BoJ event markers |
| `bei_data.json` | Break-even inflation vs NSICX model expectations |
| `rmse_data.json` | Model RMSE diagnostics — present for reference, not rendered in the dashboard |

Regenerate by running `export_data.py` in the private repo and copying the output files here before building.

The CPI series in `whisker_data.json` can be refreshed independently from the haver-data pipeline:

```bash
python scripts/update_cpi.py --haver-data /path/to/haver-data
```

This pulls `jpcij@japan` (Japan CPI index, NSA) from the [haver-data repo](https://github.com/jasonzhixinglu/haver-data), computes the 12-month percentage change, and replaces the CPI array in `whisker_data.json`.

### Multi-country — `public/data/multicountry/`

```
public/data/multicountry/
  README.md                       schema reference
  manifest.json                   country list, last vintages, survey periods,
                                  pipeline_variant ("calendar_mode_no_strip")
  methodology.pdf                 design note on the direct measurement scheme
  countries/{slug}/
    states.json                   filtered + smoothed L/S/C with SEs, plus lambda
    cpi.json                      CPI YoY series
    surveys.json                  Consensus survey rows (ST + LT) for snapshot vintages
    mle.json                      MLE summary
  cross_country/
    anchoring.json                anchoring regressions (main + raw_revisions),
                                  re-estimated against calmod-min1 filtered states
```

Country slugs match `output/dns_production/{slug}/` in the upstream pipeline. Schema details are in [`public/data/multicountry/README.md`](public/data/multicountry/README.md).

The Country view sidebar has a one-click Excel export (`multicountry_nsicx.xlsx`) that bundles all 15 countries into a single workbook — one sheet per country plus a metadata sheet — with date, CPI YoY, NSICX factors (L, S, C), and avg / forward term structure (3M, 1Y, 2Y, 5Y, 10Y) for each.

## CSV / Excel exports

The dashboard offers downloadable extracts:

- **Japan composite — Overview**: per-vintage CPI / NSICX factors / term structure (CSV via the sidebar).
- **Japan composite — Charts**: NSICX factors with CIs (CSV), BEI vs NSICX model (CSV).
- **Multi-country — Country view**: full multi-country workbook `multicountry_nsicx.xlsx` (one sheet per country, plus a metadata sheet) — uses SheetJS, lazy-loaded on click.
- **Multi-country — Comparisons**:
  - `snapshots.csv` — model curve values + Consensus survey points across countries and vintages, with horizons aligned for each vintage's elapsed months.
  - `forward_rate_changes.csv` — long-format file: 15 countries × 6 (from, to) vintage pairs × 4 forward windows = 360 rows, with `from_value` / `to_value` levels alongside the precomputed `change`.
  - `anchoring.csv` — per-country level + sensitivity stats.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` automatically build the app and deploy it to GitHub Pages via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
