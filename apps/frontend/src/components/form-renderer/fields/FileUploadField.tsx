'use client'
import { useRef, useState } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import type { FieldProps } from './types'

export function FileUploadField({ field }: Pick<FieldProps, 'field'>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected])
    // reset so the same file can be selected again
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Box>
      <Typography variant="body2" fontWeight={500} mb={1}>
        {field.label}
        {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
      </Typography>

      <Box
        onClick={handleClick}
        sx={{
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Drop files here or click to browse
        </Typography>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </Box>

      {files.length > 0 && (
        <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
          {files.map((file, i) => (
            <Chip
              key={i}
              label={file.name}
              onDelete={() => removeFile(i)}
              deleteIcon={<DeleteIcon />}
              size="small"
            />
          ))}
        </Box>
      )}

      {field.helpText && (
        <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
          {field.helpText}
        </Typography>
      )}
    </Box>
  )
}
