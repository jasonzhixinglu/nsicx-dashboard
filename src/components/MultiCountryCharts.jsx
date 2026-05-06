import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Line, Scatter, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { getTheme, getTooltipStyle } from '../lib/chartTheme.js'
import { useDarkMode } from '../lib/useDarkMode.jsx'
import { avgAnnualized, avgWindow, fwdInstant } from '../lib/nsCurve.js'
import { MONTH_NAMES } from '../lib/dateFormat.js'
import { useSessionState } from '../lib/sessionState.js'

const MC_BASE = `${import.meta.env.BASE_URL}data/multicountry/`

const REGIONS_FLAT = [
  'usa', 'canada', 'mexico', 'brazil',
  'uk', 'france', 'germany', 'italy',
  'japan', 'china', 'south_korea', 'india', 'indonesia',
  'russia', 'turkey',
]

const INFLATION_TARGETS = {
  usa: 2, canada: 2, uk: 2, france: 2, germany: 2, italy: 2, japan: 2,
  south_korea: 2, china: 2, india: 4, indonesia: 2.5,
  brazil: 3, mexico: 3, russia: 4, turkey: 5,
}

const FORWARD_WINDOWS = [
  { key: '1y',   label: '1y',   a: 0,  b: 12 },
  { key: '1y1y', label: '1y1y', a: 12, b: 24 },
  { key: '2y3y', label: '2y3y', a: 24, b: 60 },
  { key: '5y5y', label: '5y5y', a: 60, b: 120 },
]

const SURVEY_PERIODS = ['2026-01', '2026-02', '2026-03', '2026-04']
const TO_VINTAGE = '2026-04'

const SUB_TABS = [
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'forwards',  label: 'Forwards' },
  { id: 'anchoring', label: 'Anchoring' },
]

function vintageLabel(v) {
  const [y, m] = v.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function triggerCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function DownloadButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs py-1 px-2.5 rounded-md font-medium transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </button>
  )
}

// Continuous HSL gradient: emerald at 0, red as deviation rises positive,
// blue as deviation falls negative. Clamped at ±1 pp.
function levelDeviationColor(dev, isDark) {
  if (dev == null) return isDark ? 'hsl(220, 5%, 40%)' : 'hsl(220, 5%, 70%)'
  const dc = Math.max(-1, Math.min(1, dev))
  const hue = dc >= 0
    ? 150 - dc * 150         //  0 → emerald, +1 → red
    : 150 + (-dc) * 90       //  0 → emerald, -1 → blue
  return `hsl(${hue.toFixed(1)}, 72%, ${isDark ? 62 : 42}%)`
}

// |β| close to 0 → emerald (well-anchored); |β| at scale → red (poorly anchored).
function sensitivityColor(beta, isDark, scale = 0.15) {
  if (beta == null) return isDark ? 'hsl(220, 5%, 40%)' : 'hsl(220, 5%, 70%)'
  const t = Math.min(1, Math.abs(beta) / scale)
  const hue = 150 - t * 150
  return `hsl(${hue.toFixed(1)}, 72%, ${isDark ? 62 : 42}%)`
}

// X-shape scatter marker (Recharts built-in 'cross' is the + sign).
function XMark({ cx, cy, fill }) {
  const s = 4
  return (
    <path
      d={`M ${cx - s} ${cy - s} L ${cx + s} ${cy + s} M ${cx - s} ${cy + s} L ${cx + s} ${cy - s}`}
      stroke={fill}
      strokeWidth={1.5}
      fill="none"
    />
  )
}

// Order countries for display: by region grouping
function orderCountries(countries) {
  return REGIONS_FLAT.map(slug => countries.find(c => c.slug === slug)).filter(Boolean)
}

// ── Snapshots: per-country panel for a chosen vintage ─────────────────────────

