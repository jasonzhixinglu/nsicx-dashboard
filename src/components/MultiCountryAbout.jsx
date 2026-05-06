export default function MultiCountryAbout() {
  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">

      <div className="panel p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">
            Multi-Country NSICX Application to Consensus Expectations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Companion to: <em>A Composite Term Structure of Japan's Inflation Expectations</em>
          </p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:gap-8 gap-2">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Jason Lu</div>
              <div className="text-xs text-slate-500 mt-0.5">Research Department</div>
              <div className="text-xs text-slate-500">International Monetary Fund</div>
              <a href="mailto:jlu2@imf.org" className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-0.5 inline-block">jlu2@imf.org</a>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Ken Teoh</div>
              <div className="text-xs text-slate-500 mt-0.5">Asia and Pacific Department</div>
              <div className="text-xs text-slate-500">International Monetary Fund</div>
              <a href="mailto:hteoh@imf.org" className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-0.5 inline-block">hteoh@imf.org</a>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200/80 text-xs text-indigo-700 font-medium dark:bg-indigo-950/60 dark:border-indigo-700/40 dark:text-indigo-300">
            Forthcoming IMF Working Paper
          </div>
        </div>
      </div>

      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="label">Methodology</div>
          <a
            href={`${import.meta.env.BASE_URL}data/multicountry/methodology.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs py-1 px-2.5 rounded-md font-medium transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            methodology.pdf
          </a>
        </div>

        <div className="space-y-3 text-sm text-slate-900 dark:text-white leading-relaxed">
          <p>
            This view uses the Nelson-Siegel internally consistent expectations (NSICX) model from the working paper, applied to Consensus Economics data across 15 G20 economies using a single source. The Japan composite in the paper combines six survey sources; here, all 15 countries are estimated on Consensus alone for comparability across countries.
          </p>

          <p>
            Consensus Economics reports calendar year inflation forecasts for the current and next calendar years every month, plus long-range forecasts at the start of each calendar quarter (available since approximately 2014).
          </p>

          <p>
            <span className="font-medium">Direct measurement.</span> Within-calendar-year Consensus forecasts are mapped directly into the Nelson-Siegel measurement equation via the deterministic NSICX no-arbitrage transition F — we do not strip out realized year-to-date inflation. This avoids a numerical leverage explosion at year-end, removes the realized-CPI data dependency, and absorbs forecaster inattention into the measurement residual without amplification. The technical derivation is in <em>methodology.pdf</em>.
          </p>

          <p>
            The model is estimated by maximum likelihood over the post-2001 sample, including the six measurement errors. Results are shown from 2002 onward so the Kalman state can initialize.
          </p>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          The views expressed herein are those of the authors and do not necessarily represent
          the views of the IMF, the IMF Executive Board, or IMF management. This dashboard is
          a companion to the working paper and presents selected interactive results.
        </p>
      </div>

    </div>
  )
}
