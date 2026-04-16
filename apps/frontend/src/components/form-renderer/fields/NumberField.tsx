'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  TextField as MuiTextField,
  InputAdornment,
  IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import type { FieldProps } from './types'

export function NumberField({ field, control, name }: FieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: field.required ? `${field.label} is required` : false,
        min: field.min !== undefined
          ? { value: field.min, message: `Minimum is ${field.min}` }
          : undefined,
        max: field.max !== undefined
          ? { value: field.max, message: `Maximum is ${field.max}` }
          : undefined,
      }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <MuiTextField
            {...rhf}
            fullWidth
            type="number"
            variant="outlined"
            label={
              <>
                {field.label}
                {field.required && (
                  <span style={{ color: 'red', marginLeft: 2 }}>*</span>
                )}
              </>
            }
            placeholder={field.placeholder}
            error={!!fieldState.error}
            helperText={fieldState.error?.message || field.helpText || ''}
            slotProps={{
              htmlInput: { min: field.min, max: field.max, suppressHydrationWarning: true },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => rhf.onChange(Number(rhf.value || 0) - 1)}
                      edge="end"
                      aria-label="decrease"
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => rhf.onChange(Number(rhf.value || 0) + 1)}
                      edge="end"
                      aria-label="increase"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </FormControl>
      )}
    />
  )
}
