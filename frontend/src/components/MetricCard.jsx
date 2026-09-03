import React from 'react'
import clsx from 'clsx'

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'default', loading }) {
  const colors = {
    default: 'text-slate-200',
    green:   'text-emerald-400',
    red:     'text-red-400',
    amber:   'text-amber-400',
    blue:    'text-blue-400',
    purple:  'text-purple-400',
  }

  const iconBg = {
    default: 'bg-slate-800',
    green:   'bg-emerald-500/15',
    red:     'bg-red-500/15',
    amber:   'bg-amber-500/15',
    blue:    'bg-blue-500/15',
    purple:  'bg-purple-500/15',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>
          {loading ? (
            <div className="h-7 w-24 bg-slate-800 animate-pulse rounded mt-1" />
          ) : (
            <p className={clsx('text-2xl font-bold leading-tight', colors[color])}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-xl flex-shrink-0', iconBg[color])}>
            <Icon className={clsx('w-5 h-5', colors[color])} />
          </div>
        )}
      </div>
    </div>
  )
}
