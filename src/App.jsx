import { useState, useEffect } from 'react'
import OverviewPanel from './components/OverviewPanel.jsx'
import ChartsPanel from './components/ChartsPanel.jsx'
import AboutPanel from './components/AboutPanel.jsx'
import MultiCountryPanel from './components/MultiCountryPanel.jsx'
import MultiCountryCharts from './components/MultiCountryCharts.jsx'
import MultiCountryAbout from './components/MultiCountryAbout.jsx'
import { useDarkMode } from './lib/useDarkMode.jsx'

const DASHBOARDS = {
  japan: {
    title: "A Composite Term Structure of Japan's Inflation Expectations",
    subtitle: 'Lu & Teoh · IMF Working Paper · Japan composite (six sources)',
    tabs: [
      { id: 'overview', label: 'Overview', sub: 'Hero chart · Controls', fullHeight: true,  render: () => <OverviewPanel /> },
      { id: 'charts',   label: 'Charts',   sub: 'Key figures',           fullHeight: false, render: () => <ChartsPanel /> },
      { id: 'about',    label: 'About',    sub: 'Paper · Authors',       fullHeight: false, render: () => <AboutPanel /> },
    ],
  },
  multi: {
    title: 'Multi-country inflation expectations',
    subtitle: 'Lu & Teoh · IMF Working Paper · Multi-country companion (Consensus only)',
    tabs: [
      { id: 'country', label: 'Country view', sub: 'Per-country charts',     fullHeight: true,  render: () => <MultiCountryPanel /> },
      { id: 'charts',  label: 'Comparisons',  sub: 'Snapshots · Forwards · Anchoring', fullHeight: false, render: () => <MultiCountryCharts /> },
      { id: 'about',   label: 'About',        sub: 'Methodology · Authors',  fullHeight: false, render: () => <MultiCountryAbout /> },
    ],
  },
}

function getDashboardFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const v = params.get('dashboard')
  return v === 'multi' ? 'multi' : 'japan'
}

function setDashboardInUrl(value) {
  const params = new URLSearchParams(window.location.search)
  if (value === 'japan') params.delete('dashboard')
  else                   params.set('dashboard', value)
  const qs = params.toString()
  const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}${window.location.hash}`
  window.history.replaceState({}, '', newUrl)
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

const TAB_STORAGE_KEY = 'nsicx-tabs'

function loadTabsState() {
  try {
    const v = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (v) return JSON.parse(v)
  } catch {}
  return {}
}

function saveTabsState(state) {
  try { sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(state)) } catch {}
}

function AppShell() {
  const [dashboard, setDashboard] = useState(getDashboardFromUrl)
  const [tabsByDashboard, setTabsByDashboard] = useState(() => {
    const saved = loadTabsState()
    return {
      japan: saved.japan && DASHBOARDS.japan.tabs.find(t => t.id === saved.japan) ? saved.japan : DASHBOARDS.japan.tabs[0].id,
      multi: saved.multi && DASHBOARDS.multi.tabs.find(t => t.id === saved.multi) ? saved.multi : DASHBOARDS.multi.tabs[0].id,
    }
  })
  const cfg = DASHBOARDS[dashboard]
  const activeTab = tabsByDashboard[dashboard]
  const { isDark, toggle } = useDarkMode()

  useEffect(() => {
    document.title = dashboard === 'multi'
      ? 'Multi-country NSICX Dashboard'
      : "Japan Composite Inflation Expectations Dashboard"
  }, [dashboard])

  const setActiveTab = (tabId) => {
    setTabsByDashboard(prev => {
      const next = { ...prev, [dashboard]: tabId }
      saveTabsState(next)
      return next
    })
  }

  const switchDashboard = (next) => {
    setDashboard(next)
    setDashboardInUrl(next)
    // Tab for the destination dashboard is whatever was last selected there.
  }

  const activeTabCfg = cfg.tabs.find(t => t.id === activeTab) ?? cfg.tabs[0]
  const fullHeight = activeTabCfg.fullHeight

  const switchLabel = dashboard === 'multi'
    ? '← Japan composite dashboard'
    : 'Multi-country dashboard →'
  const switchTo = dashboard === 'multi' ? 'japan' : 'multi'

  return (
    <div className={`flex flex-col ${fullHeight ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen'}`}>

      <header className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
              {cfg.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{cfg.subtitle}</p>
            <button
              onClick={() => switchDashboard(switchTo)}
              className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 mt-1 inline-flex items-center gap-1"
            >
              {switchLabel}
            </button>
          </div>
          <div className="flex items-start gap-2 flex-shrink-0">
            <nav className={`grid gap-1.5 sm:flex sm:flex-wrap`} style={{ gridTemplateColumns: `repeat(${cfg.tabs.length}, minmax(0, 1fr))` }}>
              {cfg.tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn text-center lg:text-left px-2 py-1.5 text-xs sm:px-3 lg:px-5 lg:py-2.5 lg:text-sm leading-tight ${
                    activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'
                  }`}
                >
                  <div>{tab.label}</div>
                  <div className={`text-xs mt-0.5 font-normal hidden lg:block ${
                    activeTab === tab.id ? 'text-indigo-300' : 'text-slate-400 dark:text-slate-600'
                  }`}>{tab.sub}</div>
                </button>
              ))}
            </nav>
            <button
              onClick={toggle}
              className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all"
              aria-label="Toggle dark/light mode"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 px-4 sm:px-6 py-4 sm:py-5${fullHeight ? ' md:overflow-hidden md:flex md:flex-col' : ''}`}>
        <div className={`max-w-screen-2xl mx-auto${fullHeight ? ' w-full md:flex-1 md:overflow-hidden md:flex md:flex-col' : ''}`}>
          {activeTabCfg.render()}
        </div>
      </main>

    </div>
  )
}

export default function App() {
  return <AppShell />
}
