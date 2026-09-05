import React from 'react'
import clsx from 'clsx'

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'default', loading }) {
  const valueColors = {
    default: 'text-slate-800',
    green:   'text-emerald-600',
    red:     'text-red-600',
    amber:   'text-amber-600',
    blue:    'text-brand-600',
    purple:  'text-purple-600',
  }

  const iconBg = {
    default: 'bg-slate-100',
    green:   'bg-emerald-50',
    red:     'bg-red-50',
    amber:   'bg-amber-50',
    blue:    'bg-brand-50',
    purple:  'bg-purple-50',
  }

  const iconColors = {
    default: 'text-slate-500',
    green:   'text-emerald-600',
    red:     'text-red-600',
    amber:   'text-amber-600',
    blue:    'text-brand-600',
    purple:  'text-purple-600',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          {loading ? (
            <div className="h-7 w-24 bg-slate-100 animate-pulse rounded mt-1" />
          ) : (
            <p className={clsx('text-2xl font-bold leading-tight', valueColors[color])}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-xl flex-shrink-0', iconBg[color])}>
            <Icon className={clsx('w-5 h-5', iconColors[color])} />
          </div>
        )}
      </div>
    </div>
  )
}
