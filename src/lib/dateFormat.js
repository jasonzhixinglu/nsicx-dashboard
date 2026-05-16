export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatVintage(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function formatMonthYear(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}
