export const CHART_THEME = {
  colors: {
    cpi:             '#fef3c7',
    dnsFwd:          '#22d3ee',
    avg:             '#6366f1',
    slope:           '#22d3ee',
    curvature:       '#34d399',
    target:          'rgba(251,191,36,0.45)',
    whisker:         'rgba(148,163,184,0.30)',
    whiskerSelected: '#6366f1',
  },
  strokeWidths: {
    cpiLine:         2,
    dnsLine:         1.5,
    whiskerLine:     1,
    whiskerSelected: 1.5,
    selectedWhisker: 2.5,
  },
  ui: {
    grid:          'rgba(51,65,85,0.4)',
    axis:          'rgba(51,65,85,0.6)',
    tickLabel:     'rgba(148,163,184,1.0)',
    tooltipBg:     '#0f172a',
    tooltipBorder: 'rgba(51,65,85,0.6)',
    tooltipText:   '#cbd5e1',
  },
}

export const TOOLTIP_STYLE = {
  backgroundColor: CHART_THEME.ui.tooltipBg,
  border:          `1px solid ${CHART_THEME.ui.tooltipBorder}`,
  borderRadius:    '6px',
  fontSize:        '11px',
  color:           CHART_THEME.ui.tooltipText,
}
