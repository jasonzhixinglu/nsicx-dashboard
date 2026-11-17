// Japan composite estimation releases (data in public/data/japan/releases/<id>/).
// The first entry is the default; add new releases at the top.
export const JAPAN_RELEASES = [
  {
    id: 'live-2026-11-17',
    label: 'Oct 2026 (latest)',
    note: 'Balanced panel through Oct 2026 · CPI through Sep 2026 · released 17 Nov 2026',
  },
  {
    id: 'paper-2026-06',
    label: 'Jun 2026 (working paper)',
    note: 'Frozen working paper estimates · downloads use rounded dashboard values',
  },
]

const requested = new URLSearchParams(window.location.search).get('release')

export const japanReleaseInfo = JAPAN_RELEASES.find(r => r.id === requested) ?? JAPAN_RELEASES[0]
export const japanRelease = japanReleaseInfo.id

export const japanDataUrl = (file) =>
  `${import.meta.env.BASE_URL}data/japan/releases/${japanRelease}/${file}`

// Release switch: the panels load their data on mount, so reload with the new ?release=.
export function switchJapanRelease(id) {
  const url = new URL(window.location.href)
  if (id === JAPAN_RELEASES[0].id) url.searchParams.delete('release')
  else                             url.searchParams.set('release', id)
  window.location.assign(url.href)
}
