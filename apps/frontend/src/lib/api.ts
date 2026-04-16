import axios from 'axios'

export const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3001',
  withCredentials: true,
})

export const iamApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3002',
  withCredentials: true,
})

export const formApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_FORM_URL || 'http://localhost:3003',
  withCredentials: true,
})

export const submissionApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SUBMISSION_URL || 'http://localhost:3004',
  withCredentials: true,
})

export const patientApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PATIENT_URL || 'http://localhost:3006',
  withCredentials: true,
})

export const tenantApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TENANT_URL || 'http://localhost:3010',
  withCredentials: true,
})

export const integrationApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_INTEGRATION_URL || 'http://localhost:3009',
  withCredentials: true,
})

export const auditApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUDIT_URL || 'http://localhost:3008',
  withCredentials: true,
})
