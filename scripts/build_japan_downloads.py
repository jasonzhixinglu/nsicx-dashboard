"""
Build the three Japan composite download files for each estimation release.

For every release folder in public/data/japan/releases/ this writes:

  states_and_parameters.csv   filtered and smoothed states (L, S, C) by month, preceded by
                              '#' comment lines with the full-sample parameters
  inflation_expectations.csv  realized CPI inflation (y/y) and, from the filtered states,
                              average expected inflation over the next 1, 2, 5, 10 years and
                              instantaneous forward inflation 1, 2, 5, 10 years ahead
  exante_real_rates.csv       nominal JGB yields and ex-ante real rates (nominal yield minus
                              average expected inflation over the same horizon), filtered
                              and smoothed

Inputs
  live-*          the release folder itself (filtered_states.csv, smoothed_states.csv,
                  mle_summary.json, nominal_yields_monthly.csv, whisker_data.json)
  paper-2026-06   the Japan WP repository at its tag paper-2026-06 (full-precision states,
                  parameters and yields: output/dns_estimation/), plus the release's
                  whisker_data.json for CPI

Checks: the filtered expectations and filtered real rates reproduce each release's
published dns_expectations.csv and real_rates.csv (to 1e-4: the paper release's published
files were built from the dashboard's 4-decimal values).

  python scripts/build_japan_downloads.py [--wp ../inflation_expectations]
"""
from __future__ import annotations

import argparse
import io
import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent.parent
RELEASES = HERE / "public" / "data" / "japan" / "releases"
PAPER_TAG = "paper-2026-06"
HORIZONS = {"1Y": 12, "2Y": 24, "5Y": 60, "10Y": 120}
STATES = ["L_t", "S_t", "C_t"]


def avg_loadings(h: float, lam: float) -> np.ndarray:
    """Average expected inflation over the next h months (Japan WP code/utils/ns.py, h1 = 0)."""
    e = np.exp(-lam * h)
    s = (1 - e) / (lam * h)
    return np.array([1.0, s, s - e])


def fwd_loadings(h: float, lam: float) -> np.ndarray:
    """Instantaneous forward inflation h months ahead."""
    e = np.exp(-lam * h)
    return np.array([1.0, e, lam * h * e])


def curve(states: pd.DataFrame, lam: float, loadings) -> pd.DataFrame:
    X = states[STATES].to_numpy()
    return pd.DataFrame({k: X @ loadings(h, lam) for k, h in HORIZONS.items()}, index=states.index)


def _monthly(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.index = pd.PeriodIndex(df.index.astype(str), freq="M").astype(str)
    df.index.name = "date"
    return df


def load_live(d: Path) -> dict:
    rd = lambda f: pd.read_csv(d / f, index_col="date")  # noqa: E731
    return dict(filtered=_monthly(rd("filtered_states.csv")), smoothed=_monthly(rd("smoothed_states.csv")),
                params=json.loads((d / "mle_summary.json").read_text()),
                nominal=_monthly(rd("nominal_yields_monthly.csv")))


def load_paper(wp: Path) -> dict:
    def show(path: str) -> bytes:
        return subprocess.run(["git", "show", f"{PAPER_TAG}:{path}"], cwd=wp, capture_output=True,
                              check=True).stdout
    pk = lambda f: _monthly(pd.read_pickle(io.BytesIO(show(f"output/dns_estimation/{f}"))))  # noqa: E731
    return dict(filtered=pk("filtered_states.pkl"), smoothed=pk("smoothed_states.pkl"),
                params=json.loads(show("output/dns_estimation/mle_summary.json")),
                nominal=pk("nominal_yields_monthly.pkl"))


def cpi_yoy(d: Path) -> pd.Series:
    w = json.loads((d / "whisker_data.json").read_text())
    return pd.Series({p["d"]: p["v"] for p in w["cpi"]}, name="cpi_yoy")


def write_csv(path: Path, df: pd.DataFrame, comments: list[str] | None = None) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        for c in comments or []:
            f.write(f"# {c}\n")
        df.to_csv(f, float_format="%.6f", lineterminator="\n")


def build(name: str, src: dict, d: Path) -> None:
    p = src["params"]
    pn = dict(zip(p["param_names"], p["params"]))
    lam = float(pn["lam"])
    fil, smo = src["filtered"][STATES], src["smoothed"][STATES]
    fil, smo = fil.align(smo, join="inner", axis=0)

    # checks against the published files
    exp_f = curve(fil, lam, avg_loadings)
    pub = _monthly(pd.read_csv(d / "dns_expectations.csv", index_col=0))
    err = (exp_f - pub[list(HORIZONS)].reindex(exp_f.index)).abs().max().max()
    assert err < 1e-4, f"{name}: expectations differ from dns_expectations.csv by {err}"
    nom = src["nominal"][list(HORIZONS)].reindex(fil.index)
    rr_f = nom - exp_f
    pub_rr = _monthly(pd.read_csv(d / "real_rates.csv", index_col=0))
    err = (rr_f.to_numpy() - pub_rr[[f"rr_{k}" for k in HORIZONS]].reindex(fil.index).to_numpy())
    err = np.nanmax(np.abs(err))
    assert err < 1e-4, f"{name}: real rates differ from real_rates.csv by {err}"

    sample = f"{fil.index[0]} to {fil.index[-1]}"
    head = [f"Japan composite inflation expectations (NSICX), release {name}; sample {sample}",
            "Full-sample maximum likelihood parameters:",
            f"  lambda = {lam:.6f}; qL = {pn['qL']:.6g}; qS = {pn['qS']:.6g}; qC = {pn['qC']:.6g}",
            f"  measurement variance scale kappa = {p['kappa']:.6f}; log likelihood = {p['loglik']:.3f}",
            "States: level L, slope S, curvature C; filtered = real-time (data through each month), "
            "smoothed = full sample"]
    states = pd.concat([fil.add_suffix("_filtered"), smo.add_suffix("_smoothed")], axis=1)
    states.columns = [c.replace("_t_", "_") for c in states.columns]
    write_csv(d / "states_and_parameters.csv", states, head)

    fwd_f = curve(fil, lam, fwd_loadings)
    cpi = cpi_yoy(d).reindex(fil.index)
    exp = pd.concat([cpi, exp_f.add_prefix("avg_"), fwd_f.add_prefix("fwd_")], axis=1)
    write_csv(d / "inflation_expectations.csv", exp,
              [f"Japan composite, release {name}; filtered (real-time) estimates, % a.r.",
               "cpi_yoy: realized CPI inflation, y/y; avg_h: average expected inflation over the next h; "
               "fwd_h: instantaneous forward inflation h ahead"])

    rr_s = nom - curve(smo, lam, avg_loadings)
    rr = pd.concat([nom.add_prefix("nominal_"), rr_f.add_prefix("real_filtered_"),
                    rr_s.add_prefix("real_smoothed_")], axis=1).dropna(how="all")
    write_csv(d / "exante_real_rates.csv", rr,
              [f"Japan composite, release {name}; % a.r.",
               "nominal_h: JGB yield; real_*_h: nominal yield minus average expected inflation over the "
               "next h (filtered or smoothed states)"])
    print(f"{name}: {sample}, lambda {lam:.4f}; wrote 3 files")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wp", default=str(HERE.parent / "inflation_expectations"))
    args = ap.parse_args()
    for d in sorted(p for p in RELEASES.iterdir() if p.is_dir()):
        if d.name.startswith("live-"):
            build(d.name, load_live(d), d)
        elif d.name == PAPER_TAG:
            build(d.name, load_paper(Path(args.wp)), d)


if __name__ == "__main__":
    main()
