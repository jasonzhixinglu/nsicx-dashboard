// Avg-annualized rate over horizon [0, h] months.
export function avgAnnualized(L, S, C, lam, h) {
  if (h < 1e-6) return L + S
  const eL = Math.exp(-lam * h)
  const L2 = (1 - eL) / (lam * h)
  const L3 = L2 - eL
  return L + L2 * S + L3 * C
}

// Instantaneous forward rate at horizon h (months).
export function fwdInstant(L, S, C, lam, h) {
  const eL = Math.exp(-lam * h)
  return L + eL * S + lam * h * eL * C
}

// Avg-annualized rate over the window [a, b] (months from now).
// Derived from cumulative averages: (b · avg_b − a · avg_a) / (b − a).
export function avgWindow(L, S, C, lam, a, b) {
  if (a <= 0) return avgAnnualized(L, S, C, lam, b)
  const ab = avgAnnualized(L, S, C, lam, b)
  const aa = avgAnnualized(L, S, C, lam, a)
  return (b * ab - a * aa) / (b - a)
}

export function addMonths(yyyymm, h) {
  const [y, m] = yyyymm.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + h
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}
