import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, Cell, LineChart, Line, ComposedChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { getTheme, getTooltipStyle } from '../lib/chartTheme.js'
import { useDarkMode } from '../lib/useDarkMode.jsx'
import { avgAnnualized, fwdInstant } from '../lib/nsCurve.js'
import { MONTH_NAMES, formatMonthYear } from '../lib/dateFormat.js'
import { useSessionState } from '../lib/sessionState.js'

const MC_BASE = `${import.meta.env.BASE_URL}data/multicountry/`

const HORIZONS_YEARS = [1, 2, 5, 10]
const HORIZON_COLOR = {
  1:  '#22d3ee',  // cyan
  2:  '#6366f1',  // indigo
  5:  '#f59e0b',  // amber
  10: '#ef4444',  // red
}

const REGIONS_FLAT = [
  'usa', 'canada', 'mexico', 'brazil',
  'uk', 'france', 'germany', 'italy',
  'japan', 'china', 'south_korea', 'india', 'indonesia', 'australia', 'new_zealand',
  'russia', 'turkey',
]

// ── Math helpers ─────────────────────────────────────────────────────────────
// Svensson lam1, lam2 are decay times in years (τ_k parameterization).

function ySvenssonAvg(tau, b0, b1, b2, b3, lam1, lam2) {
  const x1 = tau / lam1, x2 = tau / lam2
  const f1 = (1 - Math.exp(-x1)) / x1
  const f2 = (1 - Math.exp(-x2)) / x2
  return b0 + b1*f1 + b2*(f1 - Math.exp(-x1)) + b3*(f2 - Math.exp(-x2))
}

function ySvenssonFwd(tau, b0, b1, b2, b3, lam1, lam2) {
  const x1 = tau / lam1, x2 = tau / lam2
  return b0 + b1*Math.exp(-x1) + b2*x1*Math.exp(-x1) + b3*x2*Math.exp(-x2)
}

function nominalAt(sv, tauYears, mode) {
  const { b0, b1, b2, b3, lam1, lam2 } = sv
  return mode === 'fwd'
    ? ySvenssonFwd(tauYears, b0, b1, b2, b3, lam1, lam2)
    : ySvenssonAvg(tauYears, b0, b1, b2, b3, lam1, lam2)
}

function inflationAt(state, lam, tauYears, mode) {
  const h = 12 * tauYears
  return mode === 'fwd'
    ? fwdInstant(state.L, state.S, state.C, lam, h)
    : avgAnnualized(state.L, state.S, state.C, lam, h)
}

function realAt(sv, state, lam, tauYears, mode) {
  return nominalAt(sv, tauYears, mode) - inflationAt(state, lam, tauYears, mode)
}

function orderCountries(countries) {
  return REGIONS_FLAT.map(slug => countries.find(c => c.slug === slug)).filter(Boolean)
}

// HSL gradient: emerald at 0, red as deviation rises positive, blue as it falls
// negative. Saturates at ±scale (default 2 pp for cross-country real-rate gaps).
function deviationFromUSColor(dev, isDark, scale = 2) {
  if (dev == null) return isDark ? 'hsl(220, 5%, 40%)' : 'hsl(220, 5%, 70%)'
  const dc = Math.max(-1, Math.min(1, dev / scale))
  const hue = dc >= 0
    ? 150 - dc * 150        //  0 → emerald (150), +scale → red (0)
    : 150 + (-dc) * 90      //  0 → emerald (150), −scale → blue (240)
  return `hsl(${hue.toFixed(1)}, 72%, ${isDark ? 62 : 42}%)`
}

