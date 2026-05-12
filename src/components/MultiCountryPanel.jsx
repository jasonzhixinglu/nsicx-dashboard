import { useState, useEffect, useMemo, useCallback } from 'react'
import WhiskerChart from './charts/WhiskerChart.jsx'
import TermStructureChart from './charts/TermStructureChart.jsx'
import KeyResults from './KeyResults.jsx'
import { MONTH_NAMES, formatVintage } from '../lib/dateFormat.js'
import { avgAnnualized, fwdInstant, addMonths } from '../lib/nsCurve.js'

const MC_BASE = `${import.meta.env.BASE_URL}data/multicountry/`

const PRESENTATION_START = '2002-01'
const WHISKER_HORIZONS = [3, 6, 9, 12, 15, 18, 21, 24]

const REGIONS = [
  { label: 'Americas',     slugs: ['usa', 'canada', 'mexico', 'brazil'] },
  { label: 'Europe',       slugs: ['uk', 'france', 'germany', 'italy'] },
  { label: 'Asia-Pacific', slugs: ['japan', 'china', 'south_korea', 'india', 'indonesia'] },
  { label: 'Oceania',      slugs: ['australia', 'new_zealand'] },
  { label: 'Eastern Europe', slugs: ['russia', 'turkey'] },
]

// Central bank inflation targets (latest stated targets as of 2026)
// AEs and China at 2-3%; EM with higher targets reflect their distinct policy regimes.
const INFLATION_TARGETS = {
  usa:         { value: 2,   bank: 'Fed' },
  canada:      { value: 2,   bank: 'BoC' },
  uk:          { value: 2,   bank: 'BoE' },
  france:      { value: 2,   bank: 'ECB' },
  germany:     { value: 2,   bank: 'ECB' },
  italy:       { value: 2,   bank: 'ECB' },
  japan:       { value: 2,   bank: 'BoJ' },
  south_korea: { value: 2,   bank: 'BoK' },
  china:       { value: 2,   bank: 'PBoC' },
  india:       { value: 4,   bank: 'RBI' },
  indonesia:   { value: 2.5, bank: 'BI' },
  australia:   { value: 2.5, bank: 'RBA' },
  new_zealand: { value: 2,   bank: 'RBNZ' },
  brazil:      { value: 3,   bank: 'BCB' },
  mexico:      { value: 3,   bank: 'Banxico' },
  russia:      { value: 4,   bank: 'CBR' },
  turkey:      { value: 5,   bank: 'CBRT' },
}

const EXPORT_HORIZONS = [3, 12, 24, 60, 120]
const EXPORT_HORIZON_LABELS = ['3M', '1Y', '2Y', '5Y', '10Y']

function buildCountrySheet(XLSX, country) {
  const lam = country.states.lambda
  const filtered = country.states.filtered.filter(p => p.d >= PRESENTATION_START)
  const cpiMap = Object.fromEntries(country.cpi.yoy_pct.map(p => [p.d, p.v]))
  const stateMap = Object.fromEntries(filtered.map(s => [s.d, s]))

  const dates = [...new Set([
    ...Object.keys(cpiMap),
    ...Object.keys(stateMap),
  ])].sort().filter(d => d >= PRESENTATION_START)

  const header = [
    'date', 'cpi_yoy',
    'nsicx_L', 'nsicx_S', 'nsicx_C',
    ...EXPORT_HORIZON_LABELS.map(h => `avg_${h}`),
    ...EXPORT_HORIZON_LABELS.map(h => `fwd_${h}`),
  ]

  const rows = dates.map(d => {
    const cpi = cpiMap[d]
    const s = stateMap[d]
    return [
      d,
      cpi != null ? +cpi.toFixed(4) : null,
      s ? +s.L.toFixed(4) : null,
      s ? +s.S.toFixed(4) : null,
      s ? +s.C.toFixed(4) : null,
      ...EXPORT_HORIZONS.map(h => s ? +avgAnnualized(s.L, s.S, s.C, lam, h).toFixed(4) : null),
      ...EXPORT_HORIZONS.map(h => s ? +fwdInstant(s.L, s.S, s.C, lam, h).toFixed(4) : null),
    ]
  })

  return XLSX.utils.aoa_to_sheet([header, ...rows])
}

