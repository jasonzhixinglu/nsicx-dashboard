import { useState, useCallback } from 'react'

// useState that mirrors itself into sessionStorage under `key`.
// Survives tab switches and remounts within the same browser tab.
export function useSessionState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const v = sessionStorage.getItem(key)
      if (v == null) return defaultValue
      return JSON.parse(v)
    } catch {
      return defaultValue
    }
  })

  const setAndPersist = useCallback((v) => {
    const next = typeof v === 'function' ? v(value) : v
    setValue(next)
    try { sessionStorage.setItem(key, JSON.stringify(next)) } catch {}
  }, [key, value])

  return [value, setAndPersist]
}
