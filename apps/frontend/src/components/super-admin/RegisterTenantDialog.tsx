'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Grid,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Alert,
  LinearProgress,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  IconButton,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Apartment as ApartmentIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material'
import { tenantApi } from '@/lib/api'

interface RegisterTenantDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface FormData {
  name: string
  subdomain: string
  plan: string
  region: string
  hospitalType: string
  adminName: string
  adminEmail: string
}

interface SuccessData {
  tenantId: string
  adminEmail: string
  generatedPassword: string
}

const STEPS = ['Hospital Details', 'Admin Account', 'Review & Create']

const PLAN_OPTIONS = ['starter', 'professional', 'enterprise']
const REGION_OPTIONS = ['ap-south-1', 'ap-southeast-1', 'eu-west-1']
const HOSPITAL_TYPE_OPTIONS = ['general', 'specialty', 'diagnostic', 'clinic']

const emptyForm: FormData = {
  name: '',
  subdomain: '',
  plan: 'starter',
  region: 'ap-south-1',
  hospitalType: 'general',
  adminName: '',
  adminEmail: '',
}

export default function RegisterTenantDialog({
  open,
  onClose,
  onSuccess,
}: RegisterTenantDialogProps) {
  const router = useRouter()

  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [copied, setCopied] = useState(false)

  // Subdomain availability
  const [subdomainChecking, setSubdomainChecking] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)
  const subdomainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setActiveStep(0)
        setFormData(emptyForm)
        setLoading(false)
        setError(null)
        setSuccessData(null)
        setCopied(false)
        setSubdomainAvailable(null)
      }, 300)
    }
  }, [open])

  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setFormData((prev) => ({ ...prev, subdomain: cleaned }))
    setSubdomainAvailable(null)

    if (subdomainTimer.current) clearTimeout(subdomainTimer.current)
    if (!cleaned) return

    setSubdomainChecking(true)
    subdomainTimer.current = setTimeout(async () => {
      try {
        const res = await tenantApi.get('/tenants')
        const tenants: Array<{ subdomain: string }> = res.data ?? []
        const taken = tenants.some((t) => t.subdomain === cleaned)
        setSubdomainAvailable(!taken)
      } catch {
        setSubdomainAvailable(null)
      } finally {
        setSubdomainChecking(false)
      }
    }, 500)
  }

  const handleNext = () => {
    setError(null)

    if (activeStep === 0) {
      if (!formData.name.trim()) { setError('Hospital name is required'); return }
      if (!formData.subdomain.trim()) { setError('Subdomain is required'); return }
      if (subdomainAvailable === false) { setError('That subdomain is already taken'); return }
    }
    if (activeStep === 1) {
      if (!formData.adminName.trim()) { setError('Admin full name is required'); return }
      if (!formData.adminEmail.trim()) { setError('Admin email is required'); return }
    }

    setActiveStep((s) => s + 1)
  }

  const handleBack = () => {
    setError(null)
    setActiveStep((s) => s - 1)
  }

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tenantApi.post('/tenants/onboard', {
        name: formData.name,
        subdomain: formData.subdomain,
        plan: formData.plan,
        region: formData.region,
        hospitalType: formData.hospitalType,
        adminEmail: formData.adminEmail,
        adminName: formData.adminName,
      })
      setSuccessData({
        tenantId: res.data.tenant?.id ?? res.data.id ?? '',
        adminEmail: formData.adminEmail,
        generatedPassword: res.data.generatedPassword ?? res.data.adminPassword ?? '(check email)',
      })
      onSuccess()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to register hospital. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!successData) return
    const text = `Email: ${successData.adminEmail}\nPassword: ${successData.generatedPassword}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleReset = () => {
    setActiveStep(0)
    setFormData(emptyForm)
    setError(null)
    setSuccessData(null)
    setCopied(false)
    setSubdomainAvailable(null)
  }

  // ── Success Screen ──────────────────────────────────────────────────────────
  if (successData) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 72, color: '#4caf50', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Hospital registered successfully!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {formData.name} has been onboarded to the platform.
          </Typography>

          <Paper
            sx={{
              bgcolor: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: 2,
              p: 2.5,
              textAlign: 'left',
              mb: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#2e7d32' }}>
              Admin Credentials — Save these now
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Email:</strong> {successData.adminEmail}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              <strong>Generated Password:</strong>{' '}
              <code style={{ background: 'rgba(0,0,0,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                {successData.generatedPassword}
              </code>
            </Typography>
            <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
              Shown once only — copy and save now
            </Alert>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              size="small"
              color={copied ? 'success' : 'primary'}
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
          <Button variant="outlined" onClick={handleReset}>
            Register Another
          </Button>
          {successData.tenantId && (
            <Button
              variant="contained"
              onClick={() => {
                onClose()
                router.push(`/super-admin/tenants/${successData.tenantId}`)
              }}
              sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' } }}
            >
              View Hospital
            </Button>
          )}
        </DialogActions>
      </Dialog>
    )
  }

  // ── Step Content ────────────────────────────────────────────────────────────
  const renderStep0 = () => (
    <Grid container spacing={2}>
      <Grid size={12}>
        <TextField
          fullWidth
          label="Hospital Name *"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
        />
      </Grid>
      <Grid size={12}>
        <TextField
          fullWidth
          label="Subdomain *"
          value={formData.subdomain}
          onChange={(e) => handleSubdomainChange(e.target.value)}
          helperText={
            subdomainChecking
              ? 'Checking availability...'
              : subdomainAvailable === true
              ? 'Subdomain is available'
              : subdomainAvailable === false
              ? 'Subdomain is already taken'
              : 'e.g. city-hospital (lowercase letters, numbers, hyphens only)'
          }
          error={subdomainAvailable === false}
          slotProps={{
            input: {
              endAdornment: subdomainChecking ? (
                <CircularProgress size={16} />
              ) : subdomainAvailable === true ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : subdomainAvailable === false ? (
                <CancelIcon color="error" fontSize="small" />
              ) : null,
            },
            htmlInput: { suppressHydrationWarning: true },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth>
          <InputLabel>Plan *</InputLabel>
          <Select
            value={formData.plan}
            label="Plan *"
            onChange={(e) => setFormData((p) => ({ ...p, plan: e.target.value }))}
          >
            {PLAN_OPTIONS.map((p) => (
              <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth>
          <InputLabel>Region</InputLabel>
          <Select
            value={formData.region}
            label="Region"
            onChange={(e) => setFormData((p) => ({ ...p, region: e.target.value }))}
          >
            {REGION_OPTIONS.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid size={12}>
        <FormControl fullWidth>
          <InputLabel>Hospital Type</InputLabel>
          <Select
            value={formData.hospitalType}
            label="Hospital Type"
            onChange={(e) => setFormData((p) => ({ ...p, hospitalType: e.target.value }))}
          >
            {HOSPITAL_TYPE_OPTIONS.map((t) => (
              <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  )

  const renderStep1 = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        An admin account will be created automatically with a generated password.
      </Alert>
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            fullWidth
            label="Admin Full Name *"
            value={formData.adminName}
            onChange={(e) => setFormData((p) => ({ ...p, adminName: e.target.value }))}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            fullWidth
            label="Admin Email *"
            type="email"
            value={formData.adminEmail}
            onChange={(e) => setFormData((p) => ({ ...p, adminEmail: e.target.value }))}
          />
        </Grid>
      </Grid>
      {formData.adminName && (
        <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Password format: <strong>[Name][4 random digits]!</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            e.g. {formData.adminName.replace(/\s+/g, '')}1234!
          </Typography>
        </Paper>
      )}
    </Box>
  )

  const renderStep2 = () => (
    <Box>
      {/* Summary */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          Review Details
        </Typography>
        <Grid container spacing={1}>
          {[
            ['Hospital Name', formData.name],
            ['Subdomain', formData.subdomain],
            ['Plan', formData.plan],
            ['Region', formData.region],
            ['Hospital Type', formData.hospitalType],
            ['Admin Name', formData.adminName],
            ['Admin Email', formData.adminEmail],
          ].map(([label, value]) => (
            <Grid size={{ xs: 12, sm: 6 }} key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* What will be created */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        What will be created:
      </Typography>
      <List dense disablePadding>
        {[
          'Hospital tenant record',
          'PostgreSQL tenant config',
          'Admin user account',
          'Default roles (doctor, nurse, receptionist)',
          'Kafka provisioning event',
        ].map((item) => (
          <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
            </ListItemIcon>
            <ListItemText primary={item} slotProps={{ primary: { style: { fontSize: '0.875rem' } } }} />
          </ListItem>
        ))}
      </List>

      <Alert severity="warning" sx={{ mt: 2 }}>
        Subdomain cannot be changed after creation.
      </Alert>
    </Box>
  )

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="md" fullWidth>
      {loading && <LinearProgress />}

      <DialogTitle sx={{ pb: 1 }}>Register New Hospital</DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, pt: 1 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && renderStep0()}
        {activeStep === 1 && renderStep1()}
        {activeStep === 2 && renderStep2()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < STEPS.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ApartmentIcon />}
            sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' } }}
          >
            {loading ? 'Creating...' : 'Create Hospital'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
