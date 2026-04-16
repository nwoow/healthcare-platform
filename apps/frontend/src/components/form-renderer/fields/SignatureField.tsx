'use client'
import { useRef, useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Box, Typography, Paper, Button, FormHelperText } from '@mui/material'
import type { FieldProps } from './types'

export function SignatureField({ field, control, name }: FieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      rules={{ required: field.required ? `${field.label} is required` : false }}
      render={({ field: rhf, fieldState }) => (
        <SignatureCanvas field={field} rhf={rhf} error={fieldState.error?.message} />
      )}
    />
  )
}

function SignatureCanvas({
  field,
  rhf,
  error,
}: {
  field: FieldProps['field']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rhf: any
  error?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  const getCtx = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    return ctx
  }

  const getPos = (
    e: MouseEvent | TouchEvent,
    canvas: HTMLCanvasElement,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const startDraw = (e: MouseEvent | TouchEvent) => {
      isDrawing.current = true
      const ctx = getCtx()
      if (!ctx) return
      const { x, y } = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(x, y)
      e.preventDefault()
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return
      const ctx = getCtx()
      if (!ctx) return
      const { x, y } = getPos(e, canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
      e.preventDefault()
    }

    const stopDraw = () => {
      if (!isDrawing.current) return
      isDrawing.current = false
      rhf.onChange(canvas.toDataURL())
    }

    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDraw)
    canvas.addEventListener('mouseleave', stopDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDraw)

    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDraw)
      canvas.removeEventListener('mouseleave', stopDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDraw)
    }
  // rhf.onChange is stable - safe to include in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    rhf.onChange('')
  }

  return (
    <Box>
      <Typography variant="body2" fontWeight={500} mb={1}>
        {field.label}
        {field.required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          display: 'inline-block',
          borderRadius: 2,
          overflow: 'hidden',
          borderColor: error ? 'error.main' : 'divider',
        }}
      >
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          style={{ display: 'block', cursor: 'crosshair', background: '#fafafa' }}
        />
      </Paper>

      <Box mt={1}>
        <Button variant="outlined" size="small" onClick={handleClear}>
          Clear
        </Button>
      </Box>

      {(error || field.helpText) && (
        <FormHelperText error={!!error}>
          {error || field.helpText}
        </FormHelperText>
      )}
    </Box>
  )
}
