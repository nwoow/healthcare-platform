'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  RadioGroup,
  Radio,
  FormControlLabel,
  Paper,
  Alert,
} from '@mui/material'
import type { FieldProps } from './types'

export function RadioField({ field, control, name }: FieldProps) {
  const options = field.options ?? []

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <FormLabel sx={{ mb: 1 }}>
            {field.label}
            {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
          </FormLabel>

          {options.length === 0 ? (
            <Alert severity="info">No options configured</Alert>
          ) : (
            <RadioGroup
              value={rhf.value ?? ''}
              onChange={(e) => rhf.onChange(e.target.value)}
            >
              {options.map((opt) => {
                const checked = rhf.value === opt.value
                return (
                  <Paper
                    key={opt.value}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: checked ? '2px solid' : '1px solid',
                      borderColor: checked ? 'primary.main' : 'divider',
                      bgcolor: checked ? 'primary.50' : 'background.paper',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                    onClick={() => rhf.onChange(opt.value)}
                  >
                    <FormControlLabel
                      value={opt.value}
                      control={<Radio />}
                      label={opt.label}
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>
                )
              })}
            </RadioGroup>
          )}

          <FormHelperText>
            {fieldState.error?.message || field.helpText || ''}
          </FormHelperText>
        </FormControl>
      )}
    />
  )
}
