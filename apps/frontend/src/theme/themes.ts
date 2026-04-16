export const themes = {
  teal: { name: 'Ocean Teal', primary: '#0E7C7B', secondary: '#1B3A5C' },
  purple: { name: 'Royal Purple', primary: '#6B3FA0', secondary: '#2D1B5C' },
  blue: { name: 'Clinical Blue', primary: '#1565C0', secondary: '#0D3B7A' },
  green: { name: 'Healing Green', primary: '#2E7D32', secondary: '#1B4A1E' },
  rose: { name: 'Care Rose', primary: '#C2185B', secondary: '#7B1040' },
} as const

export type ThemeKey = keyof typeof themes