async function downloadAllCountriesWorkbook(manifest) {
  const XLSX = await import('xlsx')

  const fetches = manifest.countries.map(c =>
    Promise.all([
      fetch(`${MC_BASE}countries/${c.slug}/states.json`).then(r => r.json()),
      fetch(`${MC_BASE}countries/${c.slug}/cpi.json`).then(r => r.json()),
    ]).then(([states, cpi]) => ({ ...c, states, cpi }))
  )
  const all = await Promise.all(fetches)

  const wb = XLSX.utils.book_new()

  const metaRows = [
    ['Multi-country NSICX dashboard data export'],
    ['Generated:', manifest.generated_at],
    ['Schema version:', manifest.schema_version],
    ['Pipeline variant:', manifest.pipeline_variant ?? 'production'],
    [],
    ['Each country sheet contains: date, cpi_yoy, nsicx_L/S/C, avg & fwd term structure (3M, 1Y, 2Y, 5Y, 10Y).'],
    ['avg_h = average annualized rate over horizon h months. fwd_h = instantaneous forward at horizon h.'],
    ['Period: 2002-01 onward (Kalman state initialization period excluded).'],
    [],
    ['country', 'slug', 'lambda', 'last_vintage', 'n_obs', 'cpi_start', 'cpi_end'],
    ...all.map(c => [
      c.name,
      c.slug,
      +Number(c.states.lambda).toFixed(6),
      c.last_vintage,
      c.T,
      c.cpi.yoy_pct[0]?.d ?? '',
      c.cpi.yoy_pct[c.cpi.yoy_pct.length - 1]?.d ?? '',
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Metadata')

  for (const c of all) {
    const sheetName = c.name.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, buildCountrySheet(XLSX, c), sheetName)
  }

  XLSX.writeFile(wb, 'multicountry_nsicx.xlsx')
}

function buildWhiskerShape(country) {
  if (!country) return null
  const { lambda, filtered, cpi } = country

  const states = filtered
    .filter(p => p.d >= PRESENTATION_START)
    .map(p => ({ d: p.d, L: p.L, S: p.S, C: p.C }))

  const cpiSeries = cpi.yoy_pct
    .filter(p => p.d >= PRESENTATION_START)
    .map(p => ({ d: p.d, v: p.v }))

  // Quarterly origins: any month where month index ∈ {1,4,7,10}
  const quarterly = states.filter(s => {
    const m = Number(s.d.split('-')[1])
    return m === 1 || m === 4 || m === 7 || m === 10
  })

  const whiskers = quarterly.map(s => ({
    origin: s.d,
    pts: WHISKER_HORIZONS.map(h => ({
      d: addMonths(s.d, h),
      v: +fwdInstant(s.L, s.S, s.C, lambda, h).toFixed(4),
    })),
  }))

  return {
    lam: lambda,
    cpi: cpiSeries,
    states,
    whiskers,
    whisker_horizons: WHISKER_HORIZONS,
  }
}

function getCountryFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('country')
}

function setCountryInUrl(slug) {
  const params = new URLSearchParams(window.location.search)
  params.set('country', slug)
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
  window.history.replaceState({}, '', newUrl)
}

export default function MultiCountryPanel() {
  const [manifest, setManifest] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [countryData, setCountryData] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Fetch manifest once on mount.
  useEffect(() => {
    fetch(`${MC_BASE}manifest.json`)
      .then(r => r.json())
      .then(m => {
        setManifest(m)
        const urlSlug = getCountryFromUrl()
        const known = m.countries.find(c => c.slug === urlSlug)?.slug
        setSelectedCountry(known ?? REGIONS[0].slugs[0])
      })
  }, [])

  // Fetch country data when selection changes.
  useEffect(() => {
    if (!selectedCountry) return
    setLoading(true)
    setCountryData(null)
    Promise.all([
      fetch(`${MC_BASE}countries/${selectedCountry}/states.json`).then(r => r.json()),
      fetch(`${MC_BASE}countries/${selectedCountry}/cpi.json`).then(r => r.json()),
    ]).then(([states, cpi]) => {
      setCountryData({ ...states, cpi })
      setLoading(false)
    })
  }, [selectedCountry])

  const whiskerShape = useMemo(() => buildWhiskerShape(countryData), [countryData])

  const stateMap = useMemo(() => {
    if (!whiskerShape) return {}
    return Object.fromEntries(whiskerShape.states.map(s => [s.d, s]))
  }, [whiskerShape])

  const availableDates = useMemo(() =>
    whiskerShape ? whiskerShape.states.map(s => s.d) : [],
    [whiskerShape]
  )

  const dataVintage = availableDates[availableDates.length - 1] ?? null

  const availableYears = useMemo(() =>
    [...new Set(availableDates.map(d => Number(d.split('-')[0])))].sort((a, b) => a - b),
    [availableDates]
  )

  // Initialize selectedDate to latest when country data loads
  useEffect(() => {
    if (whiskerShape && !selectedDate) {
      setSelectedDate(whiskerShape.states[whiskerShape.states.length - 1]?.d ?? null)
    }
  }, [whiskerShape, selectedDate])

  // Reset selectedDate when country changes (so we always start at latest of new country)
  useEffect(() => {
    if (countryData) {
      const last = countryData.filtered
        .filter(p => p.d >= PRESENTATION_START)
        .slice(-1)[0]?.d
      setSelectedDate(last ?? null)
    }
  }, [countryData])

  const selYear  = selectedDate ? Number(selectedDate.split('-')[0]) : null
  const selMonth = selectedDate ? Number(selectedDate.split('-')[1]) : null
  const dateIndex = availableDates.indexOf(selectedDate)
  const canGoBack    = dateIndex > 0
  const canGoForward = dateIndex >= 0 && dateIndex < availableDates.length - 1

  const monthsForSelYear = useMemo(() =>
    selYear ? availableDates.filter(d => d.startsWith(`${selYear}-`)).map(d => Number(d.split('-')[1])) : [],
    [availableDates, selYear]
  )

  const handleCountryChange = useCallback((e) => {
    const slug = e.target.value
    setSelectedCountry(slug)
    setCountryInUrl(slug)
  }, [])

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

  const handleDownload = useCallback(async () => {
    if (!manifest || downloading) return
    setDownloading(true)
    try {
      await downloadAllCountriesWorkbook(manifest)
    } finally {
      setDownloading(false)
    }
  }, [manifest, downloading])

  const selectedState = selectedDate ? stateMap[selectedDate] ?? null : null
  const lam = whiskerShape?.lam ?? 0.15
  const targetCfg = INFLATION_TARGETS[selectedCountry] ?? { value: 2, bank: '' }
  const targetLabel = targetCfg.bank ? `${targetCfg.bank} target` : 'Target'

  if (!manifest) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      Loading…
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:h-full md:overflow-hidden">

      {/* Left sidebar */}
      <div className="lg:w-[220px] xl:w-[240px] lg:shrink-0 card lg:overflow-y-auto md:max-h-full md:flex md:flex-col">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="lg:hidden flex items-center justify-between p-3 w-full text-left border-b border-slate-200 dark:border-slate-800"
        >
          <span className="label">Controls</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
               className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={`flex flex-col gap-4 p-4 ${sidebarOpen ? 'flex' : 'hidden'} lg:flex`}>

          <div>
            <div className="label mb-2">Country</div>
            <select
              value={selectedCountry ?? ''}
              onChange={handleCountryChange}
              className="w-full text-sm rounded px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {REGIONS.map(region => {
                const items = region.slugs
                  .map(slug => manifest.countries.find(c => c.slug === slug))
                  .filter(Boolean)
                if (items.length === 0) return null
                return (
                  <optgroup key={region.label} label={region.label}>
                    {items.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>

          <div>
            <div className="label mb-2">Data vintage</div>
            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{formatVintage(dataVintage)}</div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800" />

          <div>
            <div className="label mb-2">Download</div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full text-xs py-1.5 px-2 rounded-md font-medium text-left transition-all bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {downloading ? 'Building…' : 'multicountry_nsicx.xlsx'}
            </button>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800" />

          <div className="space-y-1.5">
            <div className="label mb-2">Chart A: Whisker chart</div>
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
            <div className="label mb-2">Chart B: Term structure</div>
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
              {targetCfg.bank ? `${targetCfg.bank} target (${targetCfg.value}%)` : `Target (${targetCfg.value}%)`}
            </div>
          </div>
        </div>
      </div>

      {/* Center column */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 md:overflow-hidden md:min-h-0">

        {loading || !whiskerShape ? (
          <div className="panel p-3 flex items-center justify-center text-xs text-slate-500" style={{ minHeight: 200 }}>
            Loading {manifest.countries.find(c => c.slug === selectedCountry)?.name ?? ''}…
          </div>
        ) : (
          <>
            <div className="panel p-3 flex flex-col gap-1 overflow-hidden md:flex-3 md:min-h-[180px]">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="label">
                  Chart A: Realized CPI YoY vs Consensus-implied NSICX forwards
                  {countryData?.cpi?.realized_cpi_source === 'interpolated_quarterly' && (
                    <span className="ml-1 text-xs italic font-normal text-slate-400 dark:text-slate-500" title="Source publishes CPI quarterly; monthly path is interpolated. See About → Methodology.">
                      (quarterly CPI, monthly steps interpolated)
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-600">Click or drag to select snapshot</span>
              </div>
              <div className="flex-1 min-h-0">
                <WhiskerChart
                  data={whiskerShape}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  target={targetCfg.value}
                />
              </div>
            </div>

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
                  target={targetCfg.value}
                  targetLabel={targetLabel}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right sidebar — KeyResults */}
      <div className="lg:w-[180px] xl:w-[200px] lg:shrink-0 flex flex-col gap-3">
        <KeyResults state={selectedState} date={selectedDate} lam={lam} target={targetCfg.value} />
      </div>

    </div>
  )
}
