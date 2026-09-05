import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts'
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react'
import MetricCard from '../components/MetricCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { paymentsApi } from '../services/api'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const COLORS = {
  retry:    '#6272f3',
  reminder: '#a78bfa',
  escalate: '#f59e0b',
  stop:     '#ef4444',
}

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-slate-500 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [metrics, setMetrics] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const [m, p] = await Promise.all([
        paymentsApi.getMetrics(),
        paymentsApi.getAll()
      ])
      setMetrics(m.data)
      setPayments(p.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Derived data for charts
  const riskDistribution = React.useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 }
    const amounts = { low: 0, medium: 0, high: 0 }
    payments.forEach(p => {
      counts[p.risk_level] = (counts[p.risk_level] || 0) + 1
      amounts[p.risk_level] = (amounts[p.risk_level] || 0) + p.amount
    })
    return Object.entries(counts).map(([level, count]) => ({
      level: level.charAt(0).toUpperCase() + level.slice(1),
      count,
      amount: amounts[level],
      color: RISK_COLORS[level]
    }))
  }, [payments])

  const failureCodeData = React.useMemo(() => {
    const counts = {}
    payments.forEach(p => {
      const code = p.failure_code || 'UNKNOWN'
      counts[code] = (counts[code] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code: code.replace(/_/g, ' '), count }))
  }, [payments])

  const recoveryStatusData = React.useMemo(() => {
    const counts = {}
    payments.forEach(p => {
      counts[p.recovery_status] = (counts[p.recovery_status] || 0) + 1
    })
    return Object.entries(counts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1),
      value: count
    }))
  }, [payments])

  const STATUS_PIE_COLORS = ['#f59e0b', '#10b981', '#6272f3', '#ef4444', '#8b5cf6', '#64748b']

  const actionData = React.useMemo(() => {
    if (!metrics?.action_distribution) return []
    return metrics.action_distribution.map(d => ({
      name: d.action.charAt(0).toUpperCase() + d.action.slice(1),
      count: d.count,
      fill: COLORS[d.action] || '#64748b'
    }))
  }, [metrics])

  const amountByRisk = React.useMemo(() => {
    return payments.reduce((acc, p) => {
      const key = p.risk_level
      if (!acc[key]) acc[key] = { level: key.charAt(0).toUpperCase() + key.slice(1), total: 0, count: 0 }
      acc[key].total += p.amount
      acc[key].count += 1
      return acc
    }, {})
  }, [payments])

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-brand-600" />
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Analytics</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Recovery Analytics</h1>
        <p className="text-slate-400 mt-1 text-sm">Metrics calculated from demo payment dataset</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <MetricCard title="Total Revenue at Risk"   value={fmt(metrics?.revenue_at_risk || 0)}      color="red"   loading={false} />
            <MetricCard title="Revenue Recovered"       value={fmt(metrics?.recovered_revenue || 0)}    color="green" loading={false} />
            <MetricCard title="Recovery Rate"           value={`${metrics?.recovery_rate || 0}%`}       color="blue"  loading={false} />
            <MetricCard title="Total Payments"          value={payments.length}                         color="default" loading={false} />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Failure codes */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Failure Code Distribution</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={failureCodeData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="code" type="category" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#4f56e8" radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recovery Status Distribution */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Recovery Status Distribution</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={recoveryStatusData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {recoveryStatusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Risk Level by Count */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Payments by Risk Level</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="level" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Payments" radius={[4, 4, 0, 0]}>
                    {riskDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Risk Level */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Revenue at Risk by Level</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="level" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                    {riskDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Action Distribution */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Recovery Actions Taken</h3>
              {actionData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs text-center">
                  No actions taken yet.<br />Run recovery actions to see distribution.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={actionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                      {actionData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Revenue trend */}
          {(metrics?.revenue_by_day?.length || 0) > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-5">Revenue Recovery Trend (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metrics.revenue_by_day.map(d => ({
                  date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                  'At Risk': Math.round(d.at_risk),
                  'Recovered': Math.round(d.recovered),
                }))}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="At Risk" stroke="#ef4444" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="Recovered" stroke="#10b981" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Table */}
          <div className="card mt-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Recovery Summary by Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Metric</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Count</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { label: 'Recovered', count: metrics?.successful_recoveries || 0, amount: metrics?.recovered_revenue || 0, color: 'text-emerald-600' },
                    { label: 'Pending',   count: metrics?.total_failed_payments || 0, amount: payments.filter(p => p.recovery_status === 'pending').reduce((s, p) => s + p.amount, 0),   color: 'text-slate-600' },
                    { label: 'Escalated', count: metrics?.escalated_payments || 0,    amount: payments.filter(p => p.recovery_status === 'escalated').reduce((s, p) => s + p.amount, 0), color: 'text-amber-600' },
                    { label: 'Stopped',   count: metrics?.stopped_payments || 0,      amount: payments.filter(p => p.recovery_status === 'stopped').reduce((s, p) => s + p.amount, 0),   color: 'text-slate-400' },
                  ].map(row => {
                    const totalAmount = (metrics?.revenue_at_risk || 0) + (metrics?.recovered_revenue || 0)
                    const pct = totalAmount > 0 ? ((row.amount / totalAmount) * 100).toFixed(1) : 0
                    return (
                      <tr key={row.label} className="hover:bg-slate-50">
                        <td className={`px-6 py-3 font-medium ${row.color}`}>{row.label}</td>
                        <td className="px-6 py-3 text-right text-slate-700">{row.count}</td>
                        <td className="px-6 py-3 text-right text-slate-700">{fmt(row.amount)}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
