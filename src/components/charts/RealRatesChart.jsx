import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

const LINES = [
  { key: 'rr_1Y',  label: '1Y',  color: '#6366f1' },
  { key: 'rr_2Y',  label: '2Y',  color: '#22d3ee' },
  { key: 'rr_5Y',  label: '5Y',  color: '#34d399' },
  { key: 'rr_10Y', label: '10Y', color: '#fb923c' },
]

// First month where all four horizons have nominal yield data
const COMMON_START = '2006-03'

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#cbd5e1',
}

function EventLabel({ viewBox, label }) {
  return (
    <g>
      <line
        x1={viewBox.x} x2={viewBox.x}
        y1={viewBox.y} y2={viewBox.y + viewBox.height}
        stroke="rgba(251,191,36,0.35)" strokeWidth={1} strokeDasharray="4 3"
      />
      <text
        x={viewBox.x + 3} y={viewBox.y + 10}
        fontSize={8} fill="rgba(251,191,36,0.6)"
      >{label}</text>
    </g>
  )
}

function downloadCSV(series) {
  const header = ['date', 'rr_1Y', 'rr_2Y', 'rr_5Y', 'rr_10Y'].join(',')
  const rows = series.map(pt =>
    [pt.d, pt.rr_1Y ?? '', pt.rr_2Y ?? '', pt.rr_5Y ?? '', pt.rr_10Y ?? ''].join(',')
  )
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'exante_real_rates.csv'
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function RealRatesChart({ data }) {
  const [active, setActive] = useState(new Set(LINES.map(l => l.key)))

  if (!data) return <div className="flex items-center justify-center h-full text-xs text-slate-600">Loading…</div>

  const toggle = (key) =>
    setActive(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Only show from the first month all horizons are available
  const series = data.series.filter(s => s.d >= COMMON_START)
  const ticks  = series.filter(s => s.d.endsWith('-01') && +s.d.slice(0, 4) % 4 === 0).map(s => s.d)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {LINES.map(l => (
          <button
            key={l.key}
            onClick={() => toggle(l.key)}
            className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all border ${
              active.has(l.key)
                ? 'border-transparent text-white'
                : 'border-slate-700 text-slate-500 bg-transparent'
            }`}
            style={active.has(l.key) ? { backgroundColor: l.color } : {}}
          >{l.label}</button>
        ))}
        <button
          onClick={() => downloadCSV(series)}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-all"
          title="Download ex-ante real rates as CSV"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CSV
        </button>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" vertical={false} />
          <XAxis
            dataKey="d"
            type="category"
            tickFormatter={d => d.slice(0, 4)}
            ticks={ticks}
            tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.8)' }}
            axisLine={{ stroke: 'rgba(51,65,85,0.6)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.8)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}%`}
            width={38}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, name) => [v != null ? `${v.toFixed(2)}%` : 'n/a', name]}
          />
          <ReferenceLine y={0} stroke="rgba(248,250,252,0.2)" strokeWidth={1} />
          {data.events
            .filter(ev => ev.d >= COMMON_START)
            .map(ev => (
              <ReferenceLine
                key={ev.d} x={ev.d}
                stroke="transparent"
                label={<EventLabel label={ev.label} />}
              />
            ))}
          {LINES.filter(l => active.has(l.key)).map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