function buildSnapshotForCountry(country, vintage, mode) {
  const lam = country.states.lambda
  const stateRow = country.states.filtered.find(p => p.d === vintage)
  if (!stateRow) return null
  const { L, S, C } = stateRow

  // Pick the survey row: prefer LT (more horizons), fall back to ST.
  const rows = country.surveys.rows.filter(r => r.survey_period === vintage)
  const src = rows.find(r => r.source === 'LT') || rows.find(r => r.source === 'ST')

  // Months of the current calendar year already realized at the vintage date.
  // E.g. April vintage = vintage_month 4, so 3 months are behind us and only
  // 9 months of CY1 are forward; subsequent CYs are full 12-month windows.
  const monthsElapsed = Number(vintage.split('-')[1]) - 1

  const curve = []
  const scatter = []

  if (mode === 'fwd') {
    // Instantaneous forward rate f(h) = L + e^(-λh)·S + λh·e^(-λh)·C.
    // Smooth for all h ≥ 0 — no formula switches. Survey crosses are an
    // approximate overlay (12-month CY averages plotted near their midpoint
    // horizons); the footnote covers the imperfect comparison for n=1.
    for (let h = 0; h <= 132; h++) {
      curve.push({ h, val: +fwdInstant(L, S, C, lam, h).toFixed(4) })
    }
    // Survey: tn plotted at the midpoint of its FORWARD window. For n=1
    // (current CY), the forward window is [0, 12 - elapsed], so the midpoint
    // is (12 - elapsed) / 2 — e.g. April t1 → h=4.5. For n≥2 the full CY is
    // forward so the midpoint is (n-0.5)·12 - elapsed.
    if (src) {
      for (let n = 1; n <= 11; n++) {
        const v = src[`t${n}`]
        if (v == null) break
        const hMid = n === 1
          ? (12 - monthsElapsed) / 2
          : (n - 0.5) * 12 - monthsElapsed
        scatter.push({ h: hMid, v: +v.toFixed(4) })
      }
    }
  } else {
    // Avg-annualized rate from now to horizon h.
    for (let h = 1; h <= 132; h++) {
      curve.push({ h, val: +avgAnnualized(L, S, C, lam, h).toFixed(4) })
    }
    // Survey: cumulative avg of t1..tn at the end-of-CY_n horizon, shifted by
    // monthsElapsed (so April t1 lands at h=9, t2 at h=21, etc.).
    if (src) {
      let sum = 0
      for (let n = 1; n <= 11; n++) {
        const v = src[`t${n}`]
        if (v == null) break
        sum += v
        const hEoy = n * 12 - monthsElapsed
        scatter.push({ h: hEoy, v: +(sum / n).toFixed(4) })
      }
    }
  }

  return { curve, scatter }
}

