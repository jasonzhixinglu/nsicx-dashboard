import { useState, useEffect, useMemo, useCallback } from 'react'
import WhiskerChart from './charts/WhiskerChart.jsx'
import TermStructureChart from './charts/TermStructureChart.jsx'
import KeyResults from './KeyResults.jsx'
import { MONTH_NAMES, formatVintage, formatMonthYear } from '../lib/dateFormat.js'

function buildAndDownloadCSV(whiskerData) {
  const lam = whiskerData.lam ?? 0.15

  const nsAvg = (h, L, S, C) => {
    if (h < 1e-6) return L + S
    const eL = Math.exp(-lam * h)
    const L2 = (1 - eL) / (lam * h)
    const L3 = L2 - eL
    return L + L2 * S + L3 * C
  }

  const nsFwd = (h, L, S, C) => {
    const eL = Math.exp(-lam * h)
    return L + eL * S + lam * h * eL * C
  }

  const cpiMap = Object.fromEntries(whiskerData.cpi.map(p => [p.d, p.v]))
  const stateMap = Object.fromEntries(whiskerData.states.map(s => [s.d, s]))

  // Union of all dates, sorted, from 2002-01 onward
  const dates = [...new Set([
    ...whiskerData.cpi.map(p => p.d),
    ...whiskerData.states.map(s => s.d),
  ])].sort().filter(d => d >= '2002-01')

  const AVG_HORIZONS = [3, 12, 24, 60, 120]
  const FWD_HORIZONS = [3, 12, 24, 60, 120]

  const header = [
    'date', 'cpi_yoy',
    'nsicx_L', 'nsicx_S', 'nsicx_C',
    'avg_3M', 'avg_1Y', 'avg_2Y', 'avg_5Y', 'avg_10Y',
    'fwd_3M', 'fwd_1Y', 'fwd_2Y', 'fwd_5Y', 'fwd_10Y',
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
      ...AVG_HORIZONS.map(h => s ? nsAvg(h, s.L, s.S, s.C).toFixed(4) : ''),
      ...FWD_HORIZONS.map(h => s ? nsFwd(h, s.L, s.S, s.C).toFixed(4) : ''),
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

  const availableDates = useMemo(() =>
    whiskerData ? whiskerData.states.map(s => s.d) : [],
    [whiskerData]
  )

  const dataVintage = availableDates[availableDates.length - 1] ?? null

  const availableYears = useMemo(() =>
    [...new Set(availableDates.map(d => Number(d.split('-')[0])))].sort((a, b) => a - b),
    [availableDates]
  )

  const selYear  = selectedDate ? Number(selectedDate.split('-')[0]) : null
  const selMonth = selectedDate ? Number(selectedDate.split('-')[1]) : null
  const dateIndex = availableDates.indexOf(selectedDate)
  const canGoBack    = dateIndex > 0
  const canGoForward = dateIndex < availableDates.length - 1

  const monthsForSelYear = useMemo(() =>
    selYear ? availableDates.filter(d => d.startsWith(`${selYear}-`)).map(d => Number(d.split('-')[1])) : [],
    [availableDates, selYear]
  )

  const handleYearChange = useCallback((e) => {
    const newYear = Number(e.target.value)
    const months = availableDates.filter(d => d.startsWith(`${newYear}-`)).map(d => Number(d.split('-')[1]))
    const targetMonth = months.includes(selMonth) ? selMonth : months[months.length - 1]
    setSelectedDate(`${newYear}-${String(targetMonth).padStart(2, '0')}`)
  }, [availableDates, selMonth])

  const handleMonthChange = useCallback((e) => {
    const newMonth = Number(e.target.value)
    const newDate = `${selYear}-${String(newMonth).padStart(2, '0')}`
    if (stateMap[newDate]) setSelectedDate(newDate)
  }, [selYear, stateMap])

  const goBack    = useCallback(() => { if (canGoBack)    setSelectedDate(availableDates[dateIndex - 1]) }, [canGoBack,    availableDates, dateIndex])
  const goForward = useCallback(() => { if (canGoForward) setSelectedDate(availableDates[dateIndex + 1]) }, [canGoForward, availableDates, dateIndex])

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
          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{formatVintage(dataVintage)}</div>
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
            CPI, NSICX factors, avg annualized term structure.
          </p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <div className="space-y-1.5">
          <div className="label mb-2">Chart A: Whisker Chart</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-4 h-px bg-slate-700 dark:bg-slate-100" />
            CPI YoY
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-4 h-px" style={{ background: 'rgba(148,163,184,0.45)' }} />
            NSICX inst. forward
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
            Selected vintage
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <div className="space-y-1.5">
          <div className="label mb-2">Chart B: Term Structure</div>
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
            <span className="label">Chart A: Realized CPI YoY vs real-time forward rate inflation expectations</span>
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="label shrink-0">Chart B: Term structure of inflation expectations</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-500 shrink-0">Vintage:</span>
              <select
                value={selYear ?? ''}
                onChange={handleYearChange}
                className="text-xs rounded px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={selMonth ?? ''}
                onChange={handleMonthChange}
                className="text-xs rounded px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                {monthsForSelYear.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
              <div className="flex items-center">
                <button
                  onClick={goBack}
                  disabled={!canGoBack}
                  className="text-xs px-2 py-0.5 rounded-l bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700"
                >←</button>
                <button
                  onClick={goForward}
                  disabled={!canGoForward}
                  className="text-xs px-2 py-0.5 rounded-r bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >→</button>
              </div>
            </div>
          </div>
          <div className="md:flex-1 md:min-h-0" style={{ height: '200px' }}>
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
            <span className="text-slate-500 font-sans">est. λ</span>
            <span className="text-indigo-600 dark:text-indigo-300">{lam.toFixed(4)}</span>
          </div>

        </div>
      )}
    </div>
  )
}
