import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

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

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#cbd5e1',
}

function TargetLabel({ viewBox }) {
  return (
    <text
      x={viewBox.x + viewBox.width - 4}
      y={viewBox.y - 4}
      fontSize={8}
      fill="rgba(251,191,36,0.7)"
      textAnchor="end"
    >
      BoJ target
    </text>
  )
}

export default function TermStructureChart({ state, lam }) {
  if (!state) return (
    <div className="flex items-center justify-center h-full text-xs text-slate-600">
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" vertical={false} />
        <XAxis
          dataKey="h"
          type="number"
          domain={[1, 120]}
          ticks={[12, 24, 36, 60, 84, 120]}
          tickFormatter={h => `${h}m`}
          tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.8)' }}
          axisLine={{ stroke: 'rgba(51,65,85,0.6)' }}
          tickLine={false}
          label={{ value: 'Horizon (months)', position: 'insideBottom', offset: -12, fontSize: 9, fill: 'rgba(148,163,184,0.6)' }}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.8)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v.toFixed(1)}%`}
          width={38}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name) => [`${v.toFixed(3)}%`, name === 'avg' ? 'Avg annualized' : 'Inst. forward']}
          labelFormatter={(h) => `Horizon: ${h}m`}
        />
        <ReferenceLine y={2} stroke="rgba(251,191,36,0.45)" strokeDasharray="4 3" label={<TargetLabel />} />
        {REFS.map(r => (
          <ReferenceLine
            key={r.h} x={r.h}
            stroke="rgba(51,65,85,0.5)"
            strokeDasharray="3 3"
            label={{ value: r.label, position: 'top', fontSize: 8, fill: 'rgba(148,163,184,0.5)' }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="avg"
          name="avg"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#818cf8' }}
        />
        <Line
          type="monotone"
          dataKey="fwd"
          name="fwd"
          stroke="#22d3ee"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 3, fill: '#67e8f9' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
