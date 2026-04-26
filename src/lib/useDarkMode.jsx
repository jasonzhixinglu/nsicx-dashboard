import { createContext, useContext, useEffect, useState } from 'react'

const DarkModeContext = createContext({ isDark: true, toggle: () => {} })

export function DarkModeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('nsicx-theme')
      return stored ? stored === 'dark' : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem('nsicx-theme', isDark ? 'dark' : 'light') } catch {}
  }, [isDark])

  return (
    <DarkModeContext.Provider value={{ isDark, toggle: () => setIsDark(d => !d) }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export function useDarkMode() {
  return useContext(DarkModeContext)
}
