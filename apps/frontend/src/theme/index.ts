import { createTheme, type Theme } from '@mui/material/styles'

export function createHealthcareTheme(primaryColor: string, secondaryColor: string): Theme {
  return createTheme({
    palette: {
      primary: { main: primaryColor },
      secondary: { main: secondaryColor },
      success: { main: '#1B6B3A' },
      error: { main: '#C0392B' },
      background: { default: '#F0F4F8' },
    },
    typography: {
      fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      // Browser password-manager extensions inject fdprocessedid into interactive
      // elements after SSR but before React hydration.  suppressHydrationWarning
      // on these root elements tells React to ignore those attribute mismatches.
      MuiButtonBase: {
        defaultProps: { suppressHydrationWarning: true },
      },
      // In MUI v9, inputProps → slotProps.htmlInput
      MuiInputBase: {
        defaultProps: {
          slotProps: { htmlInput: { suppressHydrationWarning: true } },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              backgroundColor: '#FAFBFC',
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: primaryColor,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`,
            boxShadow: '0 2px 8px 0 rgba(0,0,0,0.15)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: secondaryColor,
            color: '#FFFFFF',
          },
        },
      },
    },
  })
}
