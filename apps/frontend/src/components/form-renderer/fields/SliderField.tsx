'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  Slider,
  Box,
  Typography,
} from '@mui/material'
import type { FieldProps } from './types'

export function SliderField({ field, control, name }: FieldProps) {
  const min = field.min ?? 0
  const max = field.max ?? 10

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue={min}
      render={({ field: rhf, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <FormLabel sx={{ mb: 2 }}>
            {field.label}
            {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
          </FormLabel>

          <Slider
            value={rhf.value ?? min}
            onChange={(_, val) => rhf.onChange(val)}
            min={min}
            max={max}
            step={1}
            valueLabelDisplay="auto"
            sx={{ color: 'primary.main' }}
          />

          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {min}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {max}
            </Typography>
          </Box>

          <FormHelperText>
            {fieldState.error?.message || field.helpText || ''}
          </FormHelperText>
        </FormControl>
      )}
    />
  )
}
