import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Brain, Shield, Zap, RefreshCw, BellRing,
  Users, StopCircle, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, Info, ChevronRight, Sparkles, Mail
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { paymentsApi, analysisApi, recoveryApi } from '../services/api'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const ACTION_CONFIG = {
  retry:    { label: 'Retry Payment',       icon: RefreshCw,  cls: 'btn-success',  desc: 'Automatically retry this payment with the issuing bank' },
  reminder: { label: 'Send Reminder',       icon: BellRing,   cls: 'btn-secondary', desc: 'Send payment update reminder to customer' },
  escalate: { label: 'Escalate to Human',   icon: Users,      cls: 'btn-warning',  desc: 'Hand off to a human recovery agent for manual handling' },
  stop:     { label: 'Stop Recovery',       icon: StopCircle, cls: 'btn-danger',   desc: 'Mark this payment as unrecoverable and close the case' },
}

function ProbabilityBar({ value }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Recovery Probability</span>
        <span className={`font-bold text-base ${value >= 70 ? 'text-emerald-600' : value >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
          {value}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function AuditTimeline({ logs }) {
  const eventIcons = {
    payment_failed:         { icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50' },
    ai_analysis_started:    { icon: Brain,         color: 'text-brand-600',  bg: 'bg-brand-50' },
    ai_diagnosis_complete:  { icon: Sparkles,      color: 'text-purple-600', bg: 'bg-purple-50' },
    guardrail_check:        { icon: Shield,        color: 'text-amber-600',  bg: 'bg-amber-50' },
    action_executed:        { icon: Zap,           color: 'text-blue-600',   bg: 'bg-blue-50' },
    payment_recovered:      { icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    recovery_failed:        { icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50' },
    escalated_to_human:     { icon: Users,         color: 'text-amber-600',  bg: 'bg-amber-50' },
    recovery_stopped:       { icon: StopCircle,    color: 'text-slate-500',  bg: 'bg-slate-100' },
    awaiting_customer:      { icon: Clock,         color: 'text-blue-600',   bg: 'bg-blue-50' },
    email_reminder_sent:    { icon: Mail,          color: 'text-emerald-600', bg: 'bg-emerald-50' },
    email_reminder_failed:  { icon: Mail,          color: 'text-red-600',    bg: 'bg-red-50' },
  }

  if (!logs || logs.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No audit events yet.</p>
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const cfg = eventIcons[log.event_type] || { icon: Info, color: 'text-slate-500', bg: 'bg-slate-100' }
        const Icon = cfg.icon
        return (
          <div key={log.id} className="flex gap-3">
            {/* line */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              {i < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-snug">{log.event_description}</p>
              <p className="text-xs text-slate-400 mt-0.5">{fmtDate(log.created_at)}</p>
              {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(log.metadata).map(([k, v]) => (
                    <span key={k} className="text-xs bg-slate-100 rounded px-2 py-0.5 text-slate-500">
                      {k}: <span className="text-slate-700">{String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [guardrail, setGuardrail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionResult, setActionResult] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailResult, setEmailResult] = useState(null)

  const loadPayment = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await paymentsApi.getOne(id)
      setPayment(res.data)
      if (res.data.ai_analysis) {
        setAnalysis(res.data.ai_analysis)
        // Re-fetch guardrail for display
        try {
          const aRes = await analysisApi.get(id)
          setGuardrail(aRes.data?.guardrail)
        } catch {}
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadPayment() }, [loadPayment])

  async function runAnalysis() {
    try {
      setAnalysisLoading(true)
      setError(null)
      const res = await analysisApi.run(id)
      setAnalysis(res.data.analysis)
      setGuardrail(res.data.guardrail)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function executeAction(overrideAction) {
    try {
      setActionLoading(true)
      setError(null)
      setActionResult(null)
      const res = await recoveryApi.execute(id, overrideAction)
      setActionResult(res.data)
      await loadPayment() // refresh
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function sendReminder() {
    try {
      setEmailLoading(true)
      setEmailResult(null)
      setError(null)
      const res = await recoveryApi.sendReminder(id)
      setEmailResult({ success: true, message: res.data.message, to: res.data.to })
    } catch (err) {
      // err.message is set by the axios interceptor from res.data.error
      setEmailResult({ success: false, message: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading payment details..." />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <p className="text-slate-400">Payment not found.</p>
          <Link to="/payments" className="text-brand-600 hover:text-brand-500 text-sm mt-2 inline-block">← Back to payments</Link>
        </div>
      </div>
    )
  }

  const history = payment.payment_history || {}
  const isResolved = ['recovered', 'stopped', 'escalated'].includes(payment.recovery_status)
  const finalAction = guardrail?.final_action || analysis?.recommended_action

  return (
    <div className="p-8 max-w-7xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link to="/payments" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to payments
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{payment.id}</h1>
              <StatusBadge status={payment.status} size="md" />
              <StatusBadge status={payment.recovery_status} size="md" />
            </div>
            <p className="text-slate-500 text-sm">{payment.customer_name} · {payment.customer_email}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">{fmt(payment.amount)}</p>
            <p className="text-sm text-slate-400 mt-0.5">{payment.currency} · Failed {fmtDate(payment.created_at)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {actionResult && (
        <div className={`mb-5 p-4 rounded-lg border text-sm flex items-center gap-2 ${
          actionResult.outcome === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {actionResult.outcome === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <Info className="w-4 h-4 flex-shrink-0" />}
          <div>
            <strong>Action executed:</strong> {actionResult.finalAction?.toUpperCase()} →{' '}
            <strong>Outcome: {actionResult.outcome?.toUpperCase()}</strong>
            {actionResult.recovered > 0 && ` · ${fmt(actionResult.recovered)} recovered!`}
          </div>
        </div>
      )}

      {emailResult && (
        <div className={`mb-5 p-4 rounded-lg border text-sm flex items-center gap-2 ${
          emailResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {emailResult.success
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span>{emailResult.message}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Payment info + history */}
        <div className="col-span-1 space-y-5">
          {/* Failure Info */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Failure Details</h3>
            <div className="space-y-3">
              <InfoRow label="Reason" value={payment.failure_reason} />
              <InfoRow label="Code" value={<span className="font-mono text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">{payment.failure_code}</span>} />
              <InfoRow label="Risk Level" value={<StatusBadge status={payment.risk_level} />} />
              <InfoRow label="Prev. Failures" value={<span className={payment.previous_failures >= 3 ? 'text-red-600 font-bold' : 'text-slate-700'}>{payment.previous_failures}</span>} />
              <InfoRow label="Retry Count" value={<span className={payment.retry_count >= 2 ? 'text-red-600 font-bold' : 'text-slate-700'}>{payment.retry_count} / 2 max</span>} />
            </div>
          </div>

          {/* Customer Payment History */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Customer History</h3>
            <div className="space-y-3">
              <InfoRow label="Total Payments" value={history.total_payments || '—'} />
              <InfoRow label="Successful" value={
                <span className="text-emerald-600 font-semibold">{history.successful_payments || '—'}</span>
              } />
              <InfoRow label="Total Paid" value={fmt(history.total_amount_paid || 0)} />
              <InfoRow label="Payment Score" value={
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${(history.payment_score || 0) >= 80 ? 'text-emerald-600' : (history.payment_score || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {history.payment_score || '—'}/100
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                    <div className={`h-full rounded-full ${(history.payment_score || 0) >= 80 ? 'bg-emerald-500' : (history.payment_score || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${history.payment_score || 0}%` }} />
                  </div>
                </div>
              } />
              <InfoRow label="Customer Since" value={history.customer_since ? new Date(history.customer_since).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Last Successful" value={history.last_successful ? new Date(history.last_successful).toLocaleDateString('en-IN') : '—'} />
            </div>
          </div>
        </div>

        {/* Right: AI Analysis + Guardrail + Actions */}
        <div className="col-span-2 space-y-5">
          {/* AI Analysis Panel */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-brand-50">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-800">AI Payment Analysis</h2>
                {analysis?.is_fallback && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    Fallback Mode
                  </span>
                )}
              </div>
              {!isResolved && (
                <button onClick={runAnalysis} disabled={analysisLoading} className="btn-primary text-xs py-1.5 px-3">
                  {analysisLoading
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...</>
                    : <><Sparkles className="w-3 h-3" /> {analysis ? 'Re-analyze' : 'Run AI Analysis'}</>}
                </button>
              )}
            </div>

            {analysisLoading && <div className="p-8"><LoadingSpinner text="AI is analyzing payment patterns..." /></div>}

            {!analysisLoading && !analysis && (
              <div className="p-8 text-center">
                <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No AI analysis yet.</p>
                {!isResolved && <p className="text-slate-400 text-xs mt-1">Click "Run AI Analysis" to get a recovery recommendation.</p>}
              </div>
            )}

            {!analysisLoading && analysis && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <ProbabilityBar value={analysis.recovery_probability} />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Risk Assessment</p>
                      <StatusBadge status={analysis.risk_level} size="md" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">AI Recommendation</p>
                      <StatusBadge status={analysis.recommended_action} size="md" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Diagnosis</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">{analysis.diagnosis}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">AI Reasoning</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">{analysis.reasoning}</p>
                </div>
                <p className="text-xs text-slate-400">
                  Model: {analysis.model_used} · {analysis.is_fallback ? 'Rule-based fallback (no OpenAI key configured)' : 'OpenAI GPT'}
                </p>
              </div>
            )}
          </div>

          {/* Guardrail Decision Panel */}
          {guardrail && (
            <div className={`card overflow-hidden border ${guardrail.override_triggered ? 'border-amber-200' : 'border-emerald-200'}`}>
              <div className={`flex items-center gap-2 px-6 py-4 border-b ${guardrail.override_triggered ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
                <Shield className={`w-4 h-4 ${guardrail.override_triggered ? 'text-amber-600' : 'text-emerald-600'}`} />
                <h2 className="text-sm font-semibold text-slate-800">Guardrail Decision</h2>
                {guardrail.override_triggered && (
                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Override Triggered</span>
                )}
              </div>
              <div className="p-6 space-y-4">
                <div className={`p-4 rounded-xl border ${guardrail.override_triggered ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className="text-sm font-medium text-slate-800">{guardrail.decision_summary}</p>
                  {guardrail.override_reason && <p className="text-xs text-amber-700 mt-1">{guardrail.override_reason}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1.5">AI Recommended</p>
                    <StatusBadge status={guardrail.ai_recommendation} size="md" />
                  </div>
                  <div className={`rounded-lg p-3 text-center border ${guardrail.override_triggered ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className="text-xs text-slate-400 mb-1.5">Final Action (After Guardrail)</p>
                    <StatusBadge status={guardrail.final_action} size="md" />
                  </div>
                </div>
                {guardrail.rules_evaluated && guardrail.rules_evaluated.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Rules Evaluated ({guardrail.rules_evaluated.length})</p>
                    <div className="space-y-1.5">
                      {guardrail.rules_evaluated.map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                            rule.status === 'triggered' ? 'bg-amber-100 text-amber-700' :
                            rule.status === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {rule.status === 'triggered' ? '!' : rule.status === 'passed' ? '✓' : '·'}
                          </span>
                          <div>
                            <span className="font-mono text-slate-500">{rule.rule}</span>
                            <span className="text-slate-500 ml-1">— {rule.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isResolved && analysis && guardrail && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-600" /> Execute Recovery Action
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                The guardrail-approved action is <strong className="text-slate-700">{finalAction?.toUpperCase()}</strong>. You can also manually trigger any action below — it will be re-validated by the guardrail engine.
              </p>

              {/* Recommended action highlighted */}
              <div className="mb-4 p-4 border border-brand-200 bg-brand-50 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-brand-600 font-medium mb-1">Guardrail-Approved Action</p>
                    <p className="text-sm text-slate-900 font-semibold">{ACTION_CONFIG[finalAction]?.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{ACTION_CONFIG[finalAction]?.desc}</p>
                  </div>
                  <button onClick={() => executeAction(finalAction)} disabled={actionLoading} className="btn-primary">
                    {actionLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Executing...</> : <><Zap className="w-4 h-4" /> Execute</>}
                  </button>
                </div>
              </div>

              {/* All 4 action buttons */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ACTION_CONFIG).map(([action, cfg]) => {
                  const Icon = cfg.icon
                  const isRecommended = action === finalAction
                  return (
                    <button key={action} onClick={() => executeAction(action)} disabled={actionLoading || isRecommended}
                      className={`${cfg.cls} text-left ${isRecommended ? 'opacity-40 cursor-default' : ''}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{cfg.label}</div>
                        <div className="text-xs opacity-70 font-normal">{isRecommended ? 'Already selected above' : 'Manual override'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Email reminder button */}
              {finalAction === 'reminder' && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send Recovery Reminder Email</p>
                        <p className="text-xs text-slate-400">
                          Sends a simulated reminder to <span className="text-slate-600">{payment.customer_email}</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={sendReminder} disabled={emailLoading}
                      className="btn bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200">
                      {emailLoading
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
                        : <><Mail className="w-4 h-4" /> Send Email</>}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">
                All actions are simulated. No real payments are processed.
              </p>
            </div>
          )}

          {isResolved && (
            <div className={`card p-5 border ${payment.recovery_status === 'recovered' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                {payment.recovery_status === 'recovered' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : payment.recovery_status === 'escalated' ? (
                  <Users className="w-6 h-6 text-amber-600" />
                ) : (
                  <StopCircle className="w-6 h-6 text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {payment.recovery_status === 'recovered' && `Payment Recovered — ${fmt(payment.amount)} recovered!`}
                    {payment.recovery_status === 'escalated' && 'Escalated to Human Agent'}
                    {payment.recovery_status === 'stopped' && 'Recovery Stopped'}
                    {payment.recovery_status === 'pending_customer' && 'Awaiting Customer Action'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">This case has been resolved. No further actions needed.</p>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Audit Trail
            </h2>
            <AuditTimeline logs={payment.audit_logs || []} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-400 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 text-right">{value}</span>
    </div>
  )
}
