import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { getTheme, getTooltipStyle } from '../../lib/chartTheme.js'
import { useDarkMode } from '../../lib/useDarkMode.jsx'

function nsAvg(h, lam) {
  if (h < 1e-6) return [1, 1, 0]
  const eL = Math.exp(-lam * h)
  const L2 = (1 - eL) / (lam * h)
  const L3 = L2 - eL
  return [1, L2, L3]
}

function nsFwdInstant(h, lam) {
  const eL = Math.exp(-lam * h)
  return [1, eL, lam * h * eL]
}

export function computeCurve(state, lam, mode, maxH = 120) {
  const fn = mode === 'avg' ? nsAvg : nsFwdInstant
  const pts = []
  for (let h = 1; h <= maxH; h++) {
    const [l1, l2, l3] = fn(h, lam)
    const v = l1 * state.L + l2 * state.S + l3 * state.C
    pts.push({ h, v: +v.toFixed(4) })
  }
  return pts
}


function TargetLabel({ viewBox, isDark }) {
  return (
    <text
      x={viewBox.x + viewBox.width - 4}
      y={viewBox.y - 4}
      fontSize={8}
      fill={isDark ? 'rgba(251,191,36,0.7)' : 'rgba(161,80,0,0.8)'}
      textAnchor="end"
    >
      BoJ target
    </text>
  )
}

export default function TermStructureChart({ state, lam }) {
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  if (!state) return (
    <div className="flex items-center justify-center h-full text-xs text-slate-500">
      Select a date above
    </div>
  )

  // Merge both curves into a single data array for recharts
  const avgCurve = computeCurve(state, lam, 'avg')
  const fwdCurve = computeCurve(state, lam, 'fwd')
  const data = avgCurve.map((pt, i) => ({
    h: pt.h,
    avg: pt.v,
    fwd: fwdCurve[i].v,
  }))

  const REFS = [
    { h: 12,  label: '1Y' },
    { h: 24,  label: '2Y' },
    { h: 60,  label: '5Y' },
    { h: 120, label: '10Y' },
  ]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.ui.grid} vertical={false} />
        <XAxis
          dataKey="h"
          type="number"
          domain={[1, 120]}
          ticks={[12, 24, 36, 60, 84, 120]}
          tickFormatter={h => `${h}m`}
          tick={{ fontSize: 9, fill: theme.ui.tickLabel }}
          axisLine={{ stroke: theme.ui.axis }}
          tickLine={false}
          label={{ value: 'Horizon (months)', position: 'insideBottom', offset: -12, fontSize: 9, fill: theme.ui.tickLabel }}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fontSize: 9, fill: theme.ui.tickLabel }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v.toFixed(1)}%`}
          width={38}
        />
        <Tooltip
          contentStyle={getTooltipStyle(isDark)}
          formatter={(v, name) => [`${v.toFixed(3)}%`, name === 'avg' ? 'Avg annualized' : 'Inst. forward']}
          labelFormatter={(h) => `Horizon: ${h}m`}
        />
        <ReferenceLine y={2} stroke={theme.colors.target} strokeDasharray="4 3" label={<TargetLabel isDark={isDark} />} />
        {REFS.map(r => (
          <ReferenceLine
            key={r.h} x={r.h}
            stroke={theme.ui.grid}
            strokeDasharray="3 3"
            label={{ value: r.label, position: 'top', fontSize: 8, fill: theme.ui.tickLabel }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="avg"
          name="avg"
          stroke={theme.colors.avg}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: isDark ? '#818cf8' : '#6366f1' }}
        />
        <Line
          type="monotone"
          dataKey="fwd"
          name="fwd"
          stroke={theme.colors.dnsFwd}
          strokeWidth={theme.strokeWidths.dnsLine}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 3, fill: isDark ? '#67e8f9' : '#22d3ee' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
