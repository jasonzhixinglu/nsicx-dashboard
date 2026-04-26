# NSICX Japan Inflation Expectations Dashboard

**Live dashboard:** https://jasonzhixinglu.github.io/nsicx-dashboard/

An interactive dashboard for visualizing outputs from a Dynamic Nelson–Siegel (DNS) state-space model of Japanese inflation expectations. The app displays:

- **Overview** — Chart A (whisker plot of DNS instantaneous forward expectations vs realized CPI YoY, selectable by vintage) and Chart B (term structure snapshot for the selected vintage)
- **Charts** — NS factor paths with credible intervals, ex-ante real interest rates, and BEI vs model-implied expectations
- **About** — paper abstract and author details

The header toggle switches between dark and light mode; preference is persisted in `localStorage`.

> IMF Working Paper forthcoming. [PAPER LINK]

## Data

Four JSON files are required in `public/data/`:

| File | Contents |
|---|---|
| `whisker_data.json` | CPI series, DNS state estimates, whisker fan data |
| `ns_factors_data.json` | Smoothed NS factor paths with 68/95% credible intervals |
| `real_rates_data.json` | Ex-ante real rate series and BoJ event markers |
| `bei_data.json` | Break-even inflation vs DNS model expectations |

Regenerate by running `export_data.py` in the private repo and copying the output files here before building or deploying.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` automatically build the app and deploy it to GitHub Pages via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
