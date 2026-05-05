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

export function prevMonthYear(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-').map(Number)
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return `${MONTH_NAMES[pm - 1]} ${py}`
}
