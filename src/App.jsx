import { useState } from 'react'
import OverviewPanel from './components/OverviewPanel.jsx'
import ChartsPanel from './components/ChartsPanel.jsx'
import AboutPanel from './components/AboutPanel.jsx'

const TABS = [
  { id: 'overview', label: 'Overview', sub: 'Hero chart · Controls' },
  { id: 'charts',   label: 'Charts',   sub: 'Key figures' },
  { id: 'about',    label: 'About',    sub: 'Paper · Authors' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen flex flex-col">

      <header className="border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-100 leading-tight">
              A Composite Term Structure of Japan's Inflation Expectations
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Lu &amp; Teoh · IMF Working Paper · Results Dashboard</p>
          </div>
          <nav className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn text-center sm:text-left px-2 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm leading-tight ${
                  activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'
                }`}
              >
                <div>{tab.label}</div>
                <div className={`text-xs mt-0.5 font-normal hidden sm:block ${
                  activeTab === tab.id ? 'text-indigo-300' : 'text-slate-600'
                }`}>{tab.sub}</div>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-screen-2xl mx-auto">
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'charts'   && <ChartsPanel />}
          {activeTab === 'about'    && <AboutPanel />}
        </div>
      </main>

    </div>
  )
}
