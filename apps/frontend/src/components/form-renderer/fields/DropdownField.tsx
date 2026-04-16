'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  Select,
  MenuItem,
  Alert,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import MuiTextField from '@mui/material/TextField'
import type { FieldProps } from './types'

export function DropdownField({ field, control, name }: FieldProps) {
  const options = field.options ?? []

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => {
        if (options.length === 0) {
          return (
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>
                {field.label}
                {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
              </FormLabel>
              <Alert severity="info">No options configured</Alert>
            </FormControl>
          )
        }

        if (options.length > 5) {
          const autocompleteValue =
            options.find((o) => o.value === rhf.value) ?? null

          return (
            <FormControl fullWidth error={!!fieldState.error}>
              <Autocomplete
                options={options}
                getOptionLabel={(opt) => opt.label}
                value={autocompleteValue}
                onChange={(_, newVal) => rhf.onChange(newVal?.value ?? '')}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                renderInput={(params) => (
                  <MuiTextField
                    {...params}
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
                )}
              />
            </FormControl>
          )
        }

        return (
          <FormControl fullWidth error={!!fieldState.error}>
            <FormLabel sx={{ mb: 1 }}>
              {field.label}
              {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
            </FormLabel>
            <Select
              {...rhf}
              displayEmpty
              value={rhf.value ?? ''}
            >
              <MenuItem value="" disabled>
                {field.placeholder || 'Select an option…'}
              </MenuItem>
              {options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {fieldState.error?.message || field.helpText || ''}
            </FormHelperText>
          </FormControl>
        )
      }}
    />
  )
}