function CountrySnapshotPanel({ country, vintage, target, isDark, mode }) {
  const theme = getTheme(isDark)
  const snapshot = useMemo(() => buildSnapshotForCountry(country, vintage, mode), [country, vintage, mode])

  if (!snapshot) return (
    <div className="panel p-2 flex items-center justify-center h-32 text-xs text-slate-500">
      {country.name}: no data
    </div>
  )

  const labelMap = mode === 'fwd'
    ? { val: 'Model fwd (inst.)', v: 'Survey (CY avg)' }
    : { val: 'Model avg', v: 'Survey (cum. avg)' }

  return (
    <div className="panel p-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{country.name}</span>
        <span className="text-[10px] text-slate-500">target {target}%</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart margin={{ top: 4, right: 8, bottom: 16, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} vertical={false} />
          <XAxis
            type="number"
            dataKey="h"
            domain={[0, 132]}
            ticks={[24, 60, 120]}
            tickFormatter={h => `${h / 12}y`}
            tick={{ fontSize: 9, fill: theme.ui.tickLabel }}
            axisLine={{ stroke: theme.ui.axis }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: theme.ui.tickLabel }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}%`}
            width={34}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ ...getTooltipStyle(isDark), fontSize: 11 }}
            formatter={(v, name) => {
              if (v == null) return null
              return [`${(+v).toFixed(2)}%`, labelMap[name] ?? name]
            }}
            labelFormatter={h => `${h}m`}
          />
          <ReferenceLine y={target} stroke={theme.colors.target} strokeDasharray="4 3" />
          <Line data={snapshot.curve} type="monotone" dataKey="val" name="val"
                stroke={theme.colors.avg} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          {snapshot.scatter.length > 0 && (
            <Scatter data={snapshot.scatter} dataKey="v" name="v" fill="#dc2626" shape={XMark} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function SnapshotsView({ manifest }) {
  const [allData, setAllData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vintage, setVintage] = useSessionState('nsicx-snapshots-vintage', TO_VINTAGE)
  const [mode, setMode]       = useSessionState('nsicx-snapshots-mode', 'avg')
  const { isDark } = useDarkMode()

  useEffect(() => {
    if (!manifest) return
    setLoading(true)
    Promise.all(manifest.countries.map(c =>
      Promise.all([
        fetch(`${MC_BASE}countries/${c.slug}/states.json`).then(r => r.json()),
        fetch(`${MC_BASE}countries/${c.slug}/surveys.json`).then(r => r.json()),
      ]).then(([states, surveys]) => ({ slug: c.slug, name: c.name, states, surveys }))
    )).then(all => {
      setAllData(orderCountries(all))
      setLoading(false)
    })
  }, [manifest])

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="label">Vintage</span>
          <div className="flex items-center">
            {SURVEY_PERIODS.map((v, i) => (
              <button
                key={v}
                onClick={() => setVintage(v)}
                className={`text-xs px-3 py-1 transition-colors ${
                  i === 0 ? 'rounded-l' : ''
                } ${
                  i === SURVEY_PERIODS.length - 1 ? 'rounded-r' : 'border-r border-slate-200 dark:border-slate-700'
                } ${
                  vintage === v
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {vintageLabel(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="label">View</span>
          <div className="flex items-center">
            {[{ id: 'avg', label: 'Avg rates' }, { id: 'fwd', label: 'Forward rates' }].map((m, i) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`text-xs px-3 py-1 transition-colors ${
                  i === 0 ? 'rounded-l' : 'rounded-r'
                } ${
                  i === 0 ? 'border-r border-slate-200 dark:border-slate-700' : ''
                } ${
                  mode === m.id
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto">
          <DownloadButton
            onClick={() => allData && downloadSnapshotsCSV(allData)}
            disabled={!allData}
            label="snapshots.csv"
          />
        </div>
      </div>

      <div>
        <div className="label">Term-structure snapshots vs Consensus surveys</div>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          {mode === 'fwd'
            ? 'Solid line: model\'s instantaneous forward rate at horizon h (smooth NS forward curve). Red crosses: Consensus forecasts plotted at the midpoint of each target year\'s forward window (so for an April vintage, t1 lands at h≈4.5 — the midpoint of the remaining 9 months — and t2 at h≈15). The model and survey are not strictly like-for-like (instantaneous vs window average); see the footnote.'
            : 'Solid line: model\'s avg-annualized rate from the vintage to horizon h. Red crosses: cumulative average of Consensus forecasts at each end-of-CY horizon, shifted left by months already realized (so April t1 lands at h=9, t2 at h=21, …).'}
        </p>

        {loading || !allData ? (
          <div className="flex items-center justify-center h-64 text-xs text-slate-500">Loading 15 countries…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allData.map(c => (
              <CountrySnapshotPanel
                key={c.slug}
                country={c}
                vintage={vintage}
                target={INFLATION_TARGETS[c.slug] ?? 2}
                isDark={isDark}
                mode={mode}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-600 italic leading-relaxed mt-3">
          {mode === 'fwd'
            ? 'Note: The model line is the instantaneous forward rate; the survey crosses are 12-month calendar-year averages plotted at the midpoint of each forward window. They are not strictly like-for-like — instantaneous vs window-average — and for the current calendar year (n=1) the survey itself is a full-CY average that already includes months realized at the vintage date (for an April survey, t1 is effectively a 12-month forecast made 3 months earlier). The conceptual gap is largest for n=1 and shrinks for longer horizons.'
            : 'Note: For the current calendar year (n=1), the Consensus forecast is a full-year average that already includes months realized at the vintage date — for an April survey, t1 is effectively a 12-month forecast made 3 months earlier, not a 9-month-forward forecast. We plot it at the remaining-CY horizon for visual alignment; the model curve there represents the avg from now to that horizon, so the two are not strictly equivalent for n=1. The mismatch closes for n≥2 (full forward calendar years).'}
        </p>
      </div>

    </div>
  )
}

// ── Forward rates: cross-country bar chart of vintage-to-Apr changes ──────────

function downloadChangesCSV(allStates) {
  const rows = [['country', 'slug', 'from_vintage', 'to_vintage', 'window', 'from_value', 'to_value', 'change'].join(',')]

  for (const c of allStates) {
    for (let i = 0; i < SURVEY_PERIODS.length; i++) {
      const fromV = SURVEY_PERIODS[i]
      const fromState = c.filtered.find(p => p.d === fromV)
      if (!fromState) continue
      for (let j = i + 1; j < SURVEY_PERIODS.length; j++) {
        const toV = SURVEY_PERIODS[j]
        const toState = c.filtered.find(p => p.d === toV)
        if (!toState) continue
        for (const w of FORWARD_WINDOWS) {
          const fromVal = avgWindow(fromState.L, fromState.S, fromState.C, c.lambda, w.a, w.b)
          const toVal   = avgWindow(toState.L,   toState.S,   toState.C,   c.lambda, w.a, w.b)
          rows.push([
            c.name, c.slug, fromV, toV, w.key,
            fromVal.toFixed(4), toVal.toFixed(4), (toVal - fromVal).toFixed(4),
          ].join(','))
        }
      }
    }
  }

  triggerCSV(rows.join('\n'), 'forward_rate_changes.csv')
}

function downloadSnapshotsCSV(allData) {
  const header = [
    'country', 'slug', 'vintage', 'source', 'n', 'target_year',
    'survey_value', 'survey_cum_avg',
    'horizon_eoy_months', 'horizon_mid_months',
    'model_avg_to_eoy', 'model_fwd_instant',
  ]
  const rows = [header.join(',')]

  for (const c of allData) {
    const lam = c.states.lambda
    for (const period of SURVEY_PERIODS) {
      const stateRow = c.states.filtered.find(p => p.d === period)
      if (!stateRow) continue
      const { L, S, C } = stateRow
      const [vy, vm] = period.split('-').map(Number)
      const monthsElapsed = vm - 1
      const surveyRows = c.surveys.rows.filter(r => r.survey_period === period)

      for (const src of surveyRows) {
        let cumSum = 0
        let cumCount = 0
        for (let n = 1; n <= 11; n++) {
          const v = src[`t${n}`]
          if (v == null) continue
          cumSum += v; cumCount += 1
          const hEoy = n * 12 - monthsElapsed
          const hMid = n === 1
            ? (12 - monthsElapsed) / 2
            : (n - 0.5) * 12 - monthsElapsed
          rows.push([
            c.name, c.slug, period, src.source, n, vy + (n - 1),
            v.toFixed(4),
            (cumSum / cumCount).toFixed(4),
            hEoy, hMid,
            avgAnnualized(L, S, C, lam, hEoy).toFixed(4),
            fwdInstant(L, S, C, lam, hMid).toFixed(4),
          ].join(','))
        }
        if (src.t25 != null) {
          const hT25 = 90 - monthsElapsed
          rows.push([
            c.name, c.slug, period, src.source, 25, '',
            src.t25.toFixed(4), '',
            '', hT25, '',
            fwdInstant(L, S, C, lam, hT25).toFixed(4),
          ].join(','))
        }
      }
    }
  }

  triggerCSV(rows.join('\n'), 'snapshots.csv')
}

function downloadAnchoringCSV(allSurveys, anchoring) {
  const header = [
    'country', 'slug', 'target',
    'jan_t25', 'apr_t25', 'jan_dev', 'apr_dev',
    'main_delta_ST_beta', 'main_delta_ST_p', 'main_delta_ST_r2', 'main_delta_ST_T',
    'raw_pi_sur_beta',    'raw_pi_sur_p',    'raw_pi_sur_r2',    'raw_pi_sur_T',
  ]
  const rows = [header.join(',')]

  for (const c of allSurveys) {
    const target = INFLATION_TARGETS[c.slug] ?? 2
    const jan = c.surveys.rows.find(r => r.survey_period === '2026-01' && r.source === 'LT')
    const apr = c.surveys.rows.find(r => r.survey_period === '2026-04' && r.source === 'LT')
    const m = anchoring.main[c.name]?.delta_ST
    const r = anchoring.raw_revisions[c.name]?.pi_sur
    rows.push([
      c.name, c.slug, target,
      jan?.t25 != null ? jan.t25.toFixed(4) : '',
      apr?.t25 != null ? apr.t25.toFixed(4) : '',
      jan?.t25 != null ? (jan.t25 - target).toFixed(4) : '',
      apr?.t25 != null ? (apr.t25 - target).toFixed(4) : '',
      m?.beta != null   ? m.beta.toFixed(4)   : '',
      m?.p_beta != null ? m.p_beta.toFixed(4) : '',
      m?.r2 != null     ? m.r2.toFixed(4)     : '',
      m?.T ?? '',
      r?.beta != null   ? r.beta.toFixed(4)   : '',
      r?.p_beta != null ? r.p_beta.toFixed(4) : '',
      r?.r2 != null     ? r.r2.toFixed(4)     : '',
      r?.T ?? '',
    ].join(','))
  }

  triggerCSV(rows.join('\n'), 'anchoring.csv')
}

function ForwardRatesView({ manifest }) {
  const [allStates, setAllStates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fromVintage, setFromVintage] = useSessionState('nsicx-forwards-from',   '2026-01')
  const [toVintage,   setToVintage]   = useSessionState('nsicx-forwards-to',     TO_VINTAGE)
  const [windowKey,   setWindowKey]   = useSessionState('nsicx-forwards-window', '5y5y')
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  // Maintain to > from invariant.
  const safeFrom = SURVEY_PERIODS.indexOf(fromVintage) >= 0 ? fromVintage : SURVEY_PERIODS[0]
  const safeTo   = (SURVEY_PERIODS.indexOf(toVintage) > SURVEY_PERIODS.indexOf(safeFrom))
    ? toVintage
    : SURVEY_PERIODS[SURVEY_PERIODS.indexOf(safeFrom) + 1] ?? SURVEY_PERIODS[SURVEY_PERIODS.length - 1]

  const handleFromChange = (v) => {
    setFromVintage(v)
    const fIdx = SURVEY_PERIODS.indexOf(v)
    const tIdx = SURVEY_PERIODS.indexOf(toVintage)
    if (tIdx <= fIdx) setToVintage(SURVEY_PERIODS[fIdx + 1] ?? SURVEY_PERIODS[SURVEY_PERIODS.length - 1])
  }
  const handleToChange = (v) => {
    setToVintage(v)
    const tIdx = SURVEY_PERIODS.indexOf(v)
    const fIdx = SURVEY_PERIODS.indexOf(fromVintage)
    if (fIdx >= tIdx) setFromVintage(SURVEY_PERIODS[tIdx - 1] ?? SURVEY_PERIODS[0])
  }

  useEffect(() => {
    if (!manifest) return
    setLoading(true)
    Promise.all(manifest.countries.map(c =>
      fetch(`${MC_BASE}countries/${c.slug}/states.json`)
        .then(r => r.json())
        .then(d => ({ slug: c.slug, name: c.name, ...d }))
    )).then(all => {
      setAllStates(all)
      setLoading(false)
    })
  }, [manifest])

  const chartData = useMemo(() => {
    if (!allStates) return []
    const w = FORWARD_WINDOWS.find(x => x.key === windowKey)
    return allStates.map(c => {
      const fromState = c.filtered.find(p => p.d === safeFrom)
      const toState   = c.filtered.find(p => p.d === safeTo)
      if (!fromState || !toState) return null
      const fromVal = avgWindow(fromState.L, fromState.S, fromState.C, c.lambda, w.a, w.b)
      const toVal   = avgWindow(toState.L,   toState.S,   toState.C,   c.lambda, w.a, w.b)
      return {
        slug: c.slug,
        name: c.name,
        change: +(toVal - fromVal).toFixed(4),
        fromVal: +fromVal.toFixed(4),
        toVal:   +toVal.toFixed(4),
      }
    }).filter(Boolean).sort((a, b) => a.change - b.change)
  }, [allStates, safeFrom, safeTo, windowKey])

  const fromOptions = SURVEY_PERIODS.slice(0, -1) // Jan, Feb, Mar
  const toOptions   = SURVEY_PERIODS.slice(1)     // Feb, Mar, Apr
  const monthAbbr = (v) => MONTH_NAMES[Number(v.split('-')[1]) - 1]
  const fromIdx = SURVEY_PERIODS.indexOf(safeFrom)

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3 flex-wrap">
        <span className="label">From</span>
        <div className="flex items-center">
          {fromOptions.map((v, i) => (
            <button
              key={v}
              onClick={() => handleFromChange(v)}
              className={`text-xs px-3 py-1 transition-colors ${
                i === 0 ? 'rounded-l' : ''
              } ${
                i === fromOptions.length - 1 ? 'rounded-r' : 'border-r border-slate-200 dark:border-slate-700'
              } ${
                safeFrom === v
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {monthAbbr(v)}
            </button>
          ))}
        </div>

        <span className="label ml-4">To</span>
        <div className="flex items-center">
          {toOptions.map((v, i) => {
            const disabled = SURVEY_PERIODS.indexOf(v) <= fromIdx
            return (
              <button
                key={v}
                onClick={() => !disabled && handleToChange(v)}
                disabled={disabled}
                className={`text-xs px-3 py-1 transition-colors ${
                  i === 0 ? 'rounded-l' : ''
                } ${
                  i === toOptions.length - 1 ? 'rounded-r' : 'border-r border-slate-200 dark:border-slate-700'
                } ${
                  disabled
                    ? 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700 cursor-not-allowed'
                    : safeTo === v
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {monthAbbr(v)}
              </button>
            )
          })}
        </div>

        <span className="label ml-4">Window</span>
        <select
          value={windowKey}
          onChange={(e) => setWindowKey(e.target.value)}
          className="text-sm rounded px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
        >
          {FORWARD_WINDOWS.map(w => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>

        <div className="ml-auto">
          <DownloadButton
            onClick={() => allStates && downloadChangesCSV(allStates)}
            disabled={!allStates}
            label="forward_rate_changes.csv"
          />
        </div>
      </div>

      <div className="panel p-4 flex flex-col gap-2">
        <div>
          <div className="label">Change in {windowKey} forward rate, {monthAbbr(safeFrom)} → {monthAbbr(safeTo)} 2026</div>
          <p className="text-xs text-slate-500 mt-0.5">
            Difference in avg-annualized rate over the {windowKey} window between two vintages. Color encodes the change: green near zero, red for upward revisions, blue for downward (±1pp clamp). Sorted ascending.
          </p>
        </div>
        {loading || !allStates ? (
          <div className="flex items-center justify-center h-64 text-xs text-slate-500">Loading 15 countries…</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(360, chartData.length * 24)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                axisLine={{ stroke: theme.ui.axis }}
                tickLine={false}
                tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={getTooltipStyle(isDark)}
                formatter={(v, _, ctx) => {
                  const d = ctx?.payload
                  if (!d) return [`${v.toFixed(2)}pp`, 'Δ']
                  return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}pp  (${d.fromVal.toFixed(2)} → ${d.toVal.toFixed(2)})`, 'Change']
                }}
                labelFormatter={n => n}
              />
              <ReferenceLine x={0} stroke={theme.ui.axis} strokeWidth={1} />
              <Bar dataKey="change" isAnimationActive={false}>
                {chartData.map(d => (
                  <Cell key={d.slug} fill={levelDeviationColor(d.change, isDark)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}

// ── Anchoring: long-term forwards + sensitivity (main spec) ───────────────────

function AnchoringView({ manifest }) {
  const [anchoring, setAnchoring] = useState(null)
  const [allSurveys, setAllSurveys] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  useEffect(() => {
    if (!manifest) return
    setLoading(true)
    Promise.all([
      fetch(`${MC_BASE}cross_country/anchoring.json`).then(r => r.json()),
      ...manifest.countries.map(c =>
        fetch(`${MC_BASE}countries/${c.slug}/surveys.json`)
          .then(r => r.json())
          .then(s => ({ slug: c.slug, name: c.name, surveys: s }))
      )
    ]).then(([anchoringData, ...allCountries]) => {
      setAnchoring(anchoringData)
      setAllSurveys(orderCountries(allCountries))
      setLoading(false)
    })
  }, [manifest])

  // Long-term anchoring data: Jan and Apr LT t25 vs target.
  const ltData = useMemo(() => {
    if (!allSurveys) return []
    return allSurveys.map(c => {
      const jan = c.surveys.rows.find(r => r.survey_period === '2026-01' && r.source === 'LT')
      const apr = c.surveys.rows.find(r => r.survey_period === '2026-04' && r.source === 'LT')
      const target = INFLATION_TARGETS[c.slug] ?? 2
      return {
        slug: c.slug,
        name: c.name,
        target,
        jan: jan?.t25 ?? null,
        apr: apr?.t25 ?? null,
        janDev: jan?.t25 != null ? +(jan.t25 - target).toFixed(4) : null,
        aprDev: apr?.t25 != null ? +(apr.t25 - target).toFixed(4) : null,
      }
    })
  }, [allSurveys])

  // Sort countries by April deviation (most below target → most above) for the chart.
  const ltSorted = useMemo(() =>
    [...ltData].filter(d => d.aprDev != null).sort((a, b) => a.aprDev - b.aprDev),
    [ltData]
  )

  // Sensitivity data: two specs per country.
  //  - mainBeta  = main.delta_ST    (filter-implied long-end on short-horizon survey revision)
  //  - rawBeta   = raw_revisions.pi_sur (raw long-end on same-CY survey-based surprise)
  const sensData = useMemo(() => {
    if (!anchoring || !manifest) return []
    const slugByName = Object.fromEntries(manifest.countries.map(c => [c.name, c.slug]))
    const names = Object.keys(anchoring.main)
    return names.map(name => {
      const m = anchoring.main[name]?.delta_ST
      const r = anchoring.raw_revisions[name]?.pi_sur
      return {
        name,
        slug: slugByName[name],
        mainBeta: m ? +m.beta.toFixed(4) : null,
        mainP:    m?.p_beta ?? null,
        mainR2:   m?.r2 ?? null,
        mainT:    m?.T ?? null,
        rawBeta:  r ? +r.beta.toFixed(4) : null,
        rawP:     r?.p_beta ?? null,
        rawR2:    r?.r2 ?? null,
        rawT:     r?.T ?? null,
      }
    }).filter(d => d.mainBeta != null || d.rawBeta != null)
      .sort((a, b) => (a.mainBeta ?? 0) - (b.mainBeta ?? 0))
  }, [anchoring, manifest])

  if (loading || !ltData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-slate-500">Loading anchoring data…</div>
    )
  }

  return (
    <div className="space-y-3">

      <div className="flex justify-end">
        <DownloadButton
          onClick={() => allSurveys && anchoring && downloadAnchoringCSV(allSurveys, anchoring)}
          disabled={!allSurveys || !anchoring}
          label="anchoring.csv"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Section 1: Long-term forwards */}
      <div className="panel p-4 flex flex-col gap-2">
        <div>
          <div className="label">Trend level vs target</div>
          <p className="text-xs text-slate-500 mt-0.5">
            Consensus <em>trend</em> inflation forecast — the 6–10y average (t25 in the LT survey), even longer-run than typical long-horizon expectations — shown as deviation from each country's target, for the Jan and Apr 2026 LT surveys. Color encodes the deviation: green at target, red above, blue below. Apr bars are wider (preferred); Jan bars are thinner. Sorted by April deviation.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={480}>
          <BarChart
            data={ltSorted}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            barCategoryGap={6}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
              axisLine={{ stroke: theme.ui.axis }}
              tickLine={false}
              tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={getTooltipStyle(isDark)}
              formatter={(v, name, ctx) => {
                const d = ctx?.payload
                if (!d) return [`${(+v).toFixed(2)}pp`, name]
                if (name === 'janDev') return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}pp  (LT t25 = ${d.jan?.toFixed(2) ?? '—'}, target ${d.target}%)`, 'Jan 2026']
                if (name === 'aprDev') return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}pp  (LT t25 = ${d.apr?.toFixed(2) ?? '—'}, target ${d.target}%)`, 'Apr 2026']
                return [`${(+v).toFixed(2)}pp`, name]
              }}
              labelFormatter={n => n}
            />
            <Legend
              verticalAlign="top"
              height={20}
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              formatter={n => n === 'janDev' ? 'Jan 2026' : 'Apr 2026'}
            />
            <ReferenceLine x={0} stroke={theme.ui.axis} strokeWidth={1} />
            <Bar dataKey="janDev" name="janDev" fill="#9ca3af" isAnimationActive={false} barSize={6}>
              {ltSorted.map(d => (
                <Cell key={d.slug} fill={levelDeviationColor(d.janDev, isDark)} fillOpacity={0.55} />
              ))}
            </Bar>
            <Bar dataKey="aprDev" name="aprDev" fill="#9ca3af" isAnimationActive={false} barSize={14}>
              {ltSorted.map(d => (
                <Cell key={d.slug} fill={levelDeviationColor(d.aprDev, isDark)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 2: Sensitivity */}
      <div className="panel p-4 flex flex-col gap-2">
        <div>
          <div className="label">Trend sensitivity to surprises</div>
          <p className="text-xs text-slate-500 mt-0.5">
            Slope coefficient β from two anchoring regressions of the trend on a survey surprise. Wider bar (preferred): trend NSICX change (filter-implied) regressed on the short-horizon revision. Thinner bar: raw trend forecast change regressed on the same-CY survey-based surprise. Color encodes |β|: green near zero (trend well anchored), red as |β| grows. Solid bars: p &lt; 0.05.
          </p>
        </div>

        <ResponsiveContainer width="100%" height={480}>
          <BarChart
            data={sensData}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            barCategoryGap={6}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
              axisLine={{ stroke: theme.ui.axis }}
              tickLine={false}
              tickFormatter={v => v.toFixed(2)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={getTooltipStyle(isDark)}
              formatter={(v, name, ctx) => {
                const d = ctx?.payload
                if (!d) return [v?.toFixed(3), name]
                if (name === 'mainBeta') {
                  return [`β = ${v.toFixed(4)}  (p=${d.mainP?.toFixed(3) ?? '—'}, R²=${d.mainR2?.toFixed(3) ?? '—'}, T=${d.mainT ?? '—'})`, 'ST NSICX revision (preferred)']
                }
                if (name === 'rawBeta') {
                  return [`β = ${v.toFixed(4)}  (p=${d.rawP?.toFixed(3) ?? '—'}, R²=${d.rawR2?.toFixed(3) ?? '—'}, T=${d.rawT ?? '—'})`, 'Same-CY raw revision']
                }
                return [v?.toFixed(3), name]
              }}
              labelFormatter={n => n}
            />
            <Legend
              verticalAlign="top"
              height={20}
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              formatter={n => n === 'mainBeta' ? 'ST NSICX revision (preferred)' : 'Same-CY raw revision'}
            />
            <ReferenceLine x={0} stroke={theme.ui.axis} strokeWidth={1} />
            <Bar dataKey="rawBeta" name="rawBeta" fill="#9ca3af" isAnimationActive={false} barSize={6}>
              {sensData.map(d => (
                <Cell key={d.slug}
                  fill={sensitivityColor(d.rawBeta, isDark)}
                  fillOpacity={d.rawP != null && d.rawP < 0.05 ? 0.55 : 0.25} />
              ))}
            </Bar>
            <Bar dataKey="mainBeta" name="mainBeta" fill="#9ca3af" isAnimationActive={false} barSize={14}>
              {sensData.map(d => (
                <Cell key={d.slug}
                  fill={sensitivityColor(d.mainBeta, isDark)}
                  fillOpacity={d.mainP != null && d.mainP < 0.05 ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      </div>{/* end inner grid */}

      {anchoring?._note && (
        <p className="text-xs text-slate-500 dark:text-slate-600 italic leading-relaxed">
          Note: {anchoring._note}
        </p>
      )}

    </div>
  )
}

// ── Top-level wrapper with sub-tab navigation ─────────────────────────────────

export default function MultiCountryCharts() {
  const [subTab, setSubTab] = useSessionState('nsicx-multi-subtab', 'snapshots')
  const [manifest, setManifest] = useState(null)

  // Validate stored subTab against current SUB_TABS in case it was renamed.
  const safeSubTab = SUB_TABS.find(t => t.id === subTab) ? subTab : SUB_TABS[0].id

  const handleSubTabChange = (id) => setSubTab(id)

  useEffect(() => {
    fetch(`${MC_BASE}manifest.json`)
      .then(r => r.json())
      .then(setManifest)
  }, [])

  if (!manifest) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm py-6">Loading…</div>
  )

  return (
    <div className="space-y-4 py-2">

      <nav className="flex gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleSubTabChange(t.id)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              safeSubTab === t.id
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {safeSubTab === 'snapshots' && <SnapshotsView    manifest={manifest} />}
      {safeSubTab === 'forwards'  && <ForwardRatesView manifest={manifest} />}
      {safeSubTab === 'anchoring' && <AnchoringView    manifest={manifest} />}

    </div>
  )
}
