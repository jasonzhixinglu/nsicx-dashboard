import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { CHART_THEME, TOOLTIP_STYLE } from '../../lib/chartTheme.js'

const HORIZON_CONFIG = {
  '5Y':  { dns: 'dns_60',  bei: 'bei_60',  dnsColor: CHART_THEME.colors.avg,       beiColor: CHART_THEME.colors.dnsFwd },
  '10Y': { dns: 'dns_120', bei: 'bei_120', dnsColor: '#a78bfa',                     beiColor: CHART_THEME.colors.curvature },
}

function downloadCSV(allSeries) {
  const header = ['date', 'dns_5Y', 'bei_5Y', 'dns_10Y', 'bei_10Y'].join(',')
  const rows = allSeries.filter(pt => pt.d >= '2002-01').map(pt => [
    pt.d,
    pt.dns_60  ?? '', pt.bei_60  ?? '',
    pt.dns_120 ?? '', pt.bei_120 ?? '',
  ].join(','))
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'bei_vs_dns_model.csv'
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function BEIChart({ data }) {
  const [horizon, setHorizon] = useState('5Y')

  if (!data) return <div className="flex items-center justify-center h-full text-xs text-slate-600">Loading…</div>

  const cfg    = HORIZON_CONFIG[horizon]
  const series = data.series.filter(r => r[cfg.dns] != null || r[cfg.bei] != null)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-1.5">
        {Object.keys(HORIZON_CONFIG).map(h => (
          <button
            key={h}
            onClick={() => setHorizon(h)}
            className={`text-xs px-3 py-0.5 rounded-md font-medium transition-all ${
              horizon === h
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >{h}</button>
        ))}
        <span className="text-xs text-slate-600 flex items-center ml-2">
          <span style={{ color: cfg.dnsColor }} className="mr-1">—</span> DNS model &nbsp;
          <span style={{ color: cfg.beiColor }} className="mr-1">—</span> BEI
        </span>
        <button
          onClick={() => downloadCSV(data.series)}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-all"
          title="Download BEI vs DNS model as CSV"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CSV
        </button>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.ui.grid} vertical={false} />
          <XAxis
            dataKey="d"
            type="category"
            tickFormatter={d => d.slice(0, 4)}
            ticks={series.filter(s => s.d.endsWith('-01') && +s.d.slice(0, 4) % 4 === 0).map(s => s.d)}
            tick={{ fontSize: 9, fill: CHART_THEME.ui.tickLabel }}
            axisLine={{ stroke: CHART_THEME.ui.axis }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: CHART_THEME.ui.tickLabel }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}%`}
            width={38}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, name) => [v != null ? `${v.toFixed(2)}%` : 'n/a', name]}
          />
          <ReferenceLine y={2} stroke="rgba(251,191,36,0.3)" strokeDasharray="4 3" />
          <Line
            type="monotone" dataKey={cfg.dns} name="DNS model"
            stroke={cfg.dnsColor} strokeWidth={2} dot={false}
            activeDot={{ r: 3 }} connectNulls={false}
          />
          <Line
            type="monotone" dataKey={cfg.bei} name="BEI"
            stroke={cfg.beiColor} strokeWidth={1.5} strokeDasharray="5 3"
            dot={false} activeDot={{ r: 3 }} connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
