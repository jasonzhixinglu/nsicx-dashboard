import { useState, useEffect, useMemo, useCallback } from 'react'
import WhiskerChart from './charts/WhiskerChart.jsx'
import TermStructureChart from './charts/TermStructureChart.jsx'

function buildAndDownloadCSV(whiskerData) {
  const lam = whiskerData.lam ?? 0.15

  const nsAvg = (h, L, S, C) => {
    if (h < 1e-6) return L + S
    const eL = Math.exp(-lam * h)
    const L2 = (1 - eL) / (lam * h)
    const L3 = L2 - eL
    return L + L2 * S + L3 * C
  }

  const cpiMap = Object.fromEntries(whiskerData.cpi.map(p => [p.d, p.v]))
  const stateMap = Object.fromEntries(whiskerData.states.map(s => [s.d, s]))

  // Union of all dates, sorted, from 2002-01 onward
  const dates = [...new Set([
    ...whiskerData.cpi.map(p => p.d),
    ...whiskerData.states.map(s => s.d),
  ])].sort().filter(d => d >= '2002-01')

  const HORIZONS = [12, 24, 60, 120]

  const header = [
    'date', 'cpi_yoy',
    'dns_L', 'dns_S', 'dns_C',
    'avg_1Y', 'avg_2Y', 'avg_5Y', 'avg_10Y',
  ].join(',')

  const rows = dates.map(d => {
    const cpi = cpiMap[d]
    const s   = stateMap[d]
    const cols = [
      d,
      cpi != null ? cpi.toFixed(4) : '',
      s ? s.L.toFixed(4) : '',
      s ? s.S.toFixed(4) : '',
      s ? s.C.toFixed(4) : '',
      ...HORIZONS.map(h => s ? nsAvg(h, s.L, s.S, s.C).toFixed(4) : ''),
    ]
    return cols.join(',')
  })

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'japan_inflation_expectations.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatVintage(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  return `23 ${MONTH_NAMES[m - 1]} ${y}`
}

