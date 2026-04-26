import { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getTheme, getTooltipStyle } from '../../lib/chartTheme.js'
import { useDarkMode } from '../../lib/useDarkMode.jsx'

const FACTOR_CONFIGS = [
  { key: 'L', label: 'Level',     colorKey: 'avg',       desc: 'Long-run inflation trend' },
  { key: 'S', label: 'Slope',     colorKey: 'slope',     desc: 'Short-run deviation from trend' },
  { key: 'C', label: 'Curvature', colorKey: 'curvature', desc: 'Medium-term hump' },
]

function downloadFactorCSV(data) {
  const header = [
    'date',
    'L_smoothed', 'L_lo68', 'L_hi68', 'L_lo95', 'L_hi95',
    'S_smoothed', 'S_lo68', 'S_hi68', 'S_lo95', 'S_hi95',
    'C_smoothed', 'C_lo68', 'C_hi68', 'C_lo95', 'C_hi95',
  ].join(',')

  const rows = data.series.map(pt => [
    pt.d,
    pt.L_smo,  pt.L_lo68, pt.L_hi68, pt.L_lo95, pt.L_hi95,
    pt.S_smo,  pt.S_lo68, pt.S_hi68, pt.S_lo95, pt.S_hi95,
    pt.C_smo,  pt.C_lo68, pt.C_hi68, pt.C_lo95, pt.C_hi95,
  ].join(','))

  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'dns_factors_with_ci.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function NSFactorsChart({ data }) {
  const [factor, setFactor] = useState('L')
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  if (!data) return <div className="flex items-center justify-center h-full text-xs text-slate-500">Loading…</div>

  const cfg   = FACTOR_CONFIGS.find(f => f.key === factor)
  const color = theme.colors[cfg.colorKey]

  const series = data.series.map(pt => ({
    d:    pt.d,
    smo:  pt[`${factor}_smo`],
    lo95: pt[`${factor}_lo95`],
    w95:  +(pt[`${factor}_hi95`] - pt[`${factor}_lo95`]).toFixed(4),
    lo68: pt[`${factor}_lo68`],
    w68:  +(pt[`${factor}_hi68`] - pt[`${factor}_lo68`]).toFixed(4),
  }))

  const ticks = series
    .filter(s => s.d.endsWith('-01') && +s.d.slice(0, 4) % 4 === 0)
    .map(s => s.d)

  return (
    <div className="flex flex-col h-full gap-2">

      <div className="flex flex-wrap gap-1.5 items-center">
        {FACTOR_CONFIGS.map(f => {
          const fColor = theme.colors[f.colorKey]
          return (
            <button
              key={f.key}
              onClick={() => setFactor(f.key)}
              className={`text-xs px-3 py-0.5 rounded-md font-medium transition-all border ${
                factor === f.key
                  ? 'border-transparent text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 bg-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              style={factor === f.key ? { backgroundColor: fColor } : {}}
            >{f.label}</button>
          )
        })}
        <span className="text-xs text-slate-500 dark:text-slate-600 ml-1">{cfg.desc}</span>

        <span className="ml-auto flex items-center gap-3 text-xs text-slate-500 dark:text-slate-600">
          <span className="flex items-center gap-1">
            <svg width="28" height="8">
              <rect x="0" y="1" width="28" height="6" rx="1" fill={color} opacity="0.12"/>
              <rect x="0" y="2" width="28" height="4" rx="1" fill={color} opacity="0.20"/>
            </svg>
            68 / 95% CI
          </span>
          <span className="flex items-center gap-1">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.8"/></svg>
            Smoothed
          </span>
          <button
            onClick={() => downloadFactorCSV(data)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all"
            title="Download DNS factors with CIs as CSV"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            CSV
          </button>
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} vertical={false} />
          <XAxis
            dataKey="d"
            type="category"
            tickFormatter={d => d.slice(0, 4)}
            ticks={ticks}
            tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
            axisLine={{ stroke: theme.ui.axis }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: theme.ui.tickFontSize, fill: theme.ui.tickLabel }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}%`}
            width={38}
          />
          <Tooltip
            contentStyle={getTooltipStyle(isDark)}
            formatter={(v, name) => name === 'smo' ? [`${v.toFixed(3)}%`, 'Smoothed'] : null}
            labelFormatter={d => d}
          />
          <ReferenceLine y={0} stroke={isDark ? 'rgba(248,250,252,0.15)' : 'rgba(15,23,42,0.15)'} strokeWidth={1} />

          {/* 95% band */}
          <Area type="monotone" dataKey="lo95" stroke="none" fill="transparent"
            stackId="ci95" legendType="none" activeDot={false} dot={false} />
          <Area type="monotone" dataKey="w95" stroke="none" fill={color} fillOpacity={0.10}
            stackId="ci95" legendType="none" activeDot={false} dot={false} />

          {/* 68% band */}
          <Area type="monotone" dataKey="lo68" stroke="none" fill="transparent"
            stackId="ci68" legendType="none" activeDot={false} dot={false} />
          <Area type="monotone" dataKey="w68" stroke="none" fill={color} fillOpacity={0.22}
            stackId="ci68" legendType="none" activeDot={false} dot={false} />

          {/* Smoothed state line */}
          <Line type="monotone" dataKey="smo" name="smo"
            stroke={color} strokeWidth={1.8}
            dot={false} activeDot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

    </div>
  )
}
