'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { themes, type ThemeKey } from '@/theme/themes'
import { createHealthcareTheme } from '@/theme'

interface ThemeContextValue {
  currentTheme: ThemeKey
  setTheme: (key: ThemeKey) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: 'teal',
  setTheme: () => {},
})

export function HealthcareThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('teal')

  useEffect(() => {
    const saved = localStorage.getItem('hc-theme') as ThemeKey | null
    if (saved && themes[saved]) setCurrentTheme(saved)
  }, [])

  const setTheme = (key: ThemeKey) => {
    setCurrentTheme(key)
    localStorage.setItem('hc-theme', key)
  }

  const muiTheme = useMemo(() => {
    const t = themes[currentTheme]
    return createHealthcareTheme(t.primary, t.secondary)
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useHealthcareTheme() {
  return useContext(ThemeContext)
}
