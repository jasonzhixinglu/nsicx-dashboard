export default function AboutPanel() {
  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">

      <div className="panel p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">
            A Flexible Composite Term Structure of Inflation Expectations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Application of the NSICX model to Japan's inflation expectations across six sources
          </p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:gap-8 gap-2">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Yan Carrière-Swallow</div>
              <div className="text-xs text-slate-500 mt-0.5">Asia and Pacific Department</div>
              <div className="text-xs text-slate-500">International Monetary Fund</div>
              <a href="mailto:ycswallow@imf.org" className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-0.5 inline-block">ycswallow@imf.org</a>
            </div>
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

      <div className="panel p-6 space-y-3">
        <div className="label">Abstract</div>
        <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
          We develop a flexible methodology for estimating a real-time term structure of inflation
          expectations from heterogeneous survey- and market-based sources. Our Nelson-Siegel
          Internally Consistent Expectations model extends the standard dynamic Nelson-Siegel
          state-space model by imposing a restriction that forecasts of any fixed-horizon event are
          revised only in response to new information, and by calibrating measurement-error
          variances to each source's historical forecast accuracy. The resulting composite
          summarizes expectations at all horizons in a single internally-consistent term structure
          that can be applied in a variety of contexts, including when data sources are reported at
          irregular intervals and horizons. To illustrate our framework, we apply the model to
          Japanese inflation expectations data, and document a gradual alignment of long-run
          inflation expectations with the Bank of Japan's 2-percent target from below.
        </p>
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
