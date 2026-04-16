'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  CircleDot,
  CheckSquare2,
  SlidersHorizontal,
  Upload,
  List,
  GripVertical,
  X,
  Sliders,
  Save,
  Send,
  ArrowLeft,
  MousePointerClick,
  Check,
} from 'lucide-react'
import { ToggleButtonGroup, ToggleButton, Box, Typography } from '@mui/material'
import { LinearScale as WizardIcon, ViewHeadline as AccordionIcon, Tab as TabIcon } from '@mui/icons-material'
import { Button } from '@/components/ui/button'
import { formApi } from '@/lib/api'
import { getUser, getCurrentTenantId } from '@/lib/auth'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'slider'
  | 'file'
  | 'repeater'

interface FieldOption {
  label: string
  value: string
}

interface CanvasField {
  id: string
  type: FieldType
  label: string
  placeholder: string
  required: boolean
  helpText: string
  options: FieldOption[]
  min: number
  max: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_DEFS: Array<{ type: FieldType; label: string; icon: React.ElementType; color: string }> = [
  { type: 'text',      label: 'Text',        icon: Type,            color: 'bg-blue-500' },
  { type: 'textarea',  label: 'Textarea',    icon: AlignLeft,       color: 'bg-indigo-500' },
  { type: 'number',    label: 'Number',      icon: Hash,            color: 'bg-emerald-500' },
  { type: 'date',      label: 'Date',        icon: Calendar,        color: 'bg-violet-500' },
  { type: 'dropdown',  label: 'Dropdown',    icon: ChevronDown,     color: 'bg-amber-500' },
  { type: 'radio',     label: 'Radio',       icon: CircleDot,       color: 'bg-orange-500' },
  { type: 'checkbox',  label: 'Checkbox',    icon: CheckSquare2,    color: 'bg-rose-500' },
  { type: 'slider',    label: 'Slider',      icon: SlidersHorizontal, color: 'bg-cyan-500' },
  { type: 'file',      label: 'File Upload', icon: Upload,          color: 'bg-teal-500' },
  { type: 'repeater',  label: 'Repeater',    icon: List,            color: 'bg-pink-500' },
]

// Type → left-bar accent colour for canvas cards
const TYPE_ACCENT: Record<FieldType, string> = {
  text:      'bg-blue-500',
  textarea:  'bg-indigo-500',
  number:    'bg-emerald-500',
  date:      'bg-violet-500',
  dropdown:  'bg-amber-500',
  radio:     'bg-orange-500',
  checkbox:  'bg-rose-500',
  slider:    'bg-cyan-500',
  file:      'bg-teal-500',
  repeater:  'bg-pink-500',
}

// Type → light badge colours for the config panel
const TYPE_BADGE: Record<FieldType, string> = {
  text:      'bg-blue-50 text-blue-700 border-blue-200',
  textarea:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  number:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  date:      'bg-violet-50 text-violet-700 border-violet-200',
  dropdown:  'bg-amber-50 text-amber-700 border-amber-200',
  radio:     'bg-orange-50 text-orange-700 border-orange-200',
  checkbox:  'bg-rose-50 text-rose-700 border-rose-200',
  slider:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  file:      'bg-teal-50 text-teal-700 border-teal-200',
  repeater:  'bg-pink-50 text-pink-700 border-pink-200',
}

const SPECIALTIES = [
  'General', 'Gastroenterology', 'Cardiology', 'Neurology',
  'Orthopedics', 'Pediatrics', 'Radiology', 'Emergency',
]

function getDef(type: FieldType) {
  return FIELD_DEFS.find((d) => d.type === type) ?? FIELD_DEFS[0]
}

function createDefaultField(type: FieldType): CanvasField {
  const def = getDef(type)
  return {
    id: crypto.randomUUID(),
    type,
    label: `${def.label} field`,
    placeholder: '',
    required: false,
    helpText: '',
    options:
      type === 'dropdown' || type === 'radio'
        ? [{ label: 'Option 1', value: 'option_1' }, { label: 'Option 2', value: 'option_2' }]
        : [],
    min: 0,
    max: 10,
  }
}

// ── Collision detection: pointer-first so empty canvas is always a valid drop ──

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

// ── PaletteItem ────────────────────────────────────────────────────────────────

function PaletteItem({ type, label, icon: Icon, color, onAdd }: {
  type: FieldType; label: string; icon: React.ElementType; color: string
  onAdd: (type: FieldType) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
      title={`Click to add · or drag to canvas`}
      className={cn(
        'group flex cursor-grab flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-3 select-none transition-all active:cursor-grabbing hover:border-white/20 hover:bg-white/10',
        isDragging && 'opacity-20',
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', color)}>
        <Icon className="size-4 text-white" />
      </div>
      <span className="text-center text-[11px] font-medium leading-tight text-slate-300">
        {label}
      </span>
    </div>
  )
}

// ── SortableFieldCard ──────────────────────────────────────────────────────────

function SortableFieldCard({ field, isSelected, onSelect, onDelete }: {
  field: CanvasField
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  const def = getDef(field.type)
  const Icon = def.icon

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      onClick={onSelect}
      className={cn(
        'group relative flex cursor-pointer select-none items-center gap-3 overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-150',
        isSelected
          ? 'border-blue-300 ring-2 ring-blue-500/20 shadow-md'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      )}
    >
      {/* Coloured left accent bar */}
      <div className={cn('absolute inset-y-0 left-0 w-1', TYPE_ACCENT[field.type])} />

      {/* Content */}
      <div className="ml-1 flex flex-1 items-center gap-3 px-3 py-3.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
          className="shrink-0 cursor-grab text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Type icon */}
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', def.color)}>
          <Icon className="size-3.5 text-white" />
        </div>

        {/* Label + meta */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{field.label}</p>
          <p className="mt-0.5 text-xs capitalize text-slate-400">
            {field.type}
            {field.required && <span className="ml-1.5 font-medium text-rose-500">· required</span>}
          </p>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          suppressHydrationWarning
          className="shrink-0 rounded-lg p-1 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── FieldConfigPanel ───────────────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-400 focus:ring-3 focus:ring-blue-500/15'

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function FieldConfigPanel({ field, onChange }: {
  field: CanvasField
  onChange: (updated: CanvasField) => void
}) {
  const def = getDef(field.type)
  const Icon = def.icon
  const hasOptions     = field.type === 'dropdown' || field.type === 'radio'
  const hasSlider      = field.type === 'slider'
  const hasPlaceholder = ['text', 'textarea', 'number', 'date'].includes(field.type)
  const optionsText    = field.options.map((o) => o.label).join('\n')

  const handleOptionsChange = (text: string) => {
    const options = text.split('\n').map((s) => s.trim()).filter(Boolean)
      .map((label) => ({ label, value: label.toLowerCase().replace(/\s+/g, '_') }))
    onChange({ ...field, options })
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Configure</p>
        <div className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
          TYPE_BADGE[field.type],
        )}>
          <Icon className="size-3.5" />
          <span className="capitalize">{field.type}</span>
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-5 px-4 py-5">
        <ConfigRow label="Label">
          <input type="text" value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            className={inputCls} />
        </ConfigRow>

        {hasPlaceholder && (
          <ConfigRow label="Placeholder">
            <input type="text" value={field.placeholder}
              onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              placeholder="Hint text…" className={inputCls} />
          </ConfigRow>
        )}

        <ConfigRow label="Help text">
          <input type="text" value={field.helpText}
            onChange={(e) => onChange({ ...field, helpText: e.target.value })}
            placeholder="Optional description" className={inputCls} />
        </ConfigRow>

        {/* Required toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-slate-700">Required</p>
            <p className="text-xs text-slate-400">Field must be filled to submit</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={field.required}
            suppressHydrationWarning
            onClick={() => onChange({ ...field, required: !field.required })}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              field.required ? 'bg-blue-500' : 'bg-slate-200',
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
              field.required ? 'translate-x-5.5' : 'translate-x-0.5',
            )} />
          </button>
        </div>

        {hasOptions && (
          <ConfigRow label="Options — one per line">
            <textarea
              value={optionsText}
              onChange={(e) => handleOptionsChange(e.target.value)}
              rows={5}
              placeholder={'Option 1\nOption 2\nOption 3'}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-400 focus:ring-3 focus:ring-blue-500/15"
            />
          </ConfigRow>
        )}

        {hasSlider && (
          <div className="flex gap-3">
            <ConfigRow label="Min">
              <input type="number" value={field.min}
                onChange={(e) => onChange({ ...field, min: Number(e.target.value) })}
                className={inputCls} />
            </ConfigRow>
            <ConfigRow label="Max">
              <input type="number" value={field.max}
                onChange={(e) => onChange({ ...field, max: Number(e.target.value) })}
                className={inputCls} />
            </ConfigRow>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CanvasDropZone — a dedicated droppable so empty canvas is always a valid target ──

function CanvasDropZone({ hasFields }: { hasFields: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-dropzone' })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 text-center transition-all duration-200',
        isOver
          ? 'border-blue-400 bg-blue-50 scale-[1.01]'
          : hasFields
          ? 'border-slate-200'
          : 'border-slate-300 bg-white',
      )}
    >
      <div className={cn(
        'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
        isOver ? 'bg-blue-100' : 'bg-slate-100',
      )}>
        <MousePointerClick className={cn(
          'size-6 transition-colors',
          isOver ? 'text-blue-500' : 'text-slate-400',
        )} />
      </div>
      <p className={cn(
        'mt-3 text-sm font-semibold transition-colors',
        isOver ? 'text-blue-600' : 'text-slate-500',
      )}>
        {hasFields ? 'Drop to add another field' : 'Drop your first field here'}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {hasFields
          ? 'Or drag between existing fields to reorder'
          : 'Drag any field from the left · or click a field type to add it'}
      </p>
    </div>
  )
}

// ── Builder (inner, wrapped in Suspense) ───────────────────────────────────────

function BuilderContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const urlFormId    = searchParams.get('id')

  const [docId,      setDocId]      = useState<string | null>(urlFormId)
  const [formName,      setFormName]      = useState('Untitled Form')
  const [specialty,     setSpecialty]     = useState('')
  const [allowedRoles,  setAllowedRoles]  = useState<string[]>(['doctor', 'nurse', 'receptionist'])
  const [fields,        setFields]        = useState<CanvasField[]>([])
  const [formStatus,    setFormStatus]    = useState<'draft' | 'published'>('draft')
  const [layoutType,    setLayoutType]    = useState<'wizard' | 'accordion' | 'tabs'>('wizard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [isSaving,   setIsSaving]   = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [loadError,  setLoadError]  = useState('')
  const hasLoaded = useRef(false)

  // Load existing form
  useEffect(() => {
    if (!urlFormId || hasLoaded.current) return
    hasLoaded.current = true
    formApi.get(`/forms/${urlFormId}`)
      .then(({ data }) => {
        setDocId(data._id)
        setFormName(data.name ?? 'Untitled Form')
        setSpecialty(data.specialty ?? '')
        setFormStatus(data.status ?? 'draft')
        if (data.access_control?.roles?.length) setAllowedRoles(data.access_control.roles)
        if (data.layoutType) setLayoutType(data.layoutType)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded: CanvasField[] = (data.sections ?? []).flatMap((s: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s.fields ?? []).map((f: any) => ({
            id: f.id ?? crypto.randomUUID(),
            type: f.type as FieldType,
            label: f.label,
            placeholder: f.placeholder ?? '',
            required: f.required ?? false,
            helpText: f.helpText ?? '',
            options: f.options ?? [],
            min: f.min ?? 0,
            max: f.max ?? 10,
          })),
        )
        setFields(loaded)
      })
      .catch(() => setLoadError('Could not load form.'))
  }, [urlFormId])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const buildPayload = () => ({
    name:        formName.trim() || 'Untitled Form',
    specialty:   specialty || undefined,
    tenant_id:   getCurrentTenantId(),
    layoutType,
    sections: [{
      id: 'section-1', title: 'Main Section',
      fields: fields.map((f) => ({
        id: f.id, type: f.type, label: f.label,
        placeholder: f.placeholder || undefined,
        required: f.required,
        helpText: f.helpText || undefined,
        options: f.options.length ? f.options : undefined,
        ...(f.type === 'slider' ? { min: f.min, max: f.max } : {}),
      })),
    }],
    access_control: { roles: allowedRoles.length ? allowedRoles : ['doctor', 'nurse', 'receptionist'], attributes: {} },
    created_by: getUser()?.id,
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (docId) {
        const { data } = await formApi.put(`/forms/${docId}`, buildPayload())
        // If the form was published, saving resets it to draft (re-publish required)
        if (data?.status) setFormStatus(data.status)
      } else {
        const { data } = await formApi.post('/forms', buildPayload())
        setDocId(data._id)
        setFormStatus(data.status ?? 'draft')
        router.replace(`/admin/forms/builder?id=${data._id}`)
      }
      showToast('Saved successfully')
    } catch { showToast('Save failed', false) }
    finally { setIsSaving(false) }
  }

  const handlePublish = async () => {
    const clinicianRoles = ['doctor', 'nurse', 'receptionist']
    const hasAnyClinician = allowedRoles.some(r => clinicianRoles.includes(r))
    const hasDoctor = allowedRoles.includes('doctor')
    if (!hasDoctor) {
      const missing = !hasAnyClinician
        ? 'No clinician roles are selected — doctors, nurses, and receptionists will not see this form.'
        : 'The "Doctor" role is not selected. Doctors will not be able to see or fill this form.'
      const confirmed = window.confirm(
        `⚠️ Publish anyway?\n\n${missing}\n\nClick OK to publish, or Cancel to go back and fix the roles.`
      )
      if (!confirmed) return
    }

    let id = docId
    if (!id) {
      setIsSaving(true)
      try {
        const { data } = await formApi.post('/forms', buildPayload())
        id = data._id as string
        setDocId(id)
        router.replace(`/admin/forms/builder?id=${id}`)
      } catch { showToast('Save failed', false); setIsSaving(false); return }
      setIsSaving(false)
    }
    setIsPublishing(true)
    try {
      await formApi.post(`/forms/${id}/publish`)
      setFormStatus('published')
      showToast('Form published!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Publish failed', false)
    } finally { setIsPublishing(false) }
  }

  // ── DnD ────────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const { setNodeRef: setCanvasRef, isOver: isCanvasOver } = useDroppable({ id: 'canvas' })

  // Adds a field to the end of the canvas (used by click-to-add AND drag-to-canvas)
  const addField = useCallback((type: FieldType) => {
    const newField = createDefaultField(type)
    setFields((prev) => [...prev, newField])
    setSelectedId(newField.id)
  }, [])

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(active.id.toString())

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const activeStr = active.id.toString()
    const overId    = over.id.toString()

    if (activeStr.startsWith('palette-')) {
      const type     = activeStr.replace('palette-', '') as FieldType
      const newField = createDefaultField(type)
      setFields((prev) => {
        // Dropped directly onto an existing canvas field → insert before it
        const overIdx = prev.findIndex((f) => f.id === overId)
        if (overIdx >= 0) { const n = [...prev]; n.splice(overIdx, 0, newField); return n }
        // Dropped on canvas, dropzone, or any other non-field target → append
        return [...prev, newField]
      })
      setSelectedId(newField.id)
    } else if (active.id !== over.id) {
      // Reorder existing canvas fields
      setFields((prev) => {
        const oldIdx = prev.findIndex((f) => f.id === active.id)
        const newIdx = prev.findIndex((f) => f.id === overId)
        return oldIdx >= 0 && newIdx >= 0 ? arrayMove(prev, oldIdx, newIdx) : prev
      })
    }
  }

  const updateField = useCallback(
    (updated: CanvasField) => setFields((p) => p.map((f) => (f.id === updated.id ? updated : f))),
    [],
  )
  const deleteField = useCallback((id: string) => {
    setFields((p) => p.filter((f) => f.id !== id))
    setSelectedId((s) => (s === id ? null : s))
  }, [])

  const selectedField = fields.find((f) => f.id === selectedId) ?? null
  const activePalette = activeId?.startsWith('palette-')
    ? (activeId.replace('palette-', '') as FieldType) : null
  const activeCanvas  = activeId && !activeId.startsWith('palette-')
    ? (fields.find((f) => f.id === activeId) ?? null) : null

  const isPublished = formStatus === 'published'

  if (loadError) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-slate-400">{loadError}</p>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <button
          onClick={() => router.push('/admin/forms')}
          suppressHydrationWarning
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Form name…"
          className="flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />

        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-blue-400"
        >
          <option value="">Specialty…</option>
          {SPECIALTIES.map((s) => (
            <option key={s} value={s.toLowerCase()}>{s}</option>
          ))}
        </select>

        {/* Roles: who can see this form */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1">
          <span className="text-xs font-medium text-slate-400 mr-0.5">Visible to:</span>
          {['doctor', 'nurse', 'receptionist'].map((r) => {
            const checked = allowedRoles.includes(r)
            return (
              <label key={r} className={cn(
                'flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors select-none',
                checked ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-100',
              )}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    setAllowedRoles((prev) =>
                      checked ? prev.filter((x) => x !== r) : [...prev, r],
                    )
                  }
                />
                {r}
              </label>
            )
          })}
        </div>

        {isPublished && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            <Check className="size-3" /> Published
          </span>
        )}

        {toast && (
          <span className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
            toast.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
          )}>
            {toast.msg}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isPublishing || isPublished}>
            <Send />
            {isPublishing ? 'Publishing…' : isPublished ? 'Published' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* ── Layout Picker ────────────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
          FORM LAYOUT
        </Typography>
        <ToggleButtonGroup
          value={layoutType}
          exclusive
          onChange={(_, val) => { if (val) setLayoutType(val) }}
          size="small"
          sx={{ gap: 1 }}
        >
          <ToggleButton value="wizard" sx={{ px: 2, borderRadius: '8px !important', border: '1px solid !important' }}>
            <WizardIcon sx={{ mr: 1, fontSize: 18 }} />
            Wizard
          </ToggleButton>
          <ToggleButton value="accordion" sx={{ px: 2, borderRadius: '8px !important', border: '1px solid !important' }}>
            <AccordionIcon sx={{ mr: 1, fontSize: 18 }} />
            Accordion
          </ToggleButton>
          <ToggleButton value="tabs" sx={{ px: 2, borderRadius: '8px !important', border: '1px solid !important' }}>
            <TabIcon sx={{ mr: 1, fontSize: 18 }} />
            Tabs
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
          {layoutType === 'wizard' ? 'One section per page with progress stepper'
            : layoutType === 'accordion' ? 'All sections visible, collapsible'
            : 'Sections as horizontal tabs'}
        </Typography>
      </Box>

      {/* ── Three-panel DnD area ──────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Palette ─────────────────────────────────────────────── */}
          <aside className="flex w-52 shrink-0 flex-col overflow-y-auto bg-slate-900 px-3 py-4">
            <p className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">
              Field Types
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {FIELD_DEFS.map(({ type, label, icon, color }) => (
                <PaletteItem key={type} type={type} label={label} icon={icon} color={color} onAdd={addField} />
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-white/5 bg-white/5 px-3 py-3">
              <p className="text-xs leading-relaxed text-slate-400">
                Click a field to add it, or drag it onto the canvas.
              </p>
            </div>
          </aside>

          {/* CENTER: Canvas ────────────────────────────────────────────── */}
          <main
            ref={setCanvasRef}
            className={cn(
              'flex flex-1 flex-col overflow-y-auto px-8 py-6 transition-colors duration-200',
              isCanvasOver ? 'bg-blue-50/60' : 'bg-slate-50',
            )}
          >
            {/* Field count pill */}
            {fields.length > 0 && (
              <p className="mb-4 text-xs font-medium text-slate-400">
                {fields.length} field{fields.length !== 1 ? 's' : ''} — drag to reorder
              </p>
            )}

            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2.5">
                {fields.map((f) => (
                  <SortableFieldCard
                    key={f.id}
                    field={f}
                    isSelected={selectedId === f.id}
                    onSelect={() => setSelectedId(f.id)}
                    onDelete={() => deleteField(f.id)}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drop zone — registered as its own droppable so empty canvas always works */}
            <CanvasDropZone hasFields={fields.length > 0} />
          </main>

          {/* RIGHT: Config panel ───────────────────────────────────────── */}
          <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
            {selectedField ? (
              <FieldConfigPanel
                key={selectedField.id}
                field={selectedField}
                onChange={updateField}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Sliders className="size-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">No field selected</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Click any field on the canvas to edit its label, type, and validation rules.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ── Drag overlay ─────────────────────────────────────────────── */}
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activePalette && (() => {
            const def = getDef(activePalette)
            const Icon = def.icon
            return (
              <div className="flex cursor-grabbing items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-2xl ring-2 ring-blue-500/25 rotate-1 scale-105">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', def.color)}>
                  <Icon className="size-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{def.label} field</p>
                  <p className="text-xs text-slate-400 capitalize">{activePalette}</p>
                </div>
              </div>
            )
          })()}
          {activeCanvas && (() => {
            const def = getDef(activeCanvas.type)
            const Icon = def.icon
            return (
              <div className="flex cursor-grabbing items-center gap-3 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xl ring-2 ring-blue-500/20 scale-105">
                <div className={cn('self-stretch w-1 shrink-0', TYPE_ACCENT[activeCanvas.type])} />
                <div className="flex flex-1 items-center gap-3 px-3 py-3.5">
                  <GripVertical className="size-4 shrink-0 text-slate-300" />
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', def.color)}>
                    <Icon className="size-3.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{activeCanvas.label}</p>
                    <p className="text-xs capitalize text-slate-400">{activeCanvas.type}</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── Page (Suspense wrapper for useSearchParams) ────────────────────────────────

export default function FormBuilderPage() {
  return (
    <div className="h-full">
      <Suspense fallback={
        <div className="flex h-full items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-400">Loading builder…</p>
        </div>
      }>
        <BuilderContent />
      </Suspense>
    </div>
  )
}
