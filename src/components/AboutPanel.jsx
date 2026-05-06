export default function AboutPanel() {
  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">

      <div className="panel p-6 space-y-4">
        <div>
          <div className="label mb-3">Forthcoming IMF Working Paper</div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">
            A Composite Term Structure of Japan's Inflation Expectations
          </h2>
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

      <div className="panel p-6 space-y-3">
        <div className="label">Abstract</div>
        <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
          We construct real-time monthly term structures of Japan's inflation expectations from 2002
          to early 2026 by synthesizing information from household surveys, firm surveys, professional
          forecasters, and market-implied breakeven inflation rates. To do so, we develop a dynamic
          Nelson-Siegel model with transition dynamics specified to be internally consistent with
          expectations that follow a Nelson-Siegel loading structure. Our estimates indicate that
          medium- and long-term inflation expectations have risen toward the Bank of Japan's
          2-percent target since 2022, with the target falling within the 95 percent confidence band
          for long-term expectations by late 2024.
        </p>
        <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
          Using our composite, we compare long-term inflation expectations in Japan with those in
          the US and find substantially stronger sensitivity to short-term inflation surprises. We
          also construct term structures of ex-ante real interest rates and decompose movements in
          nominal yields into real and inflation expectation changes around monetary policy events.
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
