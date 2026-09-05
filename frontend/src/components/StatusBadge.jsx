import React from 'react'
import clsx from 'clsx'

const configs = {
  // Payment status
  failed:           { label: 'Failed',           color: 'bg-red-50 text-red-700 border-red-200' },
  recovered:        { label: 'Recovered',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  // Recovery status
  pending:          { label: 'Pending',           color: 'bg-slate-100 text-slate-600 border-slate-200' },
  stopped:          { label: 'Stopped',           color: 'bg-slate-100 text-slate-500 border-slate-200' },
  escalated:        { label: 'Escalated',         color: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_customer: { label: 'Awaiting Customer', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  // Risk level
  low:    { label: 'Low Risk',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium Risk', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  high:   { label: 'High Risk',   color: 'bg-red-50 text-red-700 border-red-200' },
  // Actions
  retry:    { label: 'Retry',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  reminder: { label: 'Reminder',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  escalate: { label: 'Escalate',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  stop:     { label: 'Stop',      color: 'bg-red-50 text-red-700 border-red-200' },
  // Outcomes
  success:          { label: 'Success', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'failed-outcome': { label: 'Failed',  color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function StatusBadge({ status, label: overrideLabel, size = 'sm' }) {
  const config = configs[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={clsx(
      'inline-flex items-center border rounded-full font-medium',
      config.color,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    )}>
      {overrideLabel || config.label}
    </span>
  )
}
