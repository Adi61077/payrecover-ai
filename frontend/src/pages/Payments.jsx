import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Filter, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { paymentsApi } from '../services/api'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const res = await paymentsApi.getAll()
      setPayments(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.id.includes(q) || p.customer_name.toLowerCase().includes(q) ||
      p.customer_email.toLowerCase().includes(q) || p.failure_reason.toLowerCase().includes(q)
    const matchRisk = filterRisk === 'all' || p.risk_level === filterRisk
    const matchStatus = filterStatus === 'all' || p.recovery_status === filterStatus
    return matchSearch && matchRisk && matchStatus
  })

  const statusCounts = {
    all:       payments.length,
    pending:   payments.filter(p => p.recovery_status === 'pending').length,
    recovered: payments.filter(p => p.recovery_status === 'recovered').length,
    escalated: payments.filter(p => p.recovery_status === 'escalated').length,
    stopped:   payments.filter(p => p.recovery_status === 'stopped').length,
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Failed Payments</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {payments.length} total payments · {statusCounts.pending} awaiting recovery
          </p>
        </div>
        <button onClick={load} className="btn-secondary gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Quick filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {Object.entries(statusCounts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)} ({count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, customer, failure reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSpinner text="Loading payments..." /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">No payments match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Payment ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Failure Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Prev Fails</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Retries</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Risk</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Recovery</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate(`/payments/${p.id}`)}>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {p.id}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800 text-sm">{p.customer_name}</div>
                      <div className="text-xs text-slate-400">{p.customer_email}</div>
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900 whitespace-nowrap">{fmt(p.amount)}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-[180px]">
                      <div className="truncate" title={p.failure_reason}>{p.failure_reason}</div>
                      <div className="font-mono text-slate-400 text-xs">{p.failure_code}</div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-sm font-semibold ${p.previous_failures >= 3 ? 'text-red-600' : p.previous_failures >= 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {p.previous_failures}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-sm font-semibold ${p.retry_count >= 2 ? 'text-red-600' : p.retry_count >= 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {p.retry_count}/2
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.risk_level} /></td>
                    <td className="px-5 py-3"><StatusBadge status={p.recovery_status} /></td>
                    <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{timeAgo(p.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ArrowRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400 text-center">
        Demo data only — all payments are synthetic. No real transactions are processed.
      </p>
    </div>
  )
}
