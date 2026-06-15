# NSICX Inflation Expectations Dashboard

**Live dashboard:** https://jasonzhixinglu.github.io/nsicx-dashboard/

An interactive companion to the working paper *A Composite Term Structure of Japan's Inflation Expectations* (Lu & Teoh, forthcoming IMF Working Paper). The dashboard hosts two views, switched via a link in the header:

- **Japan composite** (default landing) — the six-source composite from the paper.
- **Multi-country** — the same Nelson–Siegel internally consistent expectations (NSICX) framework applied to 17 economies using a single source (Consensus Economics) for cross-country comparability. Within-CY Consensus forecasts are mapped directly into the NSICX measurement equation via the deterministic no-arbitrage transition F — we do not strip out realized YTD inflation. See `public/data/multicountry/methodology.pdf` for the derivation. Australia and New Zealand publish CPI quarterly; their realized-CPI line is interpolated to monthly steps for display. The Real rates tab combines the NSICX expected-inflation curve with monthly Nelson-Siegel-Svensson fits to sovereign bond yields (estimated out to 30Y, displayed to 10Y where NSICX is identified) — available for the 13 countries with sovereign-yield coverage in haver-data.

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
| Country view | Chart A whisker + Chart B term structure for a single country (regional country dropdown, per-country target, KeyResults sidebar). All 17 countries available. |
| Cross country | **Forwards** (cross-country bar chart of forward-rate changes between two user-selected vintages with `to > from`, selectable window: 1y / 1y1y / 2y3y / 5y5y; X axis anchored across vintages for visual comparability), **Levels** (two side-by-side bar charts of vintage-to-vintage change in the model-implied CPI growth — end-2025 → end-2026 and the 2-year cumulative through end-2027 — driven by a shared From/To vintage selector, country order matching the Country view; the CY forecast is reconstructed from the filtered NSICX state via the calendar-mode measurement equation rather than read off the raw survey), **Anchoring** (trend level vs target: Apr LT t25 deviation from each country's central-bank target; trend sensitivity to surprises: β from regressing the long end on a survey revision; continuous HSL color encoding). Forwards and Levels filter to 13 countries (Brazil, Mexico, Russia, Turkey omitted — high-inflation regimes distort the scale); Anchoring keeps all 17. |
| Real rates | Cleveland-Fed-style accordion of three sections: **Snapshot across countries** (table on the LHS + sorted bar chart on the RHS for a selected horizon; color encodes the gap to the US at the same horizon, ±2pp clamp; vintage and 1Y/2Y/5Y/10Y horizon selectors), **Term structure snapshot** (nominal Svensson curve, NSICX expected inflation, real wedge; observed-yield dots overlaid ≤10Y), **Real rates history** (line chart over time at 1/2/5/10Y horizons for a selected country; pill toggles per horizon). 13 countries (only those with a Svensson-fitted sovereign curve — Brazil/Mexico/Russia/Turkey have no sovereign yields in haver-data). |
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
                                  pipeline_variant ("calendar_mode_no_strip"),
                                  plus has_svensson / svensson_start / svensson_T
                                  / n_yield_obs / realized_cpi_source per country
  methodology.pdf                 design note on the direct measurement scheme
  countries/{slug}/
    states.json                   filtered + smoothed L/S/C with SEs, plus lambda
    cpi.json                      CPI YoY series (realized_cpi_source flag)
    surveys.json                  Consensus survey rows (ST + LT) for snapshot vintages
    mle.json                      MLE summary
    svensson.json                 Nelson-Siegel-Svensson monthly fit params
                                  (b0..b3, lam1, lam2) — only for the 13 countries
                                  with has_svensson=true
    observed_yields.json          end-of-month sovereign yields underlying the
                                  Svensson fit (long format {d, tau, y}) — same
                                  13-country coverage
  cross_country/
    anchoring.json                anchoring regressions (main + raw_revisions),
                                  estimated against the filtered NSICX states
```

Country slugs match `output/dns_production/{slug}/` in the upstream pipeline. Schema details are in [`public/data/multicountry/README.md`](public/data/multicountry/README.md).

The Country view sidebar has a one-click Excel export (`multicountry_nsicx.xlsx`) that bundles all 17 countries into a single workbook — one sheet per country plus a metadata sheet — with date, CPI YoY, NSICX factors (L, S, C), and avg / forward term structure (3M, 1Y, 2Y, 5Y, 10Y) for each.

## CSV / Excel exports

The dashboard offers downloadable extracts:

- **Japan composite — Overview**: per-vintage CPI / NSICX factors / term structure (CSV via the sidebar).
- **Japan composite — Charts**: NSICX factors with CIs (CSV), BEI vs NSICX model (CSV).
- **Multi-country — Country view**: full multi-country workbook `multicountry_nsicx.xlsx` (one sheet per country, plus a metadata sheet) — uses SheetJS, lazy-loaded on click.
- **Multi-country — Cross country**:
  - `forward_rate_changes.csv` — long-format file with `from_value` / `to_value` levels alongside the precomputed `change`. Each row is one (country, from_vintage, to_vintage, window) combination; rows are emitted where both endpoints exist in that country's filtered states.
  - `levels.csv` — model-implied cumulative CPI growth from end-2025 to end-2026 and end-2027, per country × vintage, with cumulative target and per-year deviation.
  - `anchoring.csv` — per-country level + sensitivity stats.
- **Multi-country — Real rates**:
  - `real_rates_horizons.csv` — long-format: country × date × {1, 2, 5, 10}Y horizon × {nominal, expected_inflation, real} (% p.a.). Full history × 13 countries.
  - `real_term_structure.csv` — long-format: country × date × tau_months (1..120) × {nominal, expected_inflation, real, observed_yield} (% p.a.). `observed_yield_pct` is populated only at the published maturities (3m, 6m, 1y, 2y, 5y, 10y); empty otherwise.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` automatically build the app and deploy it to GitHub Pages via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
