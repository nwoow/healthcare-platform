'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Controller, useForm, type FieldValues } from 'react-hook-form'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Badge,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SendIcon from '@mui/icons-material/Send'
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined'
import { useTheme } from '@mui/material/styles'
import { submissionApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { TextField } from './fields/TextField'
import { TextareaField } from './fields/TextareaField'
import { NumberField } from './fields/NumberField'
import { DateField } from './fields/DateField'
import { DropdownField } from './fields/DropdownField'
import { RadioField } from './fields/RadioField'
import { CheckboxField } from './fields/CheckboxField'
import { SliderField } from './fields/SliderField'
import { FileUploadField } from './fields/FileUploadField'
import { SignatureField } from './fields/SignatureField'
import type { FormField } from './fields/types'

// ── Schema types ──────────────────────────────────────────────────────────────

interface FieldOption { label: string; value: string }

interface FormFieldSchema {
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

interface FormSection {
  id: string
  title: string
  description?: string
  fields: FormFieldSchema[]
}

interface ConditionalLogic {
  id: string
  fieldId: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'
  value: string
  action: 'show' | 'hide'
  targetId: string
}

interface FormSchema {
  _id: string
  name: string
  description?: string
  specialty?: string
  version: number
  tenant_id: string
  sections: FormSection[]
  conditional_logic: ConditionalLogic[]
  layoutType?: 'wizard' | 'accordion' | 'tabs'
}

// ── Conditional logic ─────────────────────────────────────────────────────────

function evaluateCondition(logic: ConditionalLogic, values: FieldValues): boolean {
  const raw = values[logic.fieldId]
  const actual = raw === undefined || raw === null ? '' : String(raw)
  switch (logic.operator) {
    case 'eq':       return actual === logic.value
    case 'neq':      return actual !== logic.value
    case 'gt':       return Number(actual) > Number(logic.value)
    case 'lt':       return Number(actual) < Number(logic.value)
    case 'contains': return actual.toLowerCase().includes(logic.value.toLowerCase())
    default:         return false
  }
}

function computeHidden(logicRules: ConditionalLogic[], values: FieldValues): Set<string> {
  const hidden = new Set<string>()
  for (const rule of logicRules) {
    const met = evaluateCondition(rule, values)
    if (rule.action === 'hide' && met) hidden.add(rule.targetId)
    if (rule.action === 'show' && !met) hidden.add(rule.targetId)
  }
  return hidden
}

// ── Field dispatcher ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderField(fieldSchema: FormFieldSchema, control: any) {
  const field = fieldSchema as FormField
  const name = field.id

  const component = (() => {
    switch (field.type) {
      case 'text':        return <TextField     field={field} control={control} name={name} />
      case 'textarea':    return <TextareaField  field={field} control={control} name={name} />
      case 'number':      return <NumberField    field={field} control={control} name={name} />
      case 'date':        return <DateField      field={field} control={control} name={name} />
      case 'dropdown':    return <DropdownField  field={field} control={control} name={name} />
      case 'radio':       return <RadioField     field={field} control={control} name={name} />
      case 'checkbox':    return <CheckboxField  field={field} control={control} name={name} />
      case 'slider':      return <SliderField    field={field} control={control} name={name} />
      case 'file':
      case 'file_upload': return <FileUploadField field={field} />
      case 'signature':   return <SignatureField field={field} control={control} name={name} />
      default:
        return (
          <Box sx={{ borderRadius: 1, border: '1px dashed', borderColor: 'divider', p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Unsupported field type: <strong>{field.type}</strong>
            </Typography>
          </Box>
        )
    }
  })()

  // Wrap with data attribute so scroll-to-error can locate the element
  return (
    <Box key={name} data-rhf-field={name}>
      {component}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface FormRendererProps {
  form: FormSchema
  onSubmitted?: (submissionId: string) => void
  patientId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientHistory?: any
}

export function FormRenderer({ form, onSubmitted, patientId }: FormRendererProps) {
  const theme = useTheme()
  const layoutType = form.layoutType ?? 'wizard'

  const { control, handleSubmit, watch, getValues, formState, trigger } = useForm({
    mode: 'onBlur',
  })
  const values = watch()
  const hidden = computeHidden(form.conditional_logic ?? [], values)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0)
  // Accordion state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(form.sections.length > 0 ? [form.sections[0].id] : []),
  )
  // Tabs state
  const [currentTab, setCurrentTab] = useState(0)

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false, message: '', severity: 'success',
  })

  function showSnackbar(message: string, severity: 'success' | 'error' | 'warning') {
    setSnackbar({ open: true, message, severity })
  }

  // Auto-save refs
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)
  const lastSavedRef = useRef<Date | null>(null)
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('')

  // ── Progress indicator ────────────────────────────────────────────────────
  const allRequiredFields = form.sections.flatMap((s) => s.fields).filter((f) => f.required)
  const filledRequiredCount = allRequiredFields.filter((f) => {
    const val = values[f.id]
    if (Array.isArray(val)) return val.length > 0
    return val !== '' && val !== undefined && val !== null && val !== false
  }).length
  const progressPercent =
    allRequiredFields.length > 0
      ? Math.round((filledRequiredCount / allRequiredFields.length) * 100)
      : 100

  // ── Auto-save draft every 30s ─────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    try {
      const user = getUser()
      const data = getValues()
      await submissionApi.post('/submissions', {
        form_id: form._id,
        form_version: form.version,
        tenant_id: form.tenant_id ?? 'system',
        patient_id: patientId ?? user?.id ?? 'unknown',
        submitted_by: user?.id ?? 'unknown',
        submitted_by_role: user?.role ?? 'doctor',
        status: 'draft',
        data,
      })
      lastSavedRef.current = new Date()
      setLastSavedLabel('just now')
    } catch {
      // silent auto-save failure
    } finally {
      isSavingRef.current = false
    }
  }, [form, getValues, patientId])

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(saveDraft, 30_000)
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current) }
  }, [saveDraft])

  useEffect(() => {
    const id = setInterval(() => {
      if (!lastSavedRef.current) return
      const secs = Math.round((Date.now() - lastSavedRef.current.getTime()) / 1000)
      setLastSavedLabel(secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`)
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Submit handler (with pre-submit full validation) ──────────────────────

  const onSubmit = async (data: FieldValues) => {
    const user = getUser()
    try {
      const res = await submissionApi.post('/submissions', {
        form_id: form._id,
        form_version: form.version,
        tenant_id: form.tenant_id ?? 'system',
        patient_id: patientId ?? user?.id ?? 'unknown',
        submitted_by: user?.id ?? 'unknown',
        submitted_by_role: user?.role ?? 'doctor',
        status: 'submitted',
        data,
      })
      draftIdRef.current = res.data?._id ?? null
      showSnackbar('Form submitted successfully!', 'success')
      onSubmitted?.(res.data?._id)
    } catch {
      showSnackbar('Submission failed. Please try again.', 'error')
    }
  }

  /**
   * Validates ALL fields across ALL sections before submitting.
   * If there are errors, scrolls to the first invalid field and shows a warning.
   */
  const handleFinalSubmit = async () => {
    // Trigger validation on every registered field
    const isValid = await trigger()

    if (!isValid) {
      const errorKeys = Object.keys(formState.errors)
      const count = errorKeys.length

      showSnackbar(
        `${count} field${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} attention before submitting`,
        'warning',
      )

      // Scroll to first error field
      const firstKey = errorKeys[0]
      const el =
        document.querySelector<HTMLElement>(`[data-rhf-field="${firstKey}"]`) ??
        document.querySelector<HTMLElement>(`[name="${firstKey}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Also try to focus the input inside
        const input = el.querySelector<HTMLElement>('input, textarea, [role="combobox"]')
        input?.focus()
      }

      // In wizard mode, jump to the step that contains the first error
      if (layoutType === 'wizard') {
        const sections = form.sections.filter((s) => !hidden.has(s.id))
        const sectionIndex = sections.findIndex((s) =>
          s.fields.some((f) => f.id === firstKey),
        )
        if (sectionIndex !== -1 && sectionIndex !== currentStep) {
          setCurrentStep(sectionIndex)
        }
      }
      return
    }

    // All valid — submit
    handleSubmit(onSubmit)()
  }

  // ── Wizard next step (validates current section only) ─────────────────────

  const handleWizardNext = async () => {
    const currentFields = form.sections[currentStep]?.fields.map((f) => f.id) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await trigger(currentFields as any)
    if (valid) setCurrentStep((s) => s + 1)
    else showSnackbar('Please fill all required fields in this section', 'warning')
  }

  // ── Section renderer ──────────────────────────────────────────────────────

  const renderSectionFields = (section: FormSection) => {
    const visibleFields = section.fields.filter((f) => !hidden.has(f.id))
    if (visibleFields.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          No fields in this section.
        </Typography>
      )
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {visibleFields.map((f) => renderField(f, control))}
      </Box>
    )
  }

  // Count unfilled required fields in a section
  const unfilledInSection = (section: FormSection): number =>
    section.fields
      .filter((f) => f.required && !hidden.has(f.id))
      .filter((f) => {
        const val = values[f.id]
        if (Array.isArray(val)) return val.length === 0
        return val === '' || val === undefined || val === null || val === false
      }).length

  // ── Shared progress bar ───────────────────────────────────────────────────

  const ProgressBar = () => (
    <Box sx={{ px: 0, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Required fields: {filledRequiredCount}/{allRequiredFields.length} filled
        </Typography>
        {lastSavedLabel && (
          <Typography variant="caption" color="text.secondary">
            Saved {lastSavedLabel}
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={progressPercent}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            bgcolor: progressPercent === 100 ? 'success.main' : 'primary.main',
          },
        }}
      />
    </Box>
  )

  // ── Error summary (shown when there are validation errors) ────────────────
  const errorKeys = Object.keys(formState.errors)
  const ErrorSummary = () => errorKeys.length > 0 ? (
    <Alert
      severity="warning"
      icon={<ErrorOutlinedIcon />}
      sx={{ mb: 2, borderRadius: 2 }}
    >
      <Typography variant="body2" fontWeight={600}>
        {errorKeys.length} field{errorKeys.length > 1 ? 's' : ''} need{errorKeys.length === 1 ? 's' : ''} attention
      </Typography>
      <Typography variant="caption">
        {errorKeys
          .map((k) => {
            const f = form.sections.flatMap((s) => s.fields).find((f) => f.id === k)
            return f?.label ?? k
          })
          .join(', ')}
      </Typography>
    </Alert>
  ) : null

  // ── LAYOUT: WIZARD ────────────────────────────────────────────────────────

  if (layoutType === 'wizard') {
    const sections = form.sections.filter((s) => !hidden.has(s.id))
    const isLastStep = currentStep === sections.length - 1
    const currentSection = sections[currentStep]

    return (
      <Box>
        <form onSubmit={(e) => { e.preventDefault(); handleFinalSubmit() }} noValidate>

          <ProgressBar />
          <ErrorSummary />

          {/* Stepper */}
          <Stepper
            activeStep={currentStep}
            alternativeLabel
            sx={{ mb: 3, px: { xs: 0, sm: 2 } }}
          >
            {sections.map((section, idx) => {
              const unfilled = unfilledInSection(section)
              const completed = idx < currentStep
              const hasError = completed && unfilled > 0

              return (
                <Step key={section.id} completed={completed}>
                  <StepLabel
                    error={hasError}
                    slots={{
                      stepIcon: () => {
                        if (completed && !hasError) {
                          return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        }
                        if (hasError) {
                          return <ErrorOutlinedIcon sx={{ color: 'error.main', fontSize: 28 }} />
                        }
                        const isActive = idx === currentStep
                        return (
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: isActive ? 'primary.main' : 'action.disabledBackground',
                              color: isActive ? 'white' : 'text.disabled',
                              fontSize: 13,
                              fontWeight: 700,
                              border: isActive ? `2px solid ${theme.palette.primary.dark}` : 'none',
                            }}
                          >
                            {idx + 1}
                          </Box>
                        )
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: idx === currentStep ? 600 : 400,
                        color: idx === currentStep ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {section.title}
                    </Typography>
                  </StepLabel>
                </Step>
              )
            })}
          </Stepper>

          {/* Current section card */}
          {currentSection && (
            <Card
              variant="outlined"
              sx={{ mb: 3, borderRadius: 2 }}
            >
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: 'action.hover',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {currentSection.title}
                  </Typography>
                  {currentSection.description && (
                    <Typography variant="body2" color="text.secondary">
                      {currentSection.description}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Step {currentStep + 1} of {sections.length}
                </Typography>
              </Box>
              <CardContent sx={{ px: 3, py: 3 }}>
                {renderSectionFields(currentSection)}
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1,
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={currentStep === 0}
            >
              Back
            </Button>

            {isLastStep ? (
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SendIcon />}
                disabled={formState.isSubmitting}
                sx={{ minWidth: 160 }}
              >
                {formState.isSubmitting ? 'Submitting…' : 'Submit Form'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleWizardNext}
                disabled={formState.isSubmitting}
              >
                Next Section →
              </Button>
            )}
          </Box>
        </form>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            variant="filled"
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    )
  }

  // ── LAYOUT: ACCORDION ─────────────────────────────────────────────────────

  if (layoutType === 'accordion') {
    const sections = form.sections.filter((s) => !hidden.has(s.id))

    return (
      <Box>
        <form onSubmit={(e) => { e.preventDefault(); handleFinalSubmit() }} noValidate>
          <ProgressBar />
          <ErrorSummary />

          {sections.map((section) => {
            const unfilled = unfilledInSection(section)
            const sectionFields = section.fields.filter((f) => !hidden.has(f.id))
            const filledCount = sectionFields.filter((f) => {
              const val = values[f.id]
              if (Array.isArray(val)) return val.length > 0
              return val !== '' && val !== undefined && val !== null && val !== false
            }).length
            const isComplete = filledCount === sectionFields.length

            return (
              <Accordion
                key={section.id}
                expanded={expandedSections.has(section.id)}
                onChange={() =>
                  setExpandedSections((prev) => {
                    const next = new Set(prev)
                    next.has(section.id) ? next.delete(section.id) : next.add(section.id)
                    return next
                  })
                }
                variant="outlined"
                sx={{
                  mb: 1.5,
                  borderRadius: '10px !important',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: '0 0 12px !important' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ borderRadius: '10px', '&.Mui-expanded': { borderRadius: '10px 10px 0 0' } }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
                    {isComplete ? (
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ color: 'action.disabled', fontSize: 20 }} />
                    )}
                    <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                      {section.title}
                    </Typography>
                    <Chip
                      label={`${filledCount}/${sectionFields.length}`}
                      size="small"
                      color={isComplete ? 'success' : 'default'}
                      variant={isComplete ? 'filled' : 'outlined'}
                    />
                    {unfilled > 0 && (
                      <Typography variant="caption" color="warning.main" fontWeight={600}>
                        {unfilled} required
                      </Typography>
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2.5, pb: 3, px: 3 }}>
                  {section.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {section.description}
                    </Typography>
                  )}
                  {renderSectionFields(section)}
                </AccordionDetails>
              </Accordion>
            )
          })}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<SendIcon />}
              disabled={formState.isSubmitting}
              sx={{ minWidth: 160 }}
            >
              {formState.isSubmitting ? 'Submitting…' : 'Submit Form'}
            </Button>
          </Box>
        </form>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            variant="filled"
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    )
  }

  // ── LAYOUT: TABS ──────────────────────────────────────────────────────────

  const sections = form.sections.filter((s) => !hidden.has(s.id))
  const isLastTab = currentTab === sections.length - 1
  const currentTabSection = sections[currentTab]

  return (
    <Box>
      <form onSubmit={(e) => { e.preventDefault(); handleFinalSubmit() }} noValidate>
        <ProgressBar />
        <ErrorSummary />

        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            mb: 2,
            '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 500 },
            '& .Mui-selected': { fontWeight: 700 },
          }}
        >
          {sections.map((section, idx) => {
            const unfilled = unfilledInSection(section)
            return (
              <Tab
                key={section.id}
                value={idx}
                label={
                  <Badge
                    badgeContent={unfilled}
                    color="error"
                    invisible={unfilled === 0}
                    sx={{ '& .MuiBadge-badge': { right: -8, top: -4 } }}
                  >
                    <span>{section.title}</span>
                  </Badge>
                }
              />
            )
          })}
        </Tabs>

        {currentTabSection && (
          <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
            <Box
              sx={{
                px: 3,
                py: 2,
                bgcolor: 'action.hover',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                {currentTabSection.title}
              </Typography>
              {currentTabSection.description && (
                <Typography variant="body2" color="text.secondary">
                  {currentTabSection.description}
                </Typography>
              )}
            </Box>
            <CardContent sx={{ px: 3, py: 3 }}>
              {renderSectionFields(currentTabSection)}
            </CardContent>
          </Card>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setCurrentTab((t) => t - 1)}
            disabled={currentTab === 0}
          >
            Previous
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {!isLastTab && (
              <Button variant="outlined" onClick={() => setCurrentTab((t) => t + 1)}>
                Next Tab →
              </Button>
            )}
            {isLastTab && (
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SendIcon />}
                disabled={formState.isSubmitting}
                sx={{ minWidth: 160 }}
              >
                {formState.isSubmitting ? 'Submitting…' : 'Submit Form'}
              </Button>
            )}
          </Box>
        </Box>
      </form>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
