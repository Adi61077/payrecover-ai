import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Shield, Zap, CheckCircle2, AlertTriangle, Clock,
  Users, StopCircle, Info, RefreshCw, ClipboardList, Sparkles,
  Search, Filter, BellRing
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { auditApi } from '../services/api'

const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const EVENT_CONFIG = {
  payment_failed:         { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',     label: 'Payment Failed' },
  ai_analysis_started:    { icon: Brain,         color: 'text-brand-400',  bg: 'bg-brand-500/10',   label: 'AI Analysis Started' },
  ai_diagnosis_complete:  { icon: Sparkles,      color: 'text-purple-400', bg: 'bg-purple-500/10',  label: 'AI Diagnosis Complete' },
  guardrail_check:        { icon: Shield,        color: 'text-amber-400',  bg: 'bg-amber-500/10',   label: 'Guardrail Check' },
  action_executed:        { icon: Zap,           color: 'text-blue-400',   bg: 'bg-blue-500/10',    label: 'Action Executed' },
  payment_recovered:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Payment Recovered' },
  recovery_failed:        { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',     label: 'Recovery Failed' },
  escalated_to_human:     { icon: Users,         color: 'text-amber-400',  bg: 'bg-amber-500/10',   label: 'Escalated to Human' },
  recovery_stopped:       { icon: StopCircle,    color: 'text-slate-400',  bg: 'bg-slate-500/10',   label: 'Recovery Stopped' },
  awaiting_customer:      { icon: BellRing,      color: 'text-blue-400',   bg: 'bg-blue-500/10',    label: 'Awaiting Customer' },
}

function EventBadge({ eventType }) {
  const cfg = EVENT_CONFIG[eventType] || { label: eventType, color: 'text-slate-400', bg: 'bg-slate-500/10' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterEvent, setFilterEvent] = useState('all')
  const [total, setTotal] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const res = await auditApi.getAll({ limit: 200 })
      setLogs(res.data || [])
      setTotal(res.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const eventTypes = [...new Set(logs.map(l => l.event_type))]

  const filtered = logs.filter(log => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      log.payment_id.toLowerCase().includes(q) ||
      log.event_description.toLowerCase().includes(q) ||
      (log.customer_name || '').toLowerCase().includes(q)
    const matchEvent = filterEvent === 'all' || log.event_type === filterEvent
    return matchSearch && matchEvent
  })

  // Group by payment for timeline view
  const groupedByPayment = React.useMemo(() => {
    const groups = {}
    filtered.forEach(log => {
      if (!groups[log.payment_id]) {
        groups[log.payment_id] = {
          payment_id: log.payment_id,
          customer_name: log.customer_name,
          amount: log.amount,
          currency: log.currency,
          logs: []
        }
      }
      groups[log.payment_id].logs.push(log)
    })
    // Sort logs within each group by time ASC
    Object.values(groups).forEach(g => {
      g.logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })
    return Object.values(groups)
  }, [filtered])

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-brand-400" />
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Audit Trail</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">System Audit Trail</h1>
            <p className="text-slate-400 mt-1 text-sm">{total} total events · Complete history of all AI decisions and recovery actions</p>
          </div>
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-800/50 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by payment ID, customer, event description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-600"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={filterEvent}
            onChange={e => setFilterEvent(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-brand-600 appearance-none cursor-pointer"
          >
            <option value="all">All Event Types</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{EVENT_CONFIG[t]?.label || t}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" text="Loading audit trail..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No audit events found.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByPayment.map(group => (
            <div key={group.payment_id} className="card overflow-hidden">
              {/* Payment header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {group.payment_id}
                  </span>
                  {group.customer_name && (
                    <span className="text-sm font-medium text-slate-200">{group.customer_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {group.amount && (
                    <span className="text-sm font-bold text-white">{fmt(group.amount)}</span>
                  )}
                  <Link
                    to={`/payments/${group.payment_id}`}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                  >
                    View Payment →
                  </Link>
                </div>
              </div>

              {/* Events timeline */}
              <div className="p-6">
                <div className="space-y-0">
                  {group.logs.map((log, i) => {
                    const cfg = EVENT_CONFIG[log.event_type] || { icon: Info, color: 'text-slate-400', bg: 'bg-slate-500/10' }
                    const Icon = cfg.icon
                    return (
                      <div key={log.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          {i < group.logs.length - 1 && (
                            <div className="w-px flex-1 bg-slate-800 my-1 min-h-[16px]" />
                          )}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <EventBadge eventType={log.event_type} />
                              </div>
                              <p className="text-sm text-slate-200">{log.event_description}</p>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {Object.entries(log.metadata).slice(0, 5).map(([k, v]) => (
                                    <span key={k} className="text-xs bg-slate-800 rounded px-2 py-0.5 text-slate-500">
                                      {k}: <span className="text-slate-300">{String(v)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {fmtDate(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center text-xs text-slate-600">
        All events are automatically recorded. This audit trail provides complete traceability for every AI decision and recovery action.
      </div>
    </div>
  )
}
