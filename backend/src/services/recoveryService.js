/**
 * RECOVERY SERVICE
 *
 * Simulates recovery actions. All actions are demo/simulated only.
 * No real payments are processed or real money moved.
 */

const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Simulate recovery outcome based on action type and payment data.
 * Returns success/failure based on realistic probability modeling.
 */
function simulateOutcome(action, payment, aiAnalysis) {
  const recoveryProbability = aiAnalysis.recovery_probability || 50;

  switch (action) {
    case 'retry': {
      // Simulate based on recovery probability with some randomness
      const roll = Math.random() * 100;
      const adjustedProb = Math.min(92, recoveryProbability * 0.95);
      return roll < adjustedProb ? 'success' : 'failed';
    }
    case 'reminder':
      // Reminders have moderate success rate (customer action required)
      return Math.random() < 0.65 ? 'success' : 'pending_customer';
    case 'escalate':
      // Escalations are always "success" in the sense they're handed to a human
      return 'escalated';
    case 'stop':
      return 'stopped';
    default:
      return 'unknown';
  }
}

/**
 * Execute a recovery action for a payment.
 * Records the action and its outcome in the database.
 */
async function executeRecoveryAction(paymentId, finalAction, aiAnalysis, guardrailDecision) {
  const db = getDb();

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  // Simulate the outcome
  const outcome = simulateOutcome(finalAction, payment, aiAnalysis);

  // Determine new payment status
  let newPaymentStatus = payment.status;
  let newRecoveryStatus = payment.recovery_status;

  switch (outcome) {
    case 'success':
      newPaymentStatus = 'recovered';
      newRecoveryStatus = 'recovered';
      break;
    case 'failed':
      newRecoveryStatus = 'failed';
      break;
    case 'pending_customer':
      newRecoveryStatus = 'pending_customer';
      break;
    case 'escalated':
      newRecoveryStatus = 'escalated';
      break;
    case 'stopped':
      newRecoveryStatus = 'stopped';
      break;
  }

  const now = new Date().toISOString();
  const actionId = uuidv4();

  // Record the recovery action
  db.prepare(`
    INSERT INTO recovery_actions (id, payment_id, action_type, ai_recommendation, guardrail_decision, guardrail_override, final_action, outcome, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    paymentId,
    finalAction,
    JSON.stringify(aiAnalysis),
    JSON.stringify(guardrailDecision),
    guardrailDecision.override_triggered ? 1 : 0,
    finalAction,
    outcome,
    now
  );

  // Update payment status
  db.prepare(`
    UPDATE payments
    SET status = ?, recovery_status = ?, retry_count = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newPaymentStatus,
    newRecoveryStatus,
    finalAction === 'retry' ? payment.retry_count + 1 : payment.retry_count,
    now,
    paymentId
  );

  // Add audit logs
  const auditEvents = buildAuditEvents(paymentId, finalAction, outcome, aiAnalysis, guardrailDecision, now);
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAllAudit = db.transaction(() => {
    for (const event of auditEvents) {
      insertAudit.run(event.id, event.payment_id, event.event_type, event.event_description, event.metadata, event.created_at);
    }
  });

  insertAllAudit();

  return {
    actionId,
    paymentId,
    finalAction,
    outcome,
    newStatus: newPaymentStatus,
    newRecoveryStatus,
    amount: payment.amount,
    recovered: outcome === 'success' ? payment.amount : 0
  };
}

function buildAuditEvents(paymentId, finalAction, outcome, aiAnalysis, guardrailDecision, timestamp) {
  const events = [];
  const base = new Date(timestamp).getTime();

  // AI analysis complete
  events.push({
    id: uuidv4(),
    payment_id: paymentId,
    event_type: 'ai_diagnosis_complete',
    event_description: `AI diagnosis: ${aiAnalysis.diagnosis}`,
    metadata: JSON.stringify({
      recovery_probability: aiAnalysis.recovery_probability,
      recommended_action: aiAnalysis.recommended_action,
      risk_level: aiAnalysis.risk_level,
      is_fallback: aiAnalysis.is_fallback
    }),
    created_at: new Date(base - 3000).toISOString()
  });

  // Guardrail check
  events.push({
    id: uuidv4(),
    payment_id: paymentId,
    event_type: 'guardrail_check',
    event_description: guardrailDecision.override_triggered
      ? `⚠️ Guardrail override: ${guardrailDecision.override_reason}`
      : `✅ Guardrail validation passed. Action approved: ${finalAction.toUpperCase()}`,
    metadata: JSON.stringify({
      ai_recommendation: guardrailDecision.ai_recommendation,
      final_action: guardrailDecision.final_action,
      override_triggered: guardrailDecision.override_triggered,
      rules_evaluated: guardrailDecision.rules_evaluated?.length || 0
    }),
    created_at: new Date(base - 2000).toISOString()
  });

  // Action executed
  events.push({
    id: uuidv4(),
    payment_id: paymentId,
    event_type: 'action_executed',
    event_description: getActionDescription(finalAction),
    metadata: JSON.stringify({ action: finalAction }),
    created_at: new Date(base - 1000).toISOString()
  });

  // Outcome recorded
  events.push({
    id: uuidv4(),
    payment_id: paymentId,
    event_type: getOutcomeEventType(outcome),
    event_description: getOutcomeDescription(finalAction, outcome),
    metadata: JSON.stringify({ outcome, final_action: finalAction }),
    created_at: new Date(base).toISOString()
  });

  return events;
}

function getActionDescription(action) {
  switch (action) {
    case 'retry': return 'Retry payment executed (simulated) — retrying payment with issuing bank';
    case 'reminder': return 'Payment reminder sent to customer (simulated) — requesting payment method update';
    case 'escalate': return 'Case escalated to human recovery agent for manual review';
    case 'stop': return 'Recovery stopped — no further automated attempts will be made';
    default: return `Action ${action} executed`;
  }
}

function getOutcomeEventType(outcome) {
  switch (outcome) {
    case 'success': return 'payment_recovered';
    case 'failed': return 'recovery_failed';
    case 'escalated': return 'escalated_to_human';
    case 'stopped': return 'recovery_stopped';
    case 'pending_customer': return 'awaiting_customer';
    default: return 'outcome_recorded';
  }
}

function getOutcomeDescription(action, outcome) {
  switch (outcome) {
    case 'success': return 'Payment successfully recovered! Revenue recovered.';
    case 'failed': return 'Recovery attempt failed. Payment could not be processed.';
    case 'escalated': return 'Payment escalated to human agent. Awaiting manual review and action.';
    case 'stopped': return 'Recovery permanently stopped. Payment marked as unrecoverable.';
    case 'pending_customer': return 'Reminder sent. Awaiting customer response and payment method update.';
    default: return `Recovery outcome: ${outcome}`;
  }
}

module.exports = { executeRecoveryAction };
