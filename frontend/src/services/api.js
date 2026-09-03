import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  res => res.data,
  err => {
    const message = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export const paymentsApi = {
  getAll: (params) => api.get('/payments', { params }),
  getOne: (id) => api.get(`/payments/${id}`),
  getMetrics: () => api.get('/payments/metrics'),
}

export const analysisApi = {
  run: (paymentId) => api.post(`/analysis/${paymentId}`),
  get: (paymentId) => api.get(`/analysis/${paymentId}`),
}

export const recoveryApi = {
  execute: (paymentId, overrideAction) =>
    api.post(`/recovery/${paymentId}/execute`, overrideAction ? { override_action: overrideAction } : {}),
  getActions: (paymentId) => api.get(`/recovery/${paymentId}/actions`),
  sendReminder: (paymentId) => api.post(`/recovery/${paymentId}/send-reminder`),
}

export const auditApi = {
  getAll: (params) => api.get('/audit', { params }),
  getForPayment: (paymentId) => api.get(`/audit/${paymentId}`),
}

export default api