function formatMonthYear(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function prevMonthYear(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return `${MONTH_NAMES[pm - 1]} ${py}`
}

export default function OverviewPanel() {
  const [whiskerData, setWhiskerData] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/whisker_data.json`)
      .then(r => r.json())
      .then(d => {
        setWhiskerData(d)
        const last = d.whiskers[d.whiskers.length - 1]?.origin
        setSelectedDate(last ?? null)
        setLoading(false)
      })
  }, [])

  const stateMap = useMemo(() => {
    if (!whiskerData) return {}
    return Object.fromEntries(whiskerData.states.map(s => [s.d, s]))
  }, [whiskerData])

  const selectedState = selectedDate ? stateMap[selectedDate] ?? null : null
  const lam = whiskerData?.lam ?? 0.15

  const handleDownload = useCallback(() => {
    if (whiskerData) buildAndDownloadCSV(whiskerData)
  }, [whiskerData])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      Loading…
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:h-full md:overflow-hidden">

      {/* Left sidebar */}
      <div className="panel lg:w-[200px] xl:w-[220px] lg:shrink-0">

        {/* Mobile: collapsed toggle header */}
        <button
          className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          onClick={() => setSidebarOpen(o => !o)}
        >
          <span className="font-medium text-slate-700 dark:text-slate-300">Controls &amp; Legend</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`transition-transform shrink-0 ${sidebarOpen ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Content: always visible on desktop, toggled on mobile */}
        <div className={`flex flex-col gap-4 p-4 ${sidebarOpen ? 'flex' : 'hidden'} lg:flex`}>

        <div>
          <div className="label mb-2">Data vintage</div>
          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{formatVintage(selectedDate)}</div>
          <p className="text-xs text-slate-500 dark:text-slate-600 mt-1 leading-relaxed">
            Click or drag the upper chart to select a vintage.
          </p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <div>
          <div className="label mb-2">Model estimates</div>
          <button
            onClick={handleDownload}
            className="w-full text-xs py-1.5 px-2 rounded-md font-medium text-left transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download CSV
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-600 mt-1.5 leading-relaxed">
            CPI, DNS factors, avg annualized term structure.
          </p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <div className="space-y-1.5">
          <div className="label mb-2">Upper chart</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-4 h-px bg-slate-700 dark:bg-slate-100" />
            CPI YoY
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-4 h-px" style={{ background: 'rgba(148,163,184,0.45)' }} />
            DNS inst. forward
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
            Selected vintage
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <div className="space-y-1.5">
          <div className="label mb-2">Term structure</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#6366f1" strokeWidth="2" /></svg>
            Avg annualized
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
            Inst. forward
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="rgba(251,191,36,0.6)" strokeWidth="1" strokeDasharray="3 2" /></svg>
            BoJ target (2%)
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <NSEquations lam={lam} />

        </div>{/* end collapsible content */}
      </div>

      {/* Center — split panel */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 md:overflow-hidden md:min-h-0">

        {/* Upper: whisker chart */}
        <div className="panel p-3 flex flex-col gap-1 overflow-hidden md:flex-3 md:min-h-[180px]">
          <div className="flex items-baseline justify-between">
            <span className="label">DNS instantaneous forward inflation expectations vs realised CPI YoY</span>
            <span className="text-xs text-slate-400 dark:text-slate-600">Click or drag to select snapshot</span>
          </div>
          <div className="flex-1 min-h-0">
            <WhiskerChart
              data={whiskerData}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>

        {/* Lower: term structure snapshot */}
        <div className="panel p-3 flex flex-col gap-1 overflow-hidden md:flex-2 md:min-h-[180px]">
          <div className="flex items-baseline justify-between">
            <span className="label">
              Term structure of inflation expectations
              {selectedDate && <span className="text-indigo-600 dark:text-indigo-400 ml-2 normal-case">{selectedDate}</span>}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <TermStructureChart
              state={selectedState}
              lam={lam}
            />
          </div>
        </div>

      </div>

      {/* Right sidebar — key results */}
      <div className="lg:w-[180px] xl:w-[200px] lg:shrink-0 flex flex-col gap-3">
        <KeyResults state={selectedState} date={selectedDate} lam={lam} />
      </div>

    </div>
  )
}

function KeyResults({ state, date, lam }) {
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

  const color = (v) => v >= 2
    ? 'text-amber-500 dark:text-amber-400'
    : v > 0
      ? 'text-slate-700 dark:text-slate-200'
      : 'text-sky-600 dark:text-sky-400'

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
          <div className="grid grid-cols-5 gap-x-2">
            {readings.map(r => (
              <div key={r.label} className="text-center">
                <div className="text-xs text-slate-500">{r.label}</div>
                <div className={`text-sm font-mono font-semibold tabular-nums ${color(r.value)}`}>
                  {r.value.toFixed(2)}
                </div>
              </div>
            ))}
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
                <span className={`text-base font-mono font-semibold tabular-nums ${color(r.value)}`}>
                  {r.value.toFixed(2)}<span className="text-xs text-slate-400 dark:text-slate-600 ml-0.5">%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function NSEquations({ lam }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="label">NS equations</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform shrink-0 text-slate-400 dark:text-slate-500 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-3 text-xs font-mono text-slate-600 dark:text-slate-400">

          <div className="space-y-0.5">
            <div className="text-slate-500 font-sans mb-1">Inst. forward</div>
            <div>f(h) = L</div>
            <div className="pl-3">+ exp(−λh) · S</div>
            <div className="pl-3">+ λh·exp(−λh) · C</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-slate-500 font-sans mb-1">Avg annualized</div>
            <div>π(h) = L</div>
            <div className="pl-3">+ A(h) · S</div>
            <div className="pl-3">+ [A(h)−exp(−λh)] · C</div>
            <div className="text-slate-500 dark:text-slate-600 mt-1">A(h) = (1−exp(−λh))/(λh)</div>
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
            <span className="text-slate-500 font-sans">λ̂</span>
            <span className="text-indigo-600 dark:text-indigo-300">{lam.toFixed(4)}</span>
          </div>

        </div>
      )}
    </div>
  )
}
