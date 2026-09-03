import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, AlertTriangle, CheckCircle2, Users,
  RefreshCw, Shield, StopCircle, ArrowRight, IndianRupee,
  Activity
} from 'lucide-react'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { paymentsApi } from '../services/api'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const PIE_COLORS = ['#6272f3', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {fmt(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const [m, p] = await Promise.all([
        paymentsApi.getMetrics(),
        paymentsApi.getAll({ limit: 5 })
      ])
      setMetrics(m.data)
      setPayments(p.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Build chart data — fill missing days
  const chartData = React.useMemo(() => {
    if (!metrics?.revenue_by_day) return []
    return metrics.revenue_by_day.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      'Revenue at Risk': Math.round(d.at_risk),
      'Recovered': Math.round(d.recovered),
    }))
  }, [metrics])

  const pieData = React.useMemo(() => {
    if (!metrics?.action_distribution) return []
    return metrics.action_distribution.map(d => ({
      name: d.action.charAt(0).toUpperCase() + d.action.slice(1),
      value: d.count
    }))
  }, [metrics])

  const recentPending = payments.filter(p => p.recovery_status === 'pending').slice(0, 5)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-brand-400" />
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Live Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Revenue Recovery Overview</h1>
        <p className="text-slate-400 mt-1 text-sm">AI-powered payment recovery · Demo simulation only</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-800/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Backend connection failed: {error}. Make sure the backend is running on port 3001.
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Revenue at Risk"
          value={loading ? '…' : fmt(metrics?.revenue_at_risk || 0)}
          subtitle="Total failed payment value"
          icon={AlertTriangle}
          color="red"
          loading={loading}
        />
        <MetricCard
          title="Recovered Revenue"
          value={loading ? '…' : fmt(metrics?.recovered_revenue || 0)}
          subtitle="Successfully recovered"
          icon={IndianRupee}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Recovery Rate"
          value={loading ? '…' : `${metrics?.recovery_rate || 0}%`}
          subtitle="Of total revenue at risk"
          icon={TrendingUp}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="Failed Payments"
          value={loading ? '…' : metrics?.total_failed_payments || 0}
          subtitle="Requiring attention"
          icon={CreditCardIcon}
          color="amber"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Recovery Attempts"
          value={loading ? '…' : metrics?.total_recovery_attempts || 0}
          subtitle="Total actions executed"
          icon={RefreshCw}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="Successful Recoveries"
          value={loading ? '…' : metrics?.successful_recoveries || 0}
          subtitle="Payments recovered"
          icon={CheckCircle2}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Human Escalations"
          value={loading ? '…' : metrics?.escalated_payments || 0}
          subtitle="Sent to human agents"
          icon={Users}
          color="amber"
          loading={loading}
        />
        <MetricCard
          title="Auto Stops"
          value={loading ? '…' : metrics?.stopped_payments || 0}
          subtitle="Guardrail stopped"
          icon={StopCircle}
          color="red"
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Revenue Recovery Trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 7 days</p>
            </div>
            <Shield className="w-4 h-4 text-slate-600" />
          </div>
          {loading ? (
            <LoadingSpinner text="Loading chart data..." />
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              No chart data yet. Run some recovery actions to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Revenue at Risk" stroke="#ef4444" strokeWidth={2} fill="url(#colorRisk)" />
                <Area type="monotone" dataKey="Recovered" stroke="#10b981" strokeWidth={2} fill="url(#colorRecovered)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recovery Actions Pie */}
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-white">Recovery Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribution by type</p>
          </div>
          {loading ? (
            <LoadingSpinner />
          ) : pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs text-center">
              No actions yet.<br />Run recovery to see distribution.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
                <Tooltip formatter={(v) => [v, 'Actions']} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Pending Payments */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Payments Awaiting Recovery</h2>
          <Link to="/payments" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSpinner text="Loading payments..." /></div>
        ) : recentPending.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No pending payments. All caught up! 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Failure</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Risk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentPending.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{p.id}</td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-200">{p.customer_name}</div>
                      <div className="text-xs text-slate-500">{p.customer_email}</div>
                    </td>
                    <td className="px-6 py-3 font-semibold text-white">{fmt(p.amount)}</td>
                    <td className="px-6 py-3 text-slate-400 text-xs max-w-[160px] truncate">{p.failure_reason}</td>
                    <td className="px-6 py-3"><StatusBadge status={p.risk_level} /></td>
                    <td className="px-6 py-3">
                      <Link to={`/payments/${p.id}`} className="text-brand-400 hover:text-brand-300 text-xs font-medium flex items-center gap-1">
                        Analyze <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// inline icon component to avoid import name clash
function CreditCardIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
