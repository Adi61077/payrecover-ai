/**
 * GUARDRAIL ENGINE
 *
 * This is the deterministic safety layer that validates and potentially overrides
 * AI recommendations before any recovery action is executed.
 *
 * PRINCIPLE: AI suggests → Guardrails decide
 */

const MAX_RETRIES = 2;
const MIN_COOLDOWN_HOURS = 6;

/**
 * Evaluate an AI recommendation against business rules.
 * Returns the final allowed action and the guardrail decision details.
 */
function evaluateRecommendation(payment, aiAnalysis) {
  const {
    retry_count,
    previous_failures,
    recovery_status,
    risk_level: paymentRiskLevel,
    amount,
    failure_code,
    updated_at
  } = payment;

  const { recommended_action, risk_level: aiRiskLevel, recovery_probability } = aiAnalysis;

  const rules = [];
  let finalAction = recommended_action;
  let overrideTriggered = false;
  let overrideReason = null;
  let blocked = false;

  // ─── RULE 1: Prevent duplicate actions on already-resolved payments ────────
  if (recovery_status === 'recovered') {
    rules.push({ rule: 'already_recovered', status: 'triggered', description: 'Payment already recovered. No further action needed.' });
    finalAction = 'stop';
    overrideTriggered = true;
    overrideReason = 'Payment is already recovered. Duplicate action prevented.';
    blocked = true;
  }

  // ─── RULE 2: Prevent actions on stopped payments ───────────────────────────
  if (recovery_status === 'stopped' && !blocked) {
    rules.push({ rule: 'recovery_stopped', status: 'triggered', description: 'Recovery already stopped for this payment.' });
    finalAction = 'stop';
    overrideTriggered = true;
    overrideReason = 'Recovery was previously stopped. No further automated action allowed.';
    blocked = true;
  }

  // ─── RULE 3: Maximum automatic retries limit ──────────────────────────────
  if (!blocked && recommended_action === 'retry' && retry_count >= MAX_RETRIES) {
    rules.push({
      rule: 'max_retries_exceeded',
      status: 'triggered',
      description: `Retry limit reached (${retry_count}/${MAX_RETRIES}). AI recommended retry but guardrail blocked it.`
    });
    finalAction = previous_failures >= 3 ? 'stop' : 'escalate';
    overrideTriggered = true;
    overrideReason = `Maximum retry limit of ${MAX_RETRIES} reached. AI retry recommendation overridden → ${finalAction.toUpperCase()}.`;
  } else if (!blocked) {
    rules.push({ rule: 'max_retries_check', status: 'passed', description: `Retry count ${retry_count} is within limit of ${MAX_RETRIES}.` });
  }

  // ─── RULE 4: High-risk cases must be escalated ────────────────────────────
  const highRiskCodes = ['FRAUD_SUSPECTED', 'FRAUD_FLAG', 'CARD_STOLEN', 'ACCOUNT_FRAUD'];
  const isHighRisk = aiRiskLevel === 'high' || paymentRiskLevel === 'high' || highRiskCodes.includes(failure_code);

  if (!blocked && !overrideTriggered && isHighRisk && recommended_action === 'retry') {
    rules.push({
      rule: 'high_risk_escalation',
      status: 'triggered',
      description: 'High-risk payment. AI recommended retry but guardrail requires escalation.'
    });
    finalAction = 'escalate';
    overrideTriggered = true;
    overrideReason = 'High-risk payment detected. Automated retry blocked → ESCALATE to human agent.';
  } else if (!blocked) {
    rules.push({
      rule: 'high_risk_check',
      status: isHighRisk ? 'noted' : 'passed',
      description: isHighRisk
        ? `High-risk payment noted. Action ${finalAction} is appropriate.`
        : 'Risk level acceptable for automated action.'
    });
  }

  // ─── RULE 5: Very large amounts require escalation ────────────────────────
  const LARGE_AMOUNT_THRESHOLD = 200000; // ₹2 lakh
  if (!blocked && !overrideTriggered && amount >= LARGE_AMOUNT_THRESHOLD && recommended_action === 'retry') {
    rules.push({
      rule: 'large_amount_protection',
      status: 'triggered',
      description: `Amount ₹${amount.toLocaleString('en-IN')} exceeds threshold. Escalation required.`
    });
    finalAction = 'escalate';
    overrideTriggered = true;
    overrideReason = `Transaction amount ₹${amount.toLocaleString('en-IN')} exceeds auto-retry threshold of ₹2,00,000. Escalating to human.`;
  } else if (!blocked) {
    rules.push({
      rule: 'amount_threshold_check',
      status: 'passed',
      description: `Amount ₹${amount.toLocaleString('en-IN')} is within acceptable auto-action range.`
    });
  }

  // ─── RULE 6: Repeated failures trigger stop ───────────────────────────────
  if (!blocked && !overrideTriggered && previous_failures >= 5 && recommended_action !== 'stop') {
    rules.push({
      rule: 'repeated_failure_stop',
      status: 'triggered',
      description: `${previous_failures} previous failures detected. Automatically stopping recovery.`
    });
    finalAction = 'stop';
    overrideTriggered = true;
    overrideReason = `${previous_failures} previous failures detected. Automated recovery stopped to prevent customer harassment.`;
  } else if (!blocked) {
    rules.push({
      rule: 'failure_count_check',
      status: 'passed',
      description: `Previous failures: ${previous_failures}. Within acceptable threshold.`
    });
  }

  // ─── RULE 7: Cooldown period check ────────────────────────────────────────
  if (!blocked && !overrideTriggered && recommended_action === 'retry') {
    const lastUpdate = new Date(updated_at);
    const hoursSinceLastAction = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastAction < MIN_COOLDOWN_HOURS && retry_count > 0) {
      rules.push({
        rule: 'cooldown_period',
        status: 'triggered',
        description: `Only ${hoursSinceLastAction.toFixed(1)} hours since last attempt. Minimum cooldown: ${MIN_COOLDOWN_HOURS} hours.`
      });
      finalAction = 'escalate';
      overrideTriggered = true;
      overrideReason = `Cooldown period not met. ${hoursSinceLastAction.toFixed(1)} hours elapsed, minimum ${MIN_COOLDOWN_HOURS} hours required.`;
    } else {
      rules.push({
        rule: 'cooldown_check',
        status: 'passed',
        description: retry_count === 0 ? 'First attempt, no cooldown required.' : `Cooldown period met. ${hoursSinceLastAction.toFixed(1)} hours since last attempt.`
      });
    }
  }

  // ─── RULE 8: Low recovery probability safety check ────────────────────────
  if (!blocked && !overrideTriggered && recommended_action === 'retry' && recovery_probability < 20) {
    rules.push({
      rule: 'low_probability_check',
      status: 'triggered',
      description: `Recovery probability ${recovery_probability}% is below safe threshold of 20%.`
    });
    finalAction = 'escalate';
    overrideTriggered = true;
    overrideReason = `Recovery probability too low (${recovery_probability}%). Automated retry not cost-effective. Escalating.`;
  } else if (!blocked) {
    rules.push({
      rule: 'probability_check',
      status: 'passed',
      description: `Recovery probability ${recovery_probability}% meets minimum threshold.`
    });
  }

  return {
    ai_recommendation: recommended_action,
    final_action: finalAction,
    override_triggered: overrideTriggered,
    override_reason: overrideReason,
    rules_evaluated: rules,
    approved: !blocked,
    decision_summary: overrideTriggered
      ? `⚠️ Guardrail override: AI recommended ${recommended_action.toUpperCase()} → Final action: ${finalAction.toUpperCase()}`
      : `✅ AI recommendation approved: ${finalAction.toUpperCase()}`
  };
}

module.exports = { evaluateRecommendation };
