'use client'
import { Controller } from 'react-hook-form'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import type { FieldProps } from './types'

export function DateField({ field, control, name }: FieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: field.required ? `${field.label} is required` : false }}
      defaultValue=""
      render={({ field: rhf, fieldState }) => (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label={
              <>
                {field.label}
                {field.required && (
                  <span style={{ color: 'red', marginLeft: 2 }}>*</span>
                )}
              </>
            }
            value={rhf.value ? dayjs(rhf.value) : null}
            onChange={(val) => rhf.onChange(val?.format('YYYY-MM-DD') || '')}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!fieldState.error,
                helperText: fieldState.error?.message || field.helpText || '',
              },
            }}
          />
        </LocalizationProvider>
      )}
    />
  )
}
