import { formatMonthYear, prevMonthYear } from '../lib/dateFormat.js'
import { useDarkMode } from '../lib/useDarkMode.jsx'

// Continuous HSL gradient: emerald at target, hue → red as v rises above,
// hue → blue as v falls below. Clamped at ±1 percentage point so moderate
// deviations register clearly.
function deviationColor(v, target, isDark) {
  const dc = Math.max(-1, Math.min(1, v - target))
  const hue = dc >= 0
    ? 150 - dc * 150         //  0 → 150 (emerald), +1 → 0   (red)
    : 150 + (-dc) * 90       //  0 → 150 (emerald), -1 → 240 (blue)
  const lightness = isDark ? 62 : 42
  return `hsl(${hue.toFixed(1)}, 72%, ${lightness}%)`
}

export default function KeyResults({ state, date, lam, target = 2 }) {
  const { isDark } = useDarkMode()
  if (!state) return (
    <div className="card p-4 text-xs text-slate-500 dark:text-slate-600">Select a date to see key readings.</div>
  )

  const avgAt = (h) => {
    if (h < 1e-6) return state.L + state.S
    const eL = Math.exp(-lam * h)
    const L2 = (1 - eL) / (lam * h)
    const L3 = L2 - eL
    return state.L + L2 * state.S + L3 * state.C
  }

  const readings = [
    { label: '1Y',    value: avgAt(12) },
    { label: '2Y',    value: avgAt(24) },
    { label: '5Y',    value: avgAt(60) },
    { label: '10Y',   value: avgAt(120) },
    { label: 'Trend', value: state.L },
  ]

  const color = (v) => deviationColor(v, target, isDark)

  return (
    <>
      {/* Mobile: single merged card */}
      <div className="lg:hidden">
        <div className="card p-3">
          <div className="pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 space-y-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Survey</span>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300">{formatMonthYear(date)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">CPI</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{prevMonthYear(date)}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mb-1.5">Avg annualized (%)</div>
          <div className="grid grid-cols-6 gap-x-2">
            {readings.map(r => (
              <div key={r.label} className="text-center">
                <div className="text-xs text-slate-500">{r.label}</div>
                <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: color(r.value) }}>
                  {r.value.toFixed(2)}
                </div>
              </div>
            ))}
            <div className="text-center">
              <div className="text-xs text-slate-500">Target</div>
              <div className="text-sm font-mono font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {target.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: single merged card */}
      <div className="hidden lg:block">
        <div className="card p-4">
          <div className="pb-2.5 mb-3 border-b border-slate-200 dark:border-slate-800 space-y-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Survey</span>
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{formatMonthYear(date)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">CPI</span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{prevMonthYear(date)}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mb-2">Avg annualized (%)</div>
          <div className="space-y-2">
            {readings.map(r => (
              <div key={r.label} className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500 w-10 shrink-0">{r.label}</span>
                <span className="text-base font-mono font-semibold tabular-nums" style={{ color: color(r.value) }}>
                  {r.value.toFixed(2)}<span className="text-xs text-slate-400 dark:text-slate-600 ml-0.5">%</span>
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-0.5">
              <span className="text-xs text-slate-500 w-10 shrink-0">Target</span>
              <span className="text-base font-mono font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {target.toFixed(2)}<span className="text-xs text-slate-400 dark:text-slate-600 ml-0.5">%</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
