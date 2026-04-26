# NSICX Japan Inflation Expectations Dashboard

**Live dashboard:** https://jasonzhixinglu.github.io/nsicx-dashboard/

An interactive dashboard for visualising outputs from a Dynamic Nelson–Siegel (DNS) state-space model of Japanese inflation expectations. The app displays estimated DNS factors (level, slope, and curvature), break-even inflation (BEI) decompositions into inflation-risk and liquidity premia, real interest rates derived from the JGB nominal curve, and forecast-error whisker plots that summarise model fit across maturities and horizons.

> IMF Working Paper forthcoming. [PAPER LINK]

## Data

Data are refreshed by running `export_data.py` in the private repo and copying the resulting JSON files into `public/data/` before building or deploying.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` automatically build the app and deploy it to GitHub Pages via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