// ── Accordion primitive ──────────────────────────────────────────────────────

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <div className={`border-l-4 ${isOpen ? 'border-indigo-500' : 'border-transparent'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={isOpen}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
          isOpen
            ? 'cursor-default'
            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24"
             className={`text-indigo-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
             fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{title}</span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── Shared controls ──────────────────────────────────────────────────────────

function YearMonthSelector({ months, value, onChange, label = 'Vintage' }) {
  const safe = months.includes(value) ? value : months[months.length - 1]
  const [year, mon] = safe.split('-').map(Number)
  const years = useMemo(() =>
    [...new Set(months.map(m => Number(m.split('-')[0])))].sort((a, b) => a - b),
    [months]
  )
  const monthsForYear = useMemo(() =>
    months.filter(m => m.startsWith(`${year}-`)).map(m => Number(m.split('-')[1])),
    [months, year]
  )

  const idx = months.indexOf(safe)
  const canPrev = idx > 0
  const canNext = idx >= 0 && idx < months.length - 1
  const goPrev = () => { if (canPrev) onChange(months[idx - 1]) }
  const goNext = () => { if (canNext) onChange(months[idx + 1]) }

  return (
    <div className="flex items-center gap-1.5">
      <span className="label">{label}</span>
      <select
        value={year}
        onChange={e => {
          const ny = Number(e.target.value)
          const mset = months.filter(m => m.startsWith(`${ny}-`)).map(m => Number(m.split('-')[1]))
          const targetMonth = mset.includes(mon) ? mon : mset[mset.length - 1]
          onChange(`${ny}-${String(targetMonth).padStart(2, '0')}`)
        }}
        className="text-xs rounded px-1.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        value={mon}
        onChange={e => onChange(`${year}-${String(e.target.value).padStart(2, '0')}`)}
        className="text-xs rounded px-1.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
      >
        {monthsForYear.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
      </select>
      <div className="flex items-center ml-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Previous month"
          className="text-xs px-2 py-1 rounded-l bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700"
        >←</button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Next month"
          className="text-xs px-2 py-1 rounded-r bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >→</button>
      </div>
    </div>
  )
}

function triggerCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function DownloadButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs py-1 px-2.5 rounded-md font-medium transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  )
}

// Long-format CSV: country × date × horizon (1/2/5/10y) × {nominal, inflation, real}.
function downloadHorizonsCSV(allData) {
  const header = ['country', 'slug', 'date', 'horizon_years', 'nominal_pct', 'expected_inflation_pct', 'real_pct']
  const rows = [header.join(',')]
  for (const c of orderCountries(allData)) {
    const stateByD = Object.fromEntries(c.filtered.map(p => [p.d, p]))
    for (const sv of c.svensson_params) {
      const state = stateByD[sv.d]
      if (!state) continue
      for (const tau of HORIZONS_YEARS) {
        const nominal = nominalAt(sv, tau, 'avg')
        const infl    = inflationAt(state, c.lambda, tau, 'avg')
        rows.push([
          c.name, c.slug, sv.d, tau,
          nominal.toFixed(4), infl.toFixed(4), (nominal - infl).toFixed(4),
        ].join(','))
      }
    }
  }
  triggerCSV(rows.join('\n'), 'real_rates_horizons.csv')
}

// Long-format CSV: country × date × tau_months (1..120) × {nominal, inflation, real, observed (where present)}.
function downloadTermStructureCSV(allData) {
  const header = ['country', 'slug', 'date', 'tau_months', 'nominal_pct', 'expected_inflation_pct', 'real_pct', 'observed_yield_pct']
  const rows = [header.join(',')]
  for (const c of orderCountries(allData)) {
    const stateByD = Object.fromEntries(c.filtered.map(p => [p.d, p]))
    const obsByDate = {}
    for (const r of c.observed_yields) {
      if (r.tau > 10) continue
      const key = r.d
      if (!obsByDate[key]) obsByDate[key] = {}
      obsByDate[key][Math.round(r.tau * 12)] = r.y
    }
    for (const sv of c.svensson_params) {
      const state = stateByD[sv.d]
      if (!state) continue
      const obsMap = obsByDate[sv.d] || {}
      for (let i = 1; i <= 120; i++) {
        const tau = i / 12
        const nominal = nominalAt(sv, tau, 'avg')
        const infl    = inflationAt(state, c.lambda, tau, 'avg')
        const obs     = obsMap[i]
        rows.push([
          c.name, c.slug, sv.d, i,
          nominal.toFixed(4), infl.toFixed(4), (nominal - infl).toFixed(4),
          obs != null ? obs.toFixed(4) : '',
        ].join(','))
      }
    }
  }
  triggerCSV(rows.join('\n'), 'real_term_structure.csv')
}

function HorizonSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">Horizon</span>
      <div className="flex items-center">
        {HORIZONS_YEARS.map((tau, i) => (
          <button
            key={tau}
            onClick={() => onChange(tau)}
            className={`text-xs px-3 py-1 transition-colors ${
              i === 0 ? 'rounded-l' : ''
            } ${
              i === HORIZONS_YEARS.length - 1 ? 'rounded-r' : 'border-r border-slate-200 dark:border-slate-700'
            } ${
              value === tau
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {tau}Y
          </button>
        ))}
      </div>
    </div>
  )
}

function CountrySelector({ countries, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">Country</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer min-w-[140px]"
      >
        {countries.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>
    </div>
  )
}

// ── § 1 — Snapshot across countries ─────────────────────────────────────────

function SnapshotSection({ allData }) {
  const [vintage, setVintage] = useSessionState('nsicx-real-snap-vintage', '2026-05')
  const [horizon, setHorizon] = useSessionState('nsicx-real-snap-horizon', 10)
  const mode = 'avg'
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  // Vintages where every country has both a Svensson fit and a filtered NSICX state.
  const commonMonths = useMemo(() => {
    if (!allData) return []
    const sets = allData.map(c => {
      const states = new Set(c.filtered.map(p => p.d))
      return new Set(c.svensson_params.map(p => p.d).filter(d => states.has(d)))
    })
    if (sets.length === 0) return []
    return [...sets[0]].filter(m => sets.every(s => s.has(m))).sort()
  }, [allData])

  const safeVintage = commonMonths.includes(vintage) ? vintage : commonMonths[commonMonths.length - 1]

  const rows = useMemo(() => {
    if (!allData || !safeVintage) return []
    const base = orderCountries(allData).map(c => {
      const state = c.filtered.find(p => p.d === safeVintage)
      const sv    = c.svensson_params.find(p => p.d === safeVintage)
      if (!state || !sv) return null
      const r = { slug: c.slug, name: c.name }
      for (const tau of HORIZONS_YEARS) {
        r['h' + tau] = +realAt(sv, state, c.lambda, tau, mode).toFixed(3)
      }
      return r
    }).filter(Boolean)
    const us = base.find(r => r.slug === 'usa')
    return base.map(r => {
      const out = { ...r }
      for (const tau of HORIZONS_YEARS) {
        out['dev' + tau] = us ? +(r['h' + tau] - us['h' + tau]).toFixed(3) : null
      }
      return out
    })
  }, [allData, safeVintage, mode])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => (a['h' + horizon] ?? 0) - (b['h' + horizon] ?? 0))
  }, [rows, horizon])

  if (!allData) return <div className="text-xs text-slate-500">Loading…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <YearMonthSelector months={commonMonths} value={safeVintage} onChange={setVintage} />
        <HorizonSelector value={horizon} onChange={setHorizon} />
        <div className="ml-auto">
          <DownloadButton
            onClick={() => allData && downloadHorizonsCSV(allData)}
            disabled={!allData}
            label="real_rates_horizons.csv"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Real avg-annualized rates (% p.a.) at {formatMonthYear(safeVintage)} across the 13 countries with a Svensson curve. Left: full table in regional order. Right: bars for the selected horizon, sorted ascending; color encodes the gap to the US at the same horizon — green at the US level, red for higher, blue for lower (±2pp clamp). Vintage range is the intersection where every country has both a Svensson fit and an NSICX state.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LHS: table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-1.5 pr-2 font-medium text-slate-500 dark:text-slate-400">Country</th>
                {HORIZONS_YEARS.map(tau => (
                  <th
                    key={tau}
                    onClick={() => setHorizon(tau)}
                    className={`text-right py-1.5 px-2 font-medium cursor-pointer transition-colors ${
                      horizon === tau
                        ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {tau}Y
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.slug} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="py-1 pr-2 text-slate-700 dark:text-slate-300">{r.name}</td>
                  {HORIZONS_YEARS.map(tau => (
                    <td
                      key={tau}
                      className={`text-right py-1 px-2 font-mono tabular-nums ${
                        horizon === tau
                          ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/10 font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {r['h' + tau] != null ? r['h' + tau].toFixed(2) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RHS: sorted bar chart for selected horizon (hidden on mobile to
            keep the table front-and-centre) */}
        <div className="hidden lg:block">
          <ResponsiveContainer width="100%" height={Math.max(360, sortedRows.length * 26)}>
            <BarChart data={sortedRows} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                     axisLine={{ stroke: theme.ui.axis }} tickLine={false}
                     tickFormatter={v => `${v.toFixed(1)}%`} />
              <YAxis type="category" dataKey="name" width={96}
                     tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                     axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={getTooltipStyle(isDark)}
                formatter={(v) => [`${(+v).toFixed(2)}%`, `${horizon}Y real rate`]}
                labelFormatter={n => n}
              />
              <ReferenceLine x={0} stroke={theme.ui.axis} strokeWidth={1} />
              <Bar dataKey={'h' + horizon} isAnimationActive={false}>
                {sortedRows.map(r => (
                  <Cell key={r.slug} fill={deviationFromUSColor(r['dev' + horizon], isDark)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── § 2 — Time series, single country ───────────────────────────────────────

function TimeSeriesSection({ allData }) {
  const [countrySlug, setCountrySlug] = useSessionState('nsicx-real-ts-country', 'usa')
  const [activeHorizons, setActiveHorizons] = useState(() => new Set(HORIZONS_YEARS))
  const mode = 'avg'
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  const toggleHorizon = (tau) => {
    setActiveHorizons(prev => {
      const next = new Set(prev)
      if (next.has(tau)) next.delete(tau)
      else next.add(tau)
      return next
    })
  }

  const countries = useMemo(() => (allData ? orderCountries(allData) : []), [allData])
  const safeSlug = countries.find(c => c.slug === countrySlug) ? countrySlug : (countries[0]?.slug ?? 'usa')
  const country = countries.find(c => c.slug === safeSlug)

  const rows = useMemo(() => {
    if (!country) return []
    const stateByD = Object.fromEntries(country.filtered.map(p => [p.d, p]))
    return country.svensson_params
      .filter(sv => stateByD[sv.d])
      .map(sv => {
        const state = stateByD[sv.d]
        const r = { d: sv.d }
        for (const tau of HORIZONS_YEARS) {
          r['h' + tau] = +realAt(sv, state, country.lambda, tau, mode).toFixed(3)
        }
        return r
      })
  }, [country, mode])

  if (!allData) return <div className="text-xs text-slate-500">Loading…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <CountrySelector countries={countries} value={safeSlug} onChange={setCountrySlug} />
        <div className="ml-auto">
          <DownloadButton
            onClick={() => allData && downloadHorizonsCSV(allData)}
            disabled={!allData}
            label="real_rates_horizons.csv"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Time series of avg-annualized real rate (% p.a.) at 1Y, 2Y, 5Y, 10Y horizons for {country?.name}. Click a horizon pill above the chart to toggle that line.
      </p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {HORIZONS_YEARS.map(tau => {
          const isActive = activeHorizons.has(tau)
          return (
            <button
              key={tau}
              onClick={() => toggleHorizon(tau)}
              className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all border ${
                isActive
                  ? 'border-transparent text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 bg-transparent'
              }`}
              style={isActive ? { backgroundColor: HORIZON_COLOR[tau] } : {}}
            >{tau}Y</button>
          )
        })}
      </div>
      <div className="h-[240px] lg:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} />
          <XAxis dataKey="d"
                 tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                 axisLine={{ stroke: theme.ui.axis }} tickLine={false}
                 tickFormatter={d => (d?.endsWith?.('-01') ? d.split('-')[0] : '')}
                 interval={11} />
          <YAxis tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                 axisLine={false} tickLine={false}
                 tickFormatter={v => `${v.toFixed(1)}%`} />
          <Tooltip
            contentStyle={getTooltipStyle(isDark)}
            formatter={(v, name) => [`${v != null ? (+v).toFixed(2) : '—'}%`, name]}
            labelFormatter={d => formatMonthYear(d)}
          />
          <ReferenceLine y={0} stroke={theme.ui.axis} strokeWidth={1} />
          {HORIZONS_YEARS.filter(tau => activeHorizons.has(tau)).map(tau => (
            <Line key={tau} type="monotone" dataKey={'h' + tau} name={`${tau}Y`}
                  stroke={HORIZON_COLOR[tau]} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── § 3 — Term structure decomposition ──────────────────────────────────────

function TermStructureSection({ allData }) {
  const [countrySlug, setCountrySlug] = useSessionState('nsicx-real-term-country', 'usa')
  const [vintage, setVintage]         = useSessionState('nsicx-real-term-vintage', '2026-05')
  const mode = 'avg'
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  const countries = useMemo(() => (allData ? orderCountries(allData) : []), [allData])
  const safeSlug = countries.find(c => c.slug === countrySlug) ? countrySlug : (countries[0]?.slug ?? 'usa')
  const country = countries.find(c => c.slug === safeSlug)

  const monthsForCountry = useMemo(() => {
    if (!country) return []
    const states = new Set(country.filtered.map(p => p.d))
    return country.svensson_params.map(p => p.d).filter(d => states.has(d)).sort()
  }, [country])

  const safeVintage = monthsForCountry.includes(vintage) ? vintage : monthsForCountry[monthsForCountry.length - 1]

  const data = useMemo(() => {
    if (!country || !safeVintage) return []
    const sv    = country.svensson_params.find(p => p.d === safeVintage)
    const state = country.filtered.find(p => p.d === safeVintage)
    if (!sv || !state) return []
    const obsMap = Object.fromEntries(
      country.observed_yields
        .filter(r => r.d === safeVintage && r.tau <= 10)
        .map(r => [Math.round(r.tau * 12), r.y])
    )
    const out = []
    for (let i = 1; i <= 120; i++) {
      const tau = i / 12
      const nominal = nominalAt(sv, tau, mode)
      const infl    = inflationAt(state, country.lambda, tau, mode)
      const row = {
        tauMonths: i,
        nominal:   +nominal.toFixed(3),
        inflation: +infl.toFixed(3),
        real:      +(nominal - infl).toFixed(3),
      }
      if (obsMap[i] != null) row.obs = +obsMap[i].toFixed(3)
      out.push(row)
    }
    return out
  }, [country, safeVintage, mode])

  // Tight Y domain from the actually-drawn data (curves + observed dots in avg mode).
  // Without this Recharts auto-pads to a "nice" round upper tick that can be 50%+
  // above the highest visible value.
  const yDomain = useMemo(() => {
    if (data.length === 0) return ['auto', 'auto']
    let lo = Infinity, hi = -Infinity
    for (const r of data) {
      const candidates = [r.nominal, r.inflation, r.real]
      if (mode === 'avg' && r.obs != null) candidates.push(r.obs)
      for (const v of candidates) {
        if (v == null) continue
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return ['auto', 'auto']
    const pad = Math.max(0.25, (hi - lo) * 0.08)
    return [Math.floor((lo - pad) * 2) / 2, Math.ceil((hi + pad) * 2) / 2]
  }, [data, mode])

  if (!allData) return <div className="text-xs text-slate-500">Loading…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <CountrySelector countries={countries} value={safeSlug} onChange={setCountrySlug} />
        <YearMonthSelector months={monthsForCountry} value={safeVintage} onChange={setVintage} />
        <div className="ml-auto">
          <DownloadButton
            onClick={() => allData && downloadTermStructureCSV(allData)}
            disabled={!allData}
            label="real_term_structure.csv"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {country?.name} at {formatMonthYear(safeVintage)}. Nominal avg-annualized yield from Svensson, expected inflation from NSICX, real = nominal − inflation. Dots: observed sovereign yields (≤10Y) at the selected vintage. Curves clipped at 10Y where NSICX is identified.
      </p>
      <div className="h-[260px] lg:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} />
          <XAxis type="number" dataKey="tauMonths" domain={[0, 120]}
                 ticks={[12, 24, 36, 60, 120]}
                 tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                 axisLine={{ stroke: theme.ui.axis }} tickLine={false}
                 tickFormatter={m => `${(m / 12)}y`} />
          <YAxis domain={yDomain}
                 tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
                 axisLine={false} tickLine={false}
                 tickFormatter={v => `${v.toFixed(1)}%`} />
          <Tooltip
            contentStyle={getTooltipStyle(isDark)}
            formatter={(v, name) => [v != null ? `${(+v).toFixed(2)}%` : '—', name]}
            labelFormatter={m => `${(m / 12).toFixed(2)} y`}
          />
          <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke={theme.ui.axis} strokeWidth={1} />
          <Line type="monotone" dataKey="nominal"   name="Nominal"            stroke={theme.colors.avg} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="inflation" name="Expected inflation" stroke="#f97316"          strokeWidth={1.6} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="real"      name="Real"               stroke="#10b981"          strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Scatter dataKey="obs" name="Observed yield" fill={theme.colors.cpi} shape="circle" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function MultiCountryRealRates() {
  const [manifest, setManifest] = useState(null)
  const [allData, setAllData]   = useState(null)
  const [openSection, setOpenSection] = useSessionState('nsicx-real-section', 'snapshot')

  useEffect(() => {
    fetch(`${MC_BASE}manifest.json`).then(r => r.json()).then(setManifest)
  }, [])

  useEffect(() => {
    if (!manifest) return
    const sv = manifest.countries.filter(c => c.has_svensson)
    Promise.all(sv.map(c =>
      Promise.all([
        fetch(`${MC_BASE}countries/${c.slug}/states.json`).then(r => r.json()),
        fetch(`${MC_BASE}countries/${c.slug}/svensson.json`).then(r => r.json()),
        fetch(`${MC_BASE}countries/${c.slug}/observed_yields.json`).then(r => r.json()),
      ]).then(([states, svensson, observed]) => ({
        slug: c.slug,
        name: c.name,
        lambda: states.lambda,
        filtered: states.filtered,
        svensson_params: svensson.params,
        observed_yields: observed.rows,
      }))
    )).then(setAllData)
  }, [manifest])

  // Always keep one section open — clicking the active header is a no-op.
  const safeOpen = ['snapshot', 'timeseries', 'termstructure'].includes(openSection) ? openSection : 'snapshot'
  const toggle = (id) => { if (id !== safeOpen) setOpenSection(id) }

  if (!manifest) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm py-6">Loading…</div>
  )

  return (
    <div className="space-y-3 py-2 max-w-6xl mx-auto">
      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
        Nominal curves are fitted to sovereign bond yields out to 30-year maturities using the
        Nelson-Siegel-Svensson model, with yields sampled mid-month to align with the timing of
        the Consensus surveys. Real = nominal Svensson − NSICX expected inflation, displayed to
        10Y where NSICX is identified. Available for the 13 economies with sovereign yield curves
        in haver-data (Brazil, Mexico, Russia, Turkey omitted).
      </p>
      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
        <AccordionSection title="Snapshot across countries"
                          isOpen={safeOpen === 'snapshot'}
                          onToggle={() => toggle('snapshot')}>
          <SnapshotSection allData={allData} />
        </AccordionSection>
        <AccordionSection title="Term structure snapshot"
                          isOpen={safeOpen === 'termstructure'}
                          onToggle={() => toggle('termstructure')}>
          <TermStructureSection allData={allData} />
        </AccordionSection>
        <AccordionSection title="Real rates history"
                          isOpen={safeOpen === 'timeseries'}
                          onToggle={() => toggle('timeseries')}>
          <TimeSeriesSection allData={allData} />
        </AccordionSection>
      </div>
    </div>
  )
}
