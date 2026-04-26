import { useState, useEffect } from 'react'
import NSFactorsChart from './charts/NSFactorsChart.jsx'
import RealRatesChart from './charts/RealRatesChart.jsx'
import BEIChart from './charts/BEIChart.jsx'

const CHART_ROWS = [
  {
    id: 'nsfactors',
    section: 'Smoothed model factors',
    title: 'Nelson-Siegel factors with uncertainty',
    finding: 'The level factor L shows a clear downward trend from the deflation era toward the 2% target, while slope and curvature capture short- and medium-run dynamics.',
    body: 'Smoothed state path with 68% and 95% credible intervals from 500 Durbin-Koopman simulation smoother draws. Toggle between Level, Slope, and Curvature factors.',
    dataKey: 'nsFactors',
  },
  {
    id: 'realrates',
    section: 'Ex-ante real rates',
    title: 'JGB nominal yield minus DNS-implied inflation expectations',
    finding: 'Real rates turned persistently negative under YCC and have only recently normalised following the 2024 rate hike.',
    body: 'Nominal JGB yields minus DNS-implied inflation expectations at each horizon. Vertical markers indicate major BoJ policy shifts. Toggle horizons to isolate the term structure of real rates.',
    dataKey: 'realRates',
  },
  {
    id: 'bei',
    section: 'Model vs market',
    title: 'BEI vs DNS model-implied expectations',
    finding: 'The wedge between break-even inflation and model-implied expectations narrows substantially post-2013, consistent with declining deflation risk and liquidity premia.',
    body: 'Break-even inflation (JGBi) versus DNS composite inflation expectations at 5Y and 10Y horizons. Toggle between horizons. The gap reflects risk premia, liquidity premia, and deflation probability.',
    dataKey: 'bei',
  },
]

function useChartData() {
  const [nsFactors, setNsFactors] = useState(null)
  const [realRates, setRealRates] = useState(null)
  const [bei, setBei] = useState(null)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}data/ns_factors_data.json`).then(r => r.json()),
      fetch(`${base}data/real_rates_data.json`).then(r => r.json()),
      fetch(`${base}data/bei_data.json`).then(r => r.json()),
    ]).then(([ns, rr, b]) => {
      setNsFactors(ns)
      setRealRates(rr)
      setBei(b)
    })
  }, [])

  return { nsFactors, realRates, bei }
}

export default function ChartsPanel() {
  const { nsFactors, realRates, bei } = useChartData()
  const dataMap = { nsFactors, realRates, bei }

  return (
    <div className="py-4 space-y-6">
      {CHART_ROWS.map((row, i) => (
        <ChartRow
          key={row.id}
          row={row}
          data={dataMap[row.dataKey]}
          last={i === CHART_ROWS.length - 1}
        />
      ))}
    </div>
  )
}

function ChartRow({ row, data, last }) {
  return (
    <div className={`flex flex-col md:flex-row gap-4 md:gap-6 ${!last ? 'pb-6 border-b border-slate-200/60 dark:border-slate-800/60' : ''}`}>

      {/* Chart */}
      <div className="flex-1 min-w-0 panel p-4 flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="label">{row.section}</span>
          <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
          <span className="text-xs text-slate-700 dark:text-slate-300">{row.title}</span>
        </div>
        <div style={{ height: '260px' }}>
          {row.id === 'nsfactors' && <NSFactorsChart data={data} />}
          {row.id === 'realrates' && <RealRatesChart data={data} />}
          {row.id === 'bei'       && <BEIChart data={data} />}
        </div>
      </div>

      {/* Annotation */}
      <div className="md:w-64 lg:w-72 md:shrink-0 flex flex-col justify-center gap-3">
        <div className="card p-4 border-l-2 border-indigo-600/60 rounded-l-none">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{row.finding}</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed px-1">{row.body}</p>
      </div>

    </div>
  )
}
