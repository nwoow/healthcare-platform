'use client'
import { Controller } from 'react-hook-form'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  Paper,
  Alert,
} from '@mui/material'
import type { FieldProps } from './types'

export function CheckboxField({ field, control, name }: FieldProps) {
  const options = field.options ?? []
  const isMulti = options.length > 0

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (val) =>
          !field.required ||
          (Array.isArray(val) && val.length > 0) ||
          (isMulti ? `${field.label} is required` : (!!val || `${field.label} is required`)),
      }}
      defaultValue={isMulti ? [] : false}
      render={({ field: rhf, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <FormLabel sx={{ mb: 1 }}>
            {field.label}
            {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
          </FormLabel>

          {isMulti ? (
            options.length === 0 ? (
              <Alert severity="info">No options configured</Alert>
            ) : (
              <>
                {options.map((opt) => {
                  const selected: string[] = Array.isArray(rhf.value) ? rhf.value : []
                  const checked = selected.includes(opt.value)
                  const toggle = () => {
                    rhf.onChange(
                      checked
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value],
                    )
                  }
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
                      onClick={toggle}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={toggle}
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                        label={opt.label}
                        sx={{ m: 0, width: '100%' }}
                      />
                    </Paper>
                  )
                })}
              </>
            )
          ) : (
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!rhf.value}
                  onChange={(e) => rhf.onChange(e.target.checked)}
                />
              }
              label={field.placeholder || field.label}
            />
          )}

          <FormHelperText>
            {fieldState.error?.message || field.helpText || ''}
          </FormHelperText>
        </FormControl>
      )}
    />
  )
}
