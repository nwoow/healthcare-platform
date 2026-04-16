'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  TextField as MuiTextField,
} from '@mui/material'
import type { FieldProps } from './types'

export function TextField({ field, control, name }: FieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <MuiTextField
            {...rhf}
            fullWidth
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
          />
        </FormControl>
      )}
    />
  )
}
