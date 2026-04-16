import type { Control, FieldValues, Path } from 'react-hook-form'

export interface FieldOption {
  label: string
  value: string
}

export interface FormField {
  id: string
  type: string
  label: string
  placeholder?: string
  required: boolean
  helpText?: string
  min?: number
  max?: number
  options: FieldOption[]
}

export interface FieldProps<T extends FieldValues = FieldValues> {
  field: FormField
  control: Control<T>
  name: Path<T>
}
