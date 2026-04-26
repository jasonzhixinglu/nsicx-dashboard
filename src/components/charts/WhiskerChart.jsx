import { useRef, useEffect, useState, useCallback } from 'react'
import { getTheme } from '../../lib/chartTheme.js'
import { useDarkMode } from '../../lib/useDarkMode.jsx'

const MARGIN = { top: 16, right: 16, bottom: 36, left: 44 }

// Parse "YYYY-MM" → Date (first of month)
function parseDate(s) {
  const [y, m] = s.split('-')
  return new Date(+y, +m - 1, 1)
}

function dateToX(date, xMin, xMax, width) {
  const t0 = xMin.getTime(), t1 = xMax.getTime()
  return ((date.getTime() - t0) / (t1 - t0)) * width
}

function valToY(v, yMin, yMax, height) {
  return height - ((v - yMin) / (yMax - yMin)) * height
}

function nearestOrigin(px, whiskers, xMin, xMax, width) {
  let best = null, bestDx = Infinity
  for (const w of whiskers) {
    const d = parseDate(w.origin)
    const x = dateToX(d, xMin, xMax, width)
    const dx = Math.abs(x - px)
    if (dx < bestDx) { bestDx = dx; best = w.origin }
  }
  return best
}

export default function WhiskerChart({ data, selectedDate, onSelectDate }) {
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ width: 600, height: 220 })
  const dragging = useRef(false)
  const { isDark } = useDarkMode()
  const theme = getTheme(isDark)

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: cH } = e.contentRect
      if (w > 0) {
        const aspectH = Math.round(w * 0.54)
        setDims({ width: w, height: cH > 64 ? Math.min(aspectH, cH) : aspectH })
      }
    })
    ro.observe(svgRef.current.parentElement)
    return () => ro.disconnect()
  }, [])

  const { width, height } = dims
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  if (!data || !data.whiskers.length) return (
    <div className="flex items-center justify-center h-48 text-xs text-slate-500">Loading…</div>
  )

  // Date extent: from first CPI point to last whisker target
  const allDates = [
    ...data.cpi.map(d => parseDate(d.d)),
    ...data.whiskers.flatMap(w => w.pts.map(p => parseDate(p.d))),
  ]
  const xMin = new Date(Math.min(...allDates.map(d => d.getTime())))
  const xMax = new Date(Math.max(...allDates.map(d => d.getTime())))

  // Y extent from all values + some padding
  const allVals = [
    ...data.cpi.map(d => d.v),
    ...data.whiskers.flatMap(w => w.pts.map(p => p.v)),
  ]
  const rawMin = Math.min(...allVals), rawMax = Math.max(...allVals)
  const pad = (rawMax - rawMin) * 0.12
  const yMin = rawMin - pad, yMax = rawMax + pad

  const X = (date) => dateToX(date, xMin, xMax, innerW)
  const Y = (v)    => valToY(v, yMin, yMax, innerH)

  // CPI path
  const cpiPath = data.cpi
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${X(parseDate(pt.d)).toFixed(1)},${Y(pt.v).toFixed(1)}`)
    .join(' ')

  // Year tick positions
  const yearTicks = []
  for (let yr = xMin.getFullYear() + 1; yr <= xMax.getFullYear(); yr++) {
    if (yr % 4 === 0 || yr === xMin.getFullYear() + 1) {
      const x = X(new Date(yr, 0, 1))
      if (x > 0 && x < innerW) yearTicks.push({ x, label: String(yr) })
    }
  }

  // Y ticks
  const yTickCount = 5
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const v = yMin + (i / (yTickCount - 1)) * (yMax - yMin)
    return { y: Y(v), label: v.toFixed(1) }
  })

  // Interaction
  const getSvgX = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return e.clientX - rect.left - MARGIN.left
  }, [])

  const handleMouseDown = useCallback((e) => {
    dragging.current = true
    const px = getSvgX(e)
    const origin = nearestOrigin(px, data.whiskers, xMin, xMax, innerW)
    if (origin) onSelectDate(origin)
  }, [data, xMin, xMax, innerW, onSelectDate, getSvgX])

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return
    const px = getSvgX(e)
    const origin = nearestOrigin(px, data.whiskers, xMin, xMax, innerW)
    if (origin) onSelectDate(origin)
  }, [data, xMin, xMax, innerW, onSelectDate, getSvgX])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  // Selected line x position
  const selectedX = selectedDate
    ? X(parseDate(selectedDate))
    : null

  const sw = theme.strokeWidths

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

        {/* Grid lines */}
        {yTicks.map(t => (
          <line key={t.y} x1={0} x2={innerW} y1={t.y} y2={t.y}
            stroke={theme.ui.grid} strokeWidth={0.5} />
        ))}

        {/* 2% target line */}
        <line x1={0} x2={innerW} y1={Y(2)} y2={Y(2)}
          stroke={theme.colors.target} strokeWidth={1} strokeDasharray="4 3" />
        <text x={innerW - 2} y={Y(2) - 3} fontSize={8} fill={theme.colors.target} textAnchor="end">2%</text>

        {/* Whiskers */}
        {data.whiskers.map(w => {
          const isSelected = w.origin === selectedDate
          const path = w.pts
            .map((pt, i) => `${i === 0 ? 'M' : 'L'}${X(parseDate(pt.d)).toFixed(1)},${Y(pt.v).toFixed(1)}`)
            .join(' ')
          return (
            <path
              key={w.origin}
              d={path}
              stroke={isSelected ? theme.colors.whiskerSelected : theme.colors.whisker}
              strokeWidth={isSelected ? sw.selectedWhisker : sw.whiskerLine}
              fill="none"
              opacity={isSelected ? 1 : 0.7}
            />
          )
        })}

        {/* CPI line */}
        <path d={cpiPath} stroke={theme.colors.cpi} strokeWidth={sw.cpiLine} fill="none" />

        {/* Selected vertical line */}
        {selectedX !== null && (
          <line
            x1={selectedX} x2={selectedX} y1={0} y2={innerH}
            stroke={theme.colors.whiskerSelected} strokeWidth={sw.whiskerSelected} strokeDasharray="5 3"
          />
        )}

        {/* Y axis ticks */}
        {yTicks.map(t => (
          <text key={t.y} x={-6} y={t.y + 3} fontSize={9}
            fill={theme.ui.tickLabel} textAnchor="end">{t.label}</text>
        ))}

        {/* X axis ticks */}
        {yearTicks.map(t => (
          <g key={t.x}>
            <line x1={t.x} x2={t.x} y1={innerH} y2={innerH + 4} stroke={theme.ui.axis} />
            <text x={t.x} y={innerH + 14} fontSize={9} fill={theme.ui.tickLabel} textAnchor="middle">{t.label}</text>
          </g>
        ))}

        {/* Axis lines */}
        <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={theme.ui.axis} />
        <line x1={0} x2={0} y1={0} y2={innerH} stroke={theme.ui.axis} />

      </g>
    </svg>
  )
}
