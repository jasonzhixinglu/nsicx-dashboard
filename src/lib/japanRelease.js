export const japanRelease = new URLSearchParams(window.location.search).get('release') === 'paper-2026-06'
  ? 'paper-2026-06' : 'live-2026-11-17'
export const japanDataUrl = (file) => `${import.meta.env.BASE_URL}data/japan/releases/${japanRelease}/${file}`
