import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, BarChart3,
  ClipboardList, Zap, Shield
} from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabaseClient'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/payments', icon: CreditCard, label: 'Failed Payments' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Trail' },
]

export default function Sidebar() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-30 shadow-sm">
      {/* Logo */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">PayRecover AI</h1>
            <p className="text-xs text-slate-400 leading-tight">Revenue Recovery</p>
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
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
          <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-emerald-800">Guardrails Active</p>
            <p className="text-xs text-emerald-600">AI Safety Enabled</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full mt-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition text-sm font-medium border border-red-100"
        >
          Logout
        </button>
        <p className="text-xs text-slate-400 mt-3 px-1">
          Razorpay AI Buildathon 2026<br />
          Track 3: AI Revenue Recovery
        </p>
      </div>
    </aside>
  )
}
