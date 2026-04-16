'use client'
import { Controller } from 'react-hook-form'
import { FormControl, TextField as MuiTextField } from '@mui/material'
import type { FieldProps } from './types'

export function TextareaField({ field, control, name }: FieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => {
        const value = (rhf.value as string) ?? ''
        const helperText = fieldState.error?.message
          ?? `${value.length} chars${field.helpText ? ' — ' + field.helpText : ''}`

        return (
          <FormControl fullWidth error={!!fieldState.error}>
            <MuiTextField
              {...rhf}
              fullWidth
              multiline
              rows={4}
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
              helperText={helperText}
              slotProps={{
                formHelperText: { sx: { color: fieldState.error ? 'error.main' : 'text.secondary' } },
              }}
            />
          </FormControl>
        )
      }}
    />
  )
}
