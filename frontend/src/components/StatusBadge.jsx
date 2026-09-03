import React from 'react'
import clsx from 'clsx'

const configs = {
  // Payment status
  failed:           { label: 'Failed',           color: 'bg-red-500/15 text-red-400 border-red-800/40' },
  recovered:        { label: 'Recovered',         color: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40' },
  // Recovery status
  pending:          { label: 'Pending',           color: 'bg-slate-500/15 text-slate-400 border-slate-700/40' },
  stopped:          { label: 'Stopped',           color: 'bg-slate-600/20 text-slate-400 border-slate-700/50' },
  escalated:        { label: 'Escalated',         color: 'bg-amber-500/15 text-amber-400 border-amber-800/40' },
  pending_customer: { label: 'Awaiting Customer', color: 'bg-blue-500/15 text-blue-400 border-blue-800/40' },
  // Risk level
  low:    { label: 'Low Risk',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40' },
  medium: { label: 'Medium Risk', color: 'bg-amber-500/15 text-amber-400 border-amber-800/40' },
  high:   { label: 'High Risk',   color: 'bg-red-500/15 text-red-400 border-red-800/40' },
  // Actions
  retry:    { label: 'Retry',     color: 'bg-blue-500/15 text-blue-400 border-blue-800/40' },
  reminder: { label: 'Reminder',  color: 'bg-purple-500/15 text-purple-400 border-purple-800/40' },
  escalate: { label: 'Escalate',  color: 'bg-amber-500/15 text-amber-400 border-amber-800/40' },
  stop:     { label: 'Stop',      color: 'bg-red-500/15 text-red-400 border-red-800/40' },
  // Outcomes
  success:  { label: 'Success',   color: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40' },
  'failed-outcome': { label: 'Failed', color: 'bg-red-500/15 text-red-400 border-red-800/40' },
}

export default function StatusBadge({ status, label: overrideLabel, size = 'sm' }) {
  const config = configs[status] || { label: status, color: 'bg-slate-500/15 text-slate-400 border-slate-700/40' }
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
