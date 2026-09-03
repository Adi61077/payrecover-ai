import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, Brain, BarChart3,
  ClipboardList, Zap, Shield
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/payments', icon: CreditCard, label: 'Failed Payments' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Trail' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-30">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">PayRecover AI</h1>
            <p className="text-xs text-slate-500 leading-tight">Revenue Recovery</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-700/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
          <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-300">Guardrails Active</p>
            <p className="text-xs text-slate-500">AI Safety Enabled</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3 px-1">
          Razorpay AI Buildathon 2026<br />
          Track 3: AI Revenue Recovery
        </p>
      </div>
    </aside>
  )
}
