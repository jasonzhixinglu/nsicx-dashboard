import { useState } from 'react'
import { japanReleaseInfo } from '../lib/japanRelease.js'

// Collapsible vintage details of the selected estimation release (closed by default).
export default function ReleaseInfo() {
  const [open, setOpen] = useState(false)
  const { details, note } = japanReleaseInfo

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <span>Vintage details</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform shrink-0 text-slate-400 dark:text-slate-500 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (details ? (
        <div className="mt-1.5 space-y-0.5">
          {details.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-slate-500">{note}</div>
      ))}
    </div>
  )
}
