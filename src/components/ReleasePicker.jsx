import { JAPAN_RELEASES, japanRelease, japanReleaseInfo, switchJapanRelease } from '../lib/japanRelease.js'

// Estimation release selector with its release note, shown at the top of the key-results card.
export default function ReleasePicker() {
  return (
    <div className="space-y-1.5">
      <label htmlFor="japan-release" className="text-xs text-slate-500">Estimation release</label>
      <select
        id="japan-release"
        value={japanRelease}
        onChange={(e) => switchJapanRelease(e.target.value)}
        className="w-full text-xs font-medium rounded px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
      >
        {JAPAN_RELEASES.map(r => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
      {japanReleaseInfo.details ? (
        <div className="space-y-0.5 pt-0.5">
          {japanReleaseInfo.details.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500 pt-0.5">{japanReleaseInfo.note}</div>
      )}
    </div>
  )
}
